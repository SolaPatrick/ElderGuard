/**
 * Fake backend for development and tests. It follows frontend/docs/api-contract.md,
 * so switching to the real backend is just VITE_USE_MOCKS=false.
 */
import {
  addNoteRequestSchema,
  classifyRequestSchema,
  createStaffRequestSchema,
  cameraRequestSchema,
  residentRequestSchema,
  archiveBodySchema,
  roomRequestSchema,
  updateStaffRequestSchema,
  loginRequestSchema,
  resolveRequestSchema,
  sosRequestSchema,
} from '@elderguard/shared';
import { CANCEL_SOS_REASON_LABEL, cancelSosRequestSchema, isActiveStatus } from '@elderguard/shared';
import { facilitySettingsSchema, type SettingsSection } from '@elderguard/shared';
import type { SeedUser } from '@elderguard/shared/fixtures';
import { delay, http, HttpResponse } from 'msw';
import { API_BASE_URL } from '../api/config';
import { db } from './db';

const url = (path: string) => `${API_BASE_URL}${path}`;
const TOKEN_PREFIX = 'mock-token:';

/** Like Den's backend, a login lasts one 8-hour shift. */
const SESSION_MS = 8 * 3600_000;
const mockToken = (userId: string) => `${TOKEN_PREFIX}${userId}:${Date.now() + SESSION_MS}`;

const error = (status: number, code: string, message: string) =>
  HttpResponse.json({ code, message }, { status });

/** Returns the signed-in user, or an error response to send back. */
function authenticate(request: Request): SeedUser | Response {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  // "mock-token:<userId>" or "mock-token:<userId>:<expiresAtMs>"
  const [userId, expiresAt] = token.startsWith(TOKEN_PREFIX)
    ? token.slice(TOKEN_PREFIX.length).split(':')
    : [];
  const expired = expiresAt !== undefined && Number(expiresAt) <= Date.now();
  const user = userId && !expired ? db.findUserById(userId) : undefined;
  if (!user || user.status !== 'active')
    return error(401, 'unauthorized', 'Your session has expired. Log in again.');
  return user;
}

/** Users, rooms and cameras are managed by the Admin/Head only. */
function authenticateAdmin(request: Request): SeedUser | Response {
  const user = authenticate(request);
  if (user instanceof Response || user.role === 'admin') return user;
  return error(403, 'forbidden', 'Only the Admin/Head can do this.');
}

/** The account in the URL, or a 404 response. */
function staffFrom(params: Record<string, unknown>): SeedUser | Response {
  return db.findUserById(String(params.id)) ?? error(404, 'not_found', 'This user does not exist.');
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** A short delay makes loading states visible in development (none in tests). */
const latency = () => (import.meta.env.MODE === 'test' ? Promise.resolve() : delay(250));

export const handlers = [
  http.post(url('/auth/login'), async ({ request }) => {
    await latency();
    const parsed = loginRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) return error(400, 'validation_error', 'Enter your username and password.');
    const user = db.findUserByLogin(parsed.data.username);
    if (!user || !db.checkPassword(user, parsed.data.password)) {
      return error(401, 'invalid_credentials', 'Incorrect username or password.');
    }
    if (user.status === 'deactivated') {
      return error(403, 'account_deactivated', 'This account has been deactivated. Contact your Admin/Head.');
    }
    db.recordLogin(user);
    db.addActivity(user, `${user.fullName} logged in`, 'auth', 'logged_in', null);
    return HttpResponse.json({ token: mockToken(user.id), user: db.toPublicUser(user) });
  }),

  http.post(url('/auth/change-password'), async ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const body = (await readJson(request)) as { currentPassword?: unknown; newPassword?: unknown } | null;
    const current = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const next = typeof body?.newPassword === 'string' ? body.newPassword : '';
    if (!db.checkPassword(user, current))
      return error(400, 'wrong_password', 'Your current password is wrong.');
    if (next.length < 8) return error(400, 'weak_password', 'Use at least 8 characters.');
    if (next === current) return error(400, 'same_password', 'Choose a different password.');
    db.changePassword(user, next);
    return HttpResponse.json({ token: mockToken(user.id), user: db.toPublicUser(user) });
  }),

  http.get(url('/auth/me'), ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    return HttpResponse.json(db.toPublicUser(user));
  }),

  http.post(url('/auth/logout'), () => HttpResponse.json({ ok: true })),

  http.get(url('/dashboard/summary'), async ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    if (user.role !== 'admin')
      return error(403, 'forbidden', 'Only the Admin/Head can see facility-wide numbers.');
    await latency();
    return HttpResponse.json(db.dashboardSummary());
  }),

  http.get(url('/activity'), ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    if (user.role !== 'admin')
      return error(403, 'forbidden', 'Only the Admin/Head can see the activity log.');
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 20);
    return HttpResponse.json(db.listActivity(Number.isFinite(limit) ? limit : 20));
  }),

  http.get(url('/settings'), async ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    return HttpResponse.json(db.settings());
  }),

  http.put(url('/settings/:section'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const section = String(params.section);
    const shape = facilitySettingsSchema.shape;
    if (!(section in shape)) return error(404, 'not_found', 'There are no such settings.');
    const key = section as SettingsSection;
    const parsed = shape[key].safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    await latency();
    const saved = db.saveSettings(key, parsed.data);
    const name = {
      general: 'general',
      detection: 'detection',
      notifications: 'notification',
      security: 'security',
    }[key];
    db.addActivity(admin, `${admin.fullName} changed the ${name} settings`, 'settings', 'updated', null);
    return HttpResponse.json(saved);
  }),

  http.get(url('/cameras'), ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    return HttpResponse.json(db.listCameras(user));
  }),

  // The fake API has no real cameras behind it, so there is never a picture to send.
  http.get(url('/cameras/:id/snapshot'), ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    if (!db.listCameras(user).some((c) => c.id === String(params.id)))
      return error(404, 'not_found', 'This camera does not exist.');
    return error(404, 'no_picture', 'This camera is not sending pictures.');
  }),

  http.post(url('/cameras/test'), async ({ request }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const body = (await readJson(request)) as { source?: unknown } | null;
    const source = typeof body?.source === 'string' ? body.source.trim() : '';
    if (!source) return error(400, 'validation_error', 'Enter the stream link or device number.');
    await latency();
    const result = db.testCameraSource(source);
    if (!result) {
      return error(
        400,
        'camera_unreachable',
        "Can't read from this camera. Check the link, cable or file path. A camera that is already streaming may be busy.",
      );
    }
    return HttpResponse.json(result);
  }),

  http.get(url('/cameras/:id/settings'), ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const camera = db.findCamera(String(params.id));
    if (!camera) return error(404, 'not_found', 'This camera does not exist.');
    return HttpResponse.json(db.cameraSettings(camera));
  }),

  http.post(url('/cameras'), async ({ request }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const parsed = cameraRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    await latency();
    const problem = db.cameraProblem(parsed.data);
    if (problem) return error(409, 'conflict', problem);
    const saved = db.saveCamera(parsed.data);
    db.addActivity(admin, `${admin.fullName} registered ${saved.code}`, 'cameras', 'created', saved.code);
    return HttpResponse.json(saved, { status: 201 });
  }),

  http.patch(url('/cameras/:id'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const parsed = cameraRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    await latency();
    const id = String(params.id);
    if (!db.findCamera(id)) return error(404, 'not_found', 'This camera does not exist.');
    const problem = db.cameraProblem(parsed.data, id);
    if (problem) return error(409, 'conflict', problem);
    const saved = db.saveCamera(parsed.data, id);
    db.addActivity(
      admin,
      `${admin.fullName} changed the settings of ${saved.code}`,
      'cameras',
      'updated',
      saved.code,
    );
    return HttpResponse.json(saved);
  }),

  http.delete(url('/cameras/:id'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    await latency();
    const camera = db.findCamera(String(params.id));
    if (!camera) return error(404, 'not_found', 'This camera does not exist.');
    const blocker = db.cameraDeleteBlocker(camera.id);
    if (blocker) return error(409, 'camera_in_use', blocker);
    db.deleteCamera(camera.id);
    db.addActivity(admin, `${admin.fullName} removed ${camera.code}`, 'cameras', 'deleted', camera.code);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url('/incidents'), async ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const params = new URL(request.url).searchParams;
    const scope = params.get('scope') === 'active' ? 'active' : 'all';
    const from = Date.parse(params.get('from') ?? '');
    const to = Date.parse(params.get('to') ?? '');
    const between = Number.isFinite(from) && Number.isFinite(to) ? { from, to } : undefined;
    const limit = between ? Infinity : Number(params.get('limit') ?? 50);
    await latency();
    return HttpResponse.json(
      db.listIncidents(user, scope, Number.isFinite(limit) || between ? limit : 50, between),
    );
  }),

  http.get(url('/incidents/:code'), async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const incident = db.getIncident(user, String(params.code));
    if (!incident) return error(404, 'not_found', 'This incident does not exist.');
    return HttpResponse.json(incident);
  }),

  http.post(url('/incidents/:code/acknowledge'), async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const incident = db.getIncident(user, String(params.code));
    if (!incident) return error(404, 'not_found', 'This incident does not exist.');
    if (incident.status !== 'new') {
      const by = incident.acknowledgedBy?.fullName ?? 'someone else';
      return error(409, 'already_acknowledged', `Already acknowledged by ${by}.`);
    }
    db.updateIncident(incident.code, (i) => {
      i.status = 'acknowledged';
      i.acknowledgedAt = new Date().toISOString();
      i.acknowledgedBy = { id: user.id, fullName: user.fullName };
      db.addEvent(i, 'acknowledged', user);
    });
    db.addActivity(
      user,
      `${user.fullName} acknowledged ${incident.code}`,
      'alerts',
      'acknowledged',
      incident.code,
    );
    return HttpResponse.json(incident);
  }),

  http.post(url('/incidents/:code/classify'), async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const parsed = classifyRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    await latency();
    const incident = db.getIncident(user, String(params.code));
    if (!incident) return error(404, 'not_found', 'This incident does not exist.');
    if (incident.status !== 'acknowledged') {
      return error(409, 'invalid_state', 'Only acknowledged alerts can be classified.');
    }
    const { classification, falseAlarmReason } = parsed.data;
    db.updateIncident(incident.code, (i) => {
      i.status = classification;
      if (classification === 'false_alarm') {
        i.falseAlarmReason = falseAlarmReason ?? null;
        i.resolvedAt = new Date().toISOString();
        i.resolvedBy = { id: user.id, fullName: user.fullName };
      }
      db.addEvent(i, 'classified', user, classification === 'false_alarm' ? 'False alarm' : 'Confirmed fall');
    });
    db.addActivity(
      user,
      `${user.fullName} classified ${incident.code}`,
      'alerts',
      'classified',
      incident.code,
    );
    return HttpResponse.json(incident);
  }),

  http.post(url('/incidents/:code/resolve'), async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const parsed = resolveRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    await latency();
    const incident = db.getIncident(user, String(params.code));
    if (!incident) return error(404, 'not_found', 'This incident does not exist.');
    if (incident.status !== 'confirmed') {
      return error(409, 'invalid_state', 'Classify the alert as a confirmed fall before resolving it.');
    }
    db.updateIncident(incident.code, (i) => {
      i.status = 'resolved';
      i.outcome = parsed.data.outcome;
      i.resolvedAt = new Date().toISOString();
      i.resolvedBy = { id: user.id, fullName: user.fullName };
      if (parsed.data.responseSummary) db.addNote(i, user, parsed.data.responseSummary);
      db.addEvent(i, 'resolved', user, parsed.data.outcome);
    });
    db.addActivity(user, `${user.fullName} resolved ${incident.code}`, 'alerts', 'resolved', incident.code);
    return HttpResponse.json(incident);
  }),

  http.post(url('/incidents/:code/cancel-sos'), async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const parsed = cancelSosRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    if (parsed.data.reason === 'other' && !parsed.data.note)
      return error(400, 'validation_error', 'Explain why');
    await latency();
    const incident = db.getIncident(user, String(params.code));
    if (!incident) return error(404, 'not_found', 'This incident does not exist.');
    if (incident.type !== 'sos') return error(409, 'invalid_state', 'Only an SOS can be cancelled.');
    if (!isActiveStatus(incident.status)) return error(409, 'invalid_state', 'This SOS is already closed.');
    if (incident.sentBy?.id !== user.id && user.role !== 'admin')
      return error(403, 'forbidden', 'Only the person who sent the SOS or the Admin/Head can cancel it.');
    const label = CANCEL_SOS_REASON_LABEL[parsed.data.reason];
    db.updateIncident(incident.code, (i) => {
      i.status = 'resolved';
      i.outcome = `SOS cancelled · ${label}`;
      i.resolvedAt = new Date().toISOString();
      i.resolvedBy = { id: user.id, fullName: user.fullName };
      if (parsed.data.note) db.addNote(i, user, parsed.data.note);
      db.addEvent(i, 'resolved', user, `SOS cancelled · ${label}`);
    });
    db.addActivity(user, `${user.fullName} cancelled ${incident.code}`, 'alerts', 'cancelled', incident.code);
    return HttpResponse.json(db.getIncident(user, incident.code));
  }),

  http.post(url('/incidents/:code/notes'), async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const parsed = addNoteRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    const incident = db.getIncident(user, String(params.code));
    if (!incident) return error(404, 'not_found', 'This incident does not exist.');
    db.addNote(incident, user, parsed.data.body);
    return HttpResponse.json(incident);
  }),

  http.post(url('/incidents/sos'), async ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const parsed = sosRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    const incident = db.sendSos(user, parsed.data);
    if (!incident) return error(403, 'forbidden', 'You can only send an SOS from your own areas.');
    return HttpResponse.json(incident, { status: 201 });
  }),

  http.get(url('/rooms'), ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    return HttpResponse.json(db.listRooms(user));
  }),

  http.post(url('/rooms'), async ({ request }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const parsed = roomRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    await latency();
    const conflict = db.roomConflict(parsed.data);
    if (conflict) return error(409, 'conflict', conflict);
    const room = db.createRoom(parsed.data);
    db.addActivity(admin, `${admin.fullName} added ${room.name}`, 'rooms', 'created', room.name);
    return HttpResponse.json(room, { status: 201 });
  }),

  http.patch(url('/rooms/:id'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const parsed = roomRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    await latency();
    const id = String(params.id);
    if (!db.findRoom(id)) return error(404, 'not_found', 'This room does not exist.');
    const conflict = db.roomConflict(parsed.data, id);
    if (conflict) return error(409, 'conflict', conflict);
    const room = db.updateRoom(id, parsed.data)!;
    db.addActivity(admin, `${admin.fullName} updated ${room.name}`, 'rooms', 'updated', room.name);
    return HttpResponse.json(room);
  }),

  http.delete(url('/rooms/:id'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    await latency();
    const room = db.findRoom(String(params.id));
    if (!room) return error(404, 'not_found', 'This room does not exist.');
    const blocker = db.roomDeleteBlocker(room.id);
    if (blocker) return error(409, 'room_in_use', blocker);
    db.deleteRoom(room.id);
    db.addActivity(admin, `${admin.fullName} deleted ${room.name}`, 'rooms', 'deleted', room.name);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url('/residents'), ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const archived = new URL(request.url).searchParams.get('archived') === 'true';
    // Only the Admin/Head looks through former residents (RES-07 restore).
    if (archived && user.role !== 'admin') return error(403, 'forbidden', 'Only the Admin/Head can do this.');
    return HttpResponse.json(db.listResidents(user, archived));
  }),

  http.post(url('/residents'), async ({ request }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const parsed = residentRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    await latency();
    const problem = db.residentProblem(parsed.data);
    if (problem) return error(400, 'validation_error', problem);
    const saved = db.saveResident(parsed.data);
    db.addActivity(
      admin,
      `${admin.fullName} added resident ${saved.fullName}`,
      'residents',
      'created',
      saved.fullName,
    );
    return HttpResponse.json(db.getResident(admin, saved.id), { status: 201 });
  }),

  http.patch(url('/residents/:id'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const parsed = residentRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    await latency();
    const id = String(params.id);
    const current = db.findResident(id);
    if (!current) return error(404, 'not_found', 'This resident does not exist.');
    const problem = db.residentProblem(parsed.data, current);
    if (problem) return error(400, 'validation_error', problem);
    const saved = db.saveResident(parsed.data, id);
    db.addActivity(
      admin,
      `${admin.fullName} updated resident ${saved.fullName}`,
      'residents',
      'updated',
      saved.fullName,
    );
    return HttpResponse.json(db.getResident(admin, saved.id));
  }),

  http.post(url('/residents/:id/archive'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const parsed = archiveBodySchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    if (parsed.data.reason === 'other' && !parsed.data.note?.trim())
      return error(400, 'validation_error', 'Explain the reason');
    await latency();
    const r = db.findResident(String(params.id));
    if (!r) return error(404, 'not_found', 'This resident does not exist.');
    db.setArchived(r, { reason: parsed.data.reason, note: parsed.data.note?.trim() || null });
    db.addActivity(
      admin,
      `${admin.fullName} archived resident ${r.fullName}`,
      'residents',
      'archived',
      r.fullName,
    );
    return HttpResponse.json(db.getResident(admin, r.id));
  }),

  http.post(url('/residents/:id/restore'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    await latency();
    const r = db.findResident(String(params.id));
    if (!r) return error(404, 'not_found', 'This resident does not exist.');
    db.setArchived(r, null);
    db.addActivity(
      admin,
      `${admin.fullName} restored resident ${r.fullName}`,
      'residents',
      'restored',
      r.fullName,
    );
    return HttpResponse.json(db.getResident(admin, r.id));
  }),

  http.get(url('/residents/:id'), ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const resident = db.getResident(user, String(params.id));
    if (!resident) return error(404, 'not_found', 'This resident does not exist.');
    return HttpResponse.json(resident);
  }),

  // ---------- staff accounts (USR) ----------

  http.get(url('/users'), ({ request }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    return HttpResponse.json(db.listStaff());
  }),

  http.get(url('/users/:id'), ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const staff = staffFrom(params);
    if (staff instanceof Response) return staff;
    return HttpResponse.json(db.getStaff(staff.id));
  }),

  http.post(url('/users'), async ({ request }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const parsed = createStaffRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    await latency();
    const conflict = db.staffConflict(parsed.data.username, parsed.data.email);
    if (conflict) return error(409, 'conflict', conflict);
    const created = db.createStaff(parsed.data);
    db.addActivity(
      admin,
      `${admin.fullName} created an account for ${created.user.fullName}`,
      'users',
      'created',
      created.user.fullName,
    );
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch(url('/users/:id'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const staff = staffFrom(params);
    if (staff instanceof Response) return staff;
    const parsed = updateStaffRequestSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return error(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Invalid input.');
    await latency();
    const conflict = db.staffConflict(null, parsed.data.email, staff.id);
    if (conflict) return error(409, 'conflict', conflict);
    if (parsed.data.role !== 'admin' && db.isLastActiveAdmin(staff)) {
      return error(
        409,
        'last_admin',
        'This is the only active Admin/Head. Make someone else an Admin/Head first.',
      );
    }
    const updated = db.updateStaff(staff, parsed.data);
    db.addActivity(
      admin,
      `${admin.fullName} updated ${updated.fullName}'s account`,
      'users',
      'updated',
      updated.fullName,
    );
    return HttpResponse.json(updated);
  }),

  http.post(url('/users/:id/deactivate'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const staff = staffFrom(params);
    if (staff instanceof Response) return staff;
    if (staff.id === admin.id) return error(400, 'self', "You can't deactivate your own account.");
    await latency();
    const updated = db.setStaffActive(staff, false);
    db.addActivity(
      admin,
      `${admin.fullName} deactivated ${updated.fullName}`,
      'users',
      'deactivated',
      updated.fullName,
    );
    return HttpResponse.json(updated);
  }),

  http.post(url('/users/:id/reactivate'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const staff = staffFrom(params);
    if (staff instanceof Response) return staff;
    await latency();
    const updated = db.setStaffActive(staff, true);
    db.addActivity(
      admin,
      `${admin.fullName} reactivated ${updated.fullName}`,
      'users',
      'reactivated',
      updated.fullName,
    );
    return HttpResponse.json(updated);
  }),

  http.post(url('/users/:id/reset-password'), async ({ request, params }) => {
    const admin = authenticateAdmin(request);
    if (admin instanceof Response) return admin;
    const staff = staffFrom(params);
    if (staff instanceof Response) return staff;
    await latency();
    const result = db.resetStaffPassword(staff);
    db.addActivity(
      admin,
      `${admin.fullName} reset ${staff.fullName}'s password`,
      'users',
      'password_reset',
      staff.fullName,
    );
    return HttpResponse.json(result);
  }),

  // Development only: pretend a camera just detected a fall.
  http.post(url('/dev/simulate-fall'), ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    return HttpResponse.json(db.simulateFall(user));
  }),
];

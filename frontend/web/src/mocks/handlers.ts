/**
 * Fake backend for development and tests. It follows frontend/docs/api-contract.md,
 * so switching to the real backend is just VITE_USE_MOCKS=false.
 */
import {
  addNoteRequestSchema,
  classifyRequestSchema,
  loginRequestSchema,
  resolveRequestSchema,
  sosRequestSchema,
} from '@elderguard/shared';
import { DEMO_PASSWORD, type SeedUser } from '@elderguard/shared/fixtures';
import { delay, http, HttpResponse } from 'msw';
import { API_BASE_URL } from '../api/config';
import { db } from './db';

const url = (path: string) => `${API_BASE_URL}${path}`;
const TOKEN_PREFIX = 'mock-token:';

const error = (status: number, code: string, message: string) =>
  HttpResponse.json({ code, message }, { status });

/** Returns the signed-in user, or an error response to send back. */
function authenticate(request: Request): SeedUser | Response {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = token.startsWith(TOKEN_PREFIX) ? db.findUserById(token.slice(TOKEN_PREFIX.length)) : undefined;
  if (!user || user.status !== 'active')
    return error(401, 'unauthorized', 'Your session has expired. Log in again.');
  return user;
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
    if (!user || parsed.data.password !== DEMO_PASSWORD) {
      return error(401, 'invalid_credentials', 'Incorrect username or password.');
    }
    if (user.status === 'deactivated') {
      return error(403, 'account_deactivated', 'This account has been deactivated. Contact your Admin/Head.');
    }
    db.addActivity(user, `${user.fullName} logged in`);
    return HttpResponse.json({ token: `${TOKEN_PREFIX}${user.id}`, user: db.toPublicUser(user) });
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

  http.get(url('/cameras'), ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    return HttpResponse.json(db.listCameras(user));
  }),

  http.get(url('/incidents'), async ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const params = new URL(request.url).searchParams;
    const scope = params.get('scope') === 'active' ? 'active' : 'all';
    const limit = Number(params.get('limit') ?? 50);
    await latency();
    return HttpResponse.json(db.listIncidents(user, scope, Number.isFinite(limit) ? limit : 50));
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
    db.addActivity(user, `${user.fullName} acknowledged ${incident.code}`);
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
    db.addActivity(user, `${user.fullName} classified ${incident.code}`);
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
    db.addActivity(user, `${user.fullName} resolved ${incident.code}`);
    return HttpResponse.json(incident);
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

  http.get(url('/residents'), ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    return HttpResponse.json(db.listResidents(user));
  }),

  // Development only: pretend a camera just detected a fall.
  http.post(url('/dev/simulate-fall'), ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    return HttpResponse.json(db.simulateFall(user));
  }),
];

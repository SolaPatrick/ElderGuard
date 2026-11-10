/**
 * Adapter for the ElderGuard FastAPI backend (backend/ in this repo).
 *
 * The screens are written against frontend/docs/api-contract.md. That backend uses
 * different paths and names (/alerts/12 with snake_case fields instead of
 * /incidents/INC-2026-0012 with camelCase), so this file translates in both directions.
 * It is used when VITE_USE_MOCKS=false and VITE_BACKEND=fastapi.
 *
 * Things that backend does not have yet are listed in frontend/docs/backend-gaps.md;
 * here they fall back to empty values, never invented ones.
 */
import { z } from 'zod';
import {
  type ActivityEntry,
  type AddNoteRequest,
  type Camera,
  type ChangePasswordRequest,
  type ClassifyRequest,
  type CreateStaffRequest,
  type StaffMember,
  type StaffWithPassword,
  type UpdateStaffRequest,
  type DashboardSummary,
  type Incident,
  type IncidentDetail,
  type IncidentEvent,
  type IncidentStatus,
  type LoginRequest,
  type LoginResponse,
  type ResolveRequest,
  type Resident,
  type ResidentDetail,
  type RoomRef,
  type User,
  isActiveStatus,
} from '@elderguard/shared';
import { ApiError, apiRequest } from './client';
import { API_BASE_URL } from './config';
import { tokenStorage } from '../auth/tokenStorage';

// ---------- what the backend sends ----------

const dateTime = z.string(); // FastAPI sends ISO 8601; some values have no time zone (then they are UTC)

const rawUser = z.object({
  id: z.number(),
  username: z.string(),
  full_name: z.string(),
  email: z.string().nullable(),
  role: z.enum(['admin', 'employee']),
  must_change_password: z.boolean(),
});
type RawUser = z.infer<typeof rawUser>;

const rawStaff = rawUser.extend({ is_active: z.boolean(), created_at: dateTime });
type RawStaff = z.infer<typeof rawStaff>;
const rawStaffWithPassword = z.object({ user: rawStaff, temporary_password: z.string().min(1) });

const rawRoom = z.object({ id: z.number(), name: z.string(), area: z.string() });
type RawRoom = z.infer<typeof rawRoom>;

const rawResident = z.object({
  id: z.number(),
  full_name: z.string(),
  age: z.number().nullable(),
  risk_level: z.enum(['low', 'moderate', 'high']),
  room_id: z.number().nullable(),
  emergency_contact: z.string(),
  notes: z.string(),
});
type RawResident = z.infer<typeof rawResident>;

const rawCamera = z.object({
  id: z.number(),
  name: z.string(),
  room_id: z.number().nullable(),
  detection_enabled: z.boolean(),
});
type RawCamera = z.infer<typeof rawCamera>;

const rawCameraStatus = z.object({
  camera_id: z.number(),
  online: z.boolean(),
  fps: z.number(),
  error: z.string().nullable(),
});

const rawAlert = z.object({
  id: z.number(),
  camera_id: z.number().nullable(),
  room_id: z.number().nullable(),
  fall_type: z.string(),
  confidence: z.number(),
  status: z.enum(['new', 'acknowledged', 'classified', 'resolved']),
  detected_at: dateTime,
  acknowledged_at: dateTime.nullable(),
  acknowledged_by: z.number().nullable(),
  classification: z.enum(['confirmed', 'false_alarm']).nullable(),
  false_alarm_reason: z.string().nullable(),
  classified_at: dateTime.nullable(),
  classified_by: z.number().nullable(),
  resolved_at: dateTime.nullable(),
  resolved_by: z.number().nullable(),
  camera_name: z.string(),
  room_name: z.string(),
  area: z.string(),
  residents: z.array(z.string()),
  snapshot_url: z.string().nullable(),
  notes: z.array(z.object({ id: z.number(), text: z.string(), author: z.string(), created_at: dateTime })),
});
type RawAlert = z.infer<typeof rawAlert>;

const rawLogin = z.object({ access_token: z.string().min(1), user: rawUser });

// ---------- small helpers ----------

/** FastAPI may send "2026-11-09T03:41:08.123456" (UTC, no zone). The screens need a zone. */
export function isoUtc(value: string): string {
  const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  return new Date(withZone).toISOString();
}
const isoOrNull = (v: string | null) => (v === null ? null : isoUtc(v));

/** Alerts are shown as INC-<year>-<id>, e.g. id 12 detected in 2026 is INC-2026-0012. */
export function alertCode(alert: Pick<RawAlert, 'id' | 'detected_at'>): string {
  return `INC-${new Date(isoUtc(alert.detected_at)).getUTCFullYear()}-${String(alert.id).padStart(4, '0')}`;
}

/** The backend id inside a code. Anything that is not a code is "not found". */
export function alertIdFromCode(code: string): number {
  const id = Number(/^INC-\d{4}-(\d+)$/.exec(code)?.[1]);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(404, 'not_found', 'This incident does not exist.');
  return id;
}

const numericId = (id: string, what: string): number => {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(404, 'not_found', `This ${what} does not exist.`);
  return n;
};

const notYet = (what: string) =>
  new ApiError(501, 'not_implemented', `${what} is not available on the server yet.`);

/** The classify dialog's reasons, and the backend's codes for them. */
const REASON_TO_CODE: Record<string, string> = {
  'Resident sat or lay down on purpose': 'sitting_down',
  'Object dropped on the floor': 'object_or_pet',
  'Camera glare or shadow': 'lighting_or_shadow',
};
const CODE_TO_REASON: Record<string, string> = {
  sitting_down: 'Resident sat or lay down on purpose',
  bending_or_kneeling: 'Resident bent down or knelt',
  object_or_pet: 'Object or pet in view',
  lighting_or_shadow: 'Camera glare or shadow',
  other: 'Other',
};

// ---------- translations ----------

const toUser = (u: RawUser): User => ({
  id: String(u.id),
  fullName: u.full_name,
  username: u.username,
  email: u.email,
  role: u.role,
  title: u.role === 'admin' ? 'Admin/Head' : 'Caregiver',
  mustChangePassword: u.must_change_password,
  areas: [], // the backend has no area assignments yet: caregivers see everything
});

const toStaff = (u: RawStaff): StaffMember => ({
  ...toUser(u),
  isActive: u.is_active,
  lastLoginAt: null, // not recorded by the backend yet
  createdAt: isoUtc(u.created_at),
});

const toStaffWithPassword = (r: z.infer<typeof rawStaffWithPassword>): StaffWithPassword => ({
  user: toStaff(r.user),
  temporaryPassword: r.temporary_password,
});

/** Staff ids in links are numbers on this backend. */
function staffId(id: string): number {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(404, 'not_found', 'This user does not exist.');
  return n;
}

/** The screens hide area assignment for this backend; refuse rather than silently drop it. */
function noAreas(areaIds: string[]) {
  if (areaIds.length > 0) throw notYet('Assigning rooms and areas to staff');
}

const toRoom = (r: RawRoom): RoomRef => ({ id: String(r.id), name: r.name, wing: r.area || null });

/** Names of staff by id. Only the Admin/Head may list users; others get "A staff member". */
type People = ReadonlyMap<number, string>;
const person = (people: People, id: number | null) =>
  id === null ? null : { id: String(id), fullName: people.get(id) ?? 'A staff member' };

function toIncident(a: RawAlert, people: People, residents: readonly RawResident[]): IncidentDetail {
  const closedAsFalseAlarm = a.classification === 'false_alarm';
  const status: IncidentStatus =
    a.status === 'new' || a.status === 'acknowledged'
      ? a.status
      : closedAsFalseAlarm
        ? 'false_alarm'
        : a.status === 'resolved'
          ? 'resolved'
          : 'confirmed';
  // The backend lists who was in the room, not who fell. Naming the wrong person could send
  // staff to the wrong bed, so a resident is only shown when they were alone in the room.
  const name = a.residents.length === 1 ? a.residents[0] : undefined;
  const known = name === undefined ? undefined : residents.find((r) => r.full_name === name);
  const detectedAt = isoUtc(a.detected_at);

  const events: IncidentEvent[] = [
    {
      id: `${a.id}-detected`,
      action: 'detected',
      occurredAt: detectedAt,
      user: null,
      detail: [a.camera_name || null, a.fall_type, `confidence ${Math.round(a.confidence * 100)}%`]
        .filter(Boolean)
        .join(' · '),
    },
  ];
  if (a.acknowledged_at)
    events.push({
      id: `${a.id}-ack`,
      action: 'acknowledged',
      occurredAt: isoUtc(a.acknowledged_at),
      user: person(people, a.acknowledged_by),
      detail: null,
    });
  if (a.classified_at)
    events.push({
      id: `${a.id}-classified`,
      action: 'classified',
      occurredAt: isoUtc(a.classified_at),
      user: person(people, a.classified_by),
      detail: closedAsFalseAlarm ? 'False alarm' : 'Confirmed fall',
    });
  if (a.resolved_at && !closedAsFalseAlarm)
    events.push({
      id: `${a.id}-resolved`,
      action: 'resolved',
      occurredAt: isoUtc(a.resolved_at),
      user: person(people, a.resolved_by),
      detail: null,
    });

  return {
    code: alertCode(a),
    type: 'fall',
    status,
    resident: known
      ? { id: String(known.id), fullName: known.full_name, age: known.age, fallRisk: known.risk_level }
      : null,
    room: {
      id: a.room_id === null ? '' : String(a.room_id),
      name: a.room_name || 'Unknown room',
      wing: a.area || null,
    },
    camera:
      a.camera_id === null
        ? null
        : { id: String(a.camera_id), code: a.camera_name || `Camera ${a.camera_id}` },
    sentBy: null,
    confidence: Math.min(1, Math.max(0, a.confidence)),
    // An <img> cannot send the login header, so the snapshot needs ?token= like the live stream.
    snapshotUrl: a.snapshot_url ? withToken(a.snapshot_url) : null,
    clipUrl: null,
    detectedAt,
    acknowledgedAt: isoOrNull(a.acknowledged_at),
    acknowledgedBy: person(people, a.acknowledged_by),
    resolvedAt: isoOrNull(closedAsFalseAlarm ? (a.classified_at ?? a.resolved_at) : a.resolved_at),
    resolvedBy: person(people, closedAsFalseAlarm ? (a.classified_by ?? a.resolved_by) : a.resolved_by),
    escalatedAt: null,
    falseAlarmReason: a.false_alarm_reason
      ? (CODE_TO_REASON[a.false_alarm_reason] ?? a.false_alarm_reason)
      : null,
    outcome: null,
    events,
    notes: a.notes.map((n) => ({
      id: String(n.id),
      body: n.text,
      author: { id: `name:${n.author}`, fullName: n.author },
      createdAt: isoUtc(n.created_at),
    })),
  };
}

const summary = ({ events: _e, notes: _n, ...incident }: IncidentDetail): Incident => incident;

/** Backend paths start with /api; API_BASE_URL is that same /api, so paths here leave it out. */
function withToken(backendPath: string): string {
  const path = backendPath.startsWith('/api/') ? backendPath.slice(4) : backendPath;
  const token = tokenStorage.get() ?? '';
  return `${API_BASE_URL}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

// ---------- requests ----------

const get = <S extends z.ZodType>(path: string, schema: S) => apiRequest(path, schema);

let peopleCache: { at: number; people: People } | null = null;
/** Staff names for "acknowledged by". Admin-only on the backend; others fall back to no names. */
async function people(): Promise<People> {
  if (peopleCache && Date.now() - peopleCache.at < 60_000) return peopleCache.people;
  let result: People = new Map();
  try {
    const users = await get('/users', z.array(z.object({ id: z.number(), full_name: z.string() })));
    result = new Map(users.map((u) => [u.id, u.full_name]));
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 403) throw err;
  }
  peopleCache = { at: Date.now(), people: result };
  return result;
}

const rooms = () => get('/rooms', z.array(rawRoom));
const residentsRaw = () => get('/residents', z.array(rawResident));
const alertsRaw = (query: string) => get(`/alerts?${query}`, z.array(rawAlert));

async function incidentsFrom(query: string, activeOnly: boolean): Promise<Incident[]> {
  const [alerts, staff, residents] = await Promise.all([alertsRaw(query), people(), residentsRaw()]);
  return alerts
    .map((a) => summary(toIncident(a, staff, residents)))
    .filter((i) => !activeOnly || isActiveStatus(i.status));
}

async function incidentDetail(id: number): Promise<IncidentDetail> {
  const [alert, staff, residents] = await Promise.all([
    get(`/alerts/${id}`, rawAlert),
    people(),
    residentsRaw(),
  ]);
  return toIncident(alert, staff, residents);
}

async function act(code: string, action: string, body?: unknown): Promise<IncidentDetail> {
  const id = alertIdFromCode(code);
  const [alert, staff, residents] = await Promise.all([
    apiRequest(`/alerts/${id}/${action}`, rawAlert, { method: 'POST', ...(body !== undefined && { body }) }),
    people(),
    residentsRaw(),
  ]);
  return toIncident(alert, staff, residents);
}

function toResident(r: RawResident, roomList: readonly RawRoom[], incidents: readonly Incident[]): Resident {
  const room = roomList.find((x) => x.id === r.room_id);
  const theirs = incidents.filter((i) => i.resident?.id === String(r.id));
  return {
    id: String(r.id),
    fullName: r.full_name,
    age: r.age,
    fallRisk: r.risk_level,
    room: room ? toRoom(room) : null,
    caregivers: [], // no caregiver assignments on the backend yet
    hasActiveAlert: theirs.some((i) => isActiveStatus(i.status)),
    lastIncidentAt:
      theirs
        .map((i) => i.detectedAt)
        .toSorted()
        .at(-1) ?? null,
  };
}

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fastApi = {
  async login({ username, password }: LoginRequest): Promise<LoginResponse> {
    const res = await apiRequest('/auth/login', rawLogin, {
      method: 'POST',
      form: { username, password },
      skipAuthRedirect: true,
    });
    peopleCache = null;
    return { token: res.access_token, user: toUser(res.user) };
  },
  me: async (signal?: AbortSignal) => toUser(await apiRequest('/auth/me', rawUser, signal ? { signal } : {})),
  async logout() {
    await apiRequest('/auth/logout', z.null(), { method: 'POST', skipAuthRedirect: true });
    return { ok: true as const };
  },
  async changePassword({ currentPassword, newPassword }: ChangePasswordRequest): Promise<LoginResponse> {
    const res = await apiRequest(
      '/auth/change-password',
      rawUser.extend({ access_token: z.string().min(1) }),
      {
        method: 'POST',
        body: { current_password: currentPassword, new_password: newPassword },
      },
    );
    return { token: res.access_token, user: toUser(res) };
  },

  async dashboardSummary(): Promise<DashboardSummary> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const weekStart = new Date(startOfToday);
    weekStart.setDate(weekStart.getDate() - 6);
    const [week, active, cams, residents] = await Promise.all([
      incidentsFrom(`date_from=${encodeURIComponent(weekStart.toISOString())}&limit=500`, false),
      incidentsFrom('active=true&limit=500', true),
      fastApi.cameras(),
      residentsRaw(),
    ]);
    const today = week.filter((i) => Date.parse(i.detectedAt) >= startOfToday.getTime());
    const acked = week.filter((i) => i.acknowledgedAt);
    const count = (s: Camera['status']) => cams.filter((c) => c.status === s).length;
    return {
      facilityName: 'ElderGuard',
      activeAlerts: {
        total: active.length,
        new: active.filter((i) => i.status === 'new').length,
        acknowledged: active.filter((i) => i.status !== 'new').length,
      },
      incidentsToday: {
        total: today.length,
        confirmed: today.filter((i) => i.status === 'confirmed' || i.status === 'resolved').length,
        falseAlarms: today.filter((i) => i.status === 'false_alarm').length,
      },
      cameras: {
        online: count('online'),
        total: cams.length,
        offline: count('offline'),
        paused: count('paused'),
        error: count('error'),
      },
      residentsMonitored: residents.length,
      falseAlarmRate7d:
        week.length === 0 ? null : week.filter((i) => i.status === 'false_alarm').length / week.length,
      avgAckSeconds:
        acked.length === 0
          ? null
          : acked.reduce(
              (sum, i) => sum + (Date.parse(i.acknowledgedAt!) - Date.parse(i.detectedAt)) / 1000,
              0,
            ) / acked.length,
      fallsThisWeek: Array.from({ length: 7 }, (_, k) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + k);
        const date = localDate(day);
        return {
          date,
          count: week.filter((i) => i.status !== 'false_alarm' && localDate(new Date(i.detectedAt)) === date)
            .length,
        };
      }),
    };
  },
  // No activity log on the backend yet.
  activity: async (_limit: number): Promise<ActivityEntry[]> => [],

  async cameras(): Promise<Camera[]> {
    const [cams, statuses, roomList] = await Promise.all([
      get('/cameras', z.array(rawCamera)),
      get('/cameras/status', z.array(rawCameraStatus)),
      rooms(),
    ]);
    return cams.map((c: RawCamera) => {
      const s = statuses.find((x) => x.camera_id === c.id);
      const room = roomList.find((r) => r.id === c.room_id);
      const status: Camera['status'] = !c.detection_enabled
        ? 'paused'
        : s?.online
          ? 'online'
          : s?.error && s.error !== 'Detection is off'
            ? 'error'
            : 'offline';
      return {
        id: String(c.id),
        code: c.name,
        roomId: room ? String(room.id) : null,
        roomName: room?.name ?? null,
        roomWing: room?.area || null,
        resolutionFps: s?.online ? `${s.fps} FPS` : null,
        liveUrl: withToken(`/cameras/${c.id}/stream`),
        liveFormat: 'mjpeg',
        status,
        detectionEnabled: c.detection_enabled,
        lastSeenAt: null,
      };
    });
  },

  async residents(): Promise<Resident[]> {
    const [list, roomList, incidents] = await Promise.all([
      residentsRaw(),
      rooms(),
      incidentsFrom('limit=500', false),
    ]);
    return list.map((r) => toResident(r, roomList, incidents));
  },
  async resident(id: string): Promise<ResidentDetail> {
    const [r, roomList, incidents] = await Promise.all([
      get(`/residents/${numericId(id, 'resident')}`, rawResident),
      rooms(),
      incidentsFrom('limit=500', false),
    ]);
    return {
      ...toResident(r, roomList, incidents),
      sex: null,
      birthDate: null,
      mobilityAid: null,
      careNotes: r.notes || null,
      // The backend keeps one free-text contact; show it as is, without a phone button.
      emergencyContacts: r.emergency_contact
        ? [{ id: `${r.id}-contact`, fullName: r.emergency_contact, relationship: null, phone: '' }]
        : [],
    };
  },
  rooms: async (): Promise<RoomRef[]> => (await rooms()).map(toRoom),

  activeIncidents: () => incidentsFrom('active=true&limit=200', true),
  incidents: (limit = 50) => incidentsFrom(`limit=${limit}`, false),
  incident: (code: string) => incidentDetail(alertIdFromCode(code)),
  sendSos: async (_body: unknown): Promise<IncidentDetail> => {
    throw notYet('Sending an SOS');
  },

  acknowledge: (code: string) => act(code, 'acknowledge'),
  async classify(code: string, body: ClassifyRequest): Promise<IncidentDetail> {
    if (body.classification === 'confirmed') return act(code, 'classify', { classification: 'confirmed' });
    const reason = body.falseAlarmReason ?? '';
    const known = REASON_TO_CODE[reason];
    await act(code, 'classify', {
      classification: 'false_alarm',
      false_alarm_reason: known ?? 'other',
      // "Other" needs a note on the backend; the chosen wording is the note.
      note: known ? '' : reason,
    });
    // In the app a false alarm closes the incident; the backend wants a separate resolve.
    return act(code, 'resolve', { text: '' });
  },
  resolve: (code: string, body: ResolveRequest) =>
    act(code, 'resolve', {
      text: [`Outcome: ${body.outcome}.`, body.responseSummary?.trim()].filter(Boolean).join(' '),
    }),
  addNote: (code: string, body: AddNoteRequest) => act(code, 'notes', { text: body.body }),

  staff: async (): Promise<StaffMember[]> => (await get('/users', z.array(rawStaff))).map(toStaff),
  staffMember: async (id: string): Promise<StaffMember> =>
    toStaff(await get(`/users/${staffId(id)}`, rawStaff)),
  async createStaff(body: CreateStaffRequest): Promise<StaffWithPassword> {
    noAreas(body.areaIds);
    const res = await apiRequest('/users', rawStaffWithPassword, {
      method: 'POST',
      body: { username: body.username, full_name: body.fullName, email: body.email, role: body.role },
    });
    peopleCache = null;
    return toStaffWithPassword(res);
  },
  async updateStaff(id: string, body: UpdateStaffRequest): Promise<StaffMember> {
    noAreas(body.areaIds);
    const res = await apiRequest(`/users/${staffId(id)}`, rawStaff, {
      method: 'PATCH',
      body: { full_name: body.fullName, email: body.email, role: body.role },
    });
    peopleCache = null;
    return toStaff(res);
  },
  deactivateStaff: async (id: string): Promise<StaffMember> =>
    toStaff(await apiRequest(`/users/${staffId(id)}/deactivate`, rawStaff, { method: 'POST' })),
  reactivateStaff: async (id: string): Promise<StaffMember> =>
    toStaff(await apiRequest(`/users/${staffId(id)}/reactivate`, rawStaff, { method: 'POST' })),
  resetStaffPassword: async (id: string): Promise<StaffWithPassword> =>
    toStaffWithPassword(
      await apiRequest(`/users/${staffId(id)}/reset-password`, rawStaffWithPassword, { method: 'POST' }),
    ),
};

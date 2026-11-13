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
  type RoomRequest,
  type ResidentRequest,
  type ArchiveRequest,
  type CameraRequest,
  type CameraSettings,
  type CameraTestResult,
  type StaffMember,
  type StaffWithPassword,
  type UpdateStaffRequest,
  type DashboardSummary,
  type Incident,
  type FacilitySettings,
  type IncidentDetail,
  type SettingsSection,
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
} from '../schemas';
import { ApiError, apiBlob, apiConfig, apiRequest } from './client';

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
  is_archived: z.boolean(),
});
type RawResident = z.infer<typeof rawResident>;

const rawCamera = z.object({
  id: z.number(),
  name: z.string(),
  room_id: z.number().nullable(),
  detection_enabled: z.boolean(),
});
type RawCamera = z.infer<typeof rawCamera>;

const rawCameraSettings = z.object({
  id: z.number(),
  name: z.string(),
  source: z.string(),
  room_id: z.number().nullable(),
  place: z.enum(['room', 'bathroom']),
  privacy_blur: z.enum(['off', 'person', 'whole']),
  detection_enabled: z.boolean(),
});

const toCameraSettings = (c: z.infer<typeof rawCameraSettings>): CameraSettings => ({
  id: String(c.id),
  code: c.name,
  source: c.source,
  roomId: c.room_id === null ? null : String(c.room_id),
  place: c.place,
  privacyBlur: c.privacy_blur,
  detectionEnabled: c.detection_enabled,
});

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
  /** Made with the test alarm button. Older backends don't send it. */
  is_test: z.boolean().optional(),
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

const cameraBody = (b: CameraRequest) => ({
  name: b.code,
  source: b.source,
  room_id: b.roomId === null ? null : numericId(b.roomId, 'room'),
  place: b.place,
  privacy_blur: b.privacyBlur,
  detection_enabled: b.detectionEnabled,
});

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

/** Backend paths start with /api; the configured base URL ends with that same /api, so paths here leave it out. */
function withToken(backendPath: string): string {
  const path = backendPath.startsWith('/api/') ? backendPath.slice(4) : backendPath;
  const { baseUrl, getToken } = apiConfig();
  const token = getToken() ?? '';
  return `${baseUrl}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
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
const residentsRaw = (archived = false) =>
  get(archived ? '/residents?archived=true' : '/residents', z.array(rawResident));
/**
 * Current and archived residents, to name the resident on an alert. Alerts keep the names of
 * the residents in the room at the time, so an archived resident's incidents still link to them.
 */
const everyResident = async () => (await Promise.all([residentsRaw(), residentsRaw(true)])).flat();
const alertsRaw = (query: string) => get(`/alerts?${query}`, z.array(rawAlert));

async function incidentsFrom(query: string, activeOnly: boolean): Promise<Incident[]> {
  const [alerts, staff, residents] = await Promise.all([alertsRaw(query), people(), everyResident()]);
  return alerts
    .map((a) => summary(toIncident(a, staff, residents)))
    .filter((i) => !activeOnly || isActiveStatus(i.status));
}

/** The backend sends at most this many alerts per page. */
const ALERT_PAGE = 500;

/** Every real (not test) alert detected from `from` (inclusive) to `to` (exclusive), page by page. */
async function incidentsBetween(from: string, to: string): Promise<Incident[]> {
  const range = `date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`;
  const alerts: RawAlert[] = [];
  for (let offset = 0; ; offset += ALERT_PAGE) {
    const page = await alertsRaw(`${range}&limit=${ALERT_PAGE}&offset=${offset}`);
    alerts.push(...page);
    if (page.length < ALERT_PAGE) break;
  }
  const [staff, residents] = await Promise.all([people(), everyResident()]);
  const toMs = Date.parse(to);
  return alerts
    .filter((a) => !a.is_test && Date.parse(isoUtc(a.detected_at)) < toMs) // the backend's date_to is inclusive
    .map((a) => summary(toIncident(a, staff, residents)));
}

async function incidentDetail(id: number): Promise<IncidentDetail> {
  const [alert, staff, residents] = await Promise.all([
    get(`/alerts/${id}`, rawAlert),
    people(),
    everyResident(),
  ]);
  return toIncident(alert, staff, residents);
}

async function act(code: string, action: string, body?: unknown): Promise<IncidentDetail> {
  const id = alertIdFromCode(code);
  const [alert, staff, residents] = await Promise.all([
    apiRequest(`/alerts/${id}/${action}`, rawAlert, { method: 'POST', ...(body !== undefined && { body }) }),
    people(),
    everyResident(),
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

/** A resident's profile. Fetches the rooms and incidents to fill in the room and alert state. */
async function toResidentDetail(r: RawResident): Promise<ResidentDetail> {
  const [roomList, incidents] = await Promise.all([rooms(), incidentsFrom('limit=500', false)]);
  return {
    ...toResident(r, roomList, incidents),
    sex: null,
    birthDate: null,
    mobilityAid: null,
    careNotes: r.notes || null,
    isArchived: r.is_archived,
    // The backend keeps one free-text contact; show it as is, without a phone button.
    emergencyContacts: r.emergency_contact
      ? [{ id: `${r.id}-contact`, fullName: r.emergency_contact, relationship: null, phone: '' }]
      : [],
  };
}

/**
 * What POST/PATCH /api/residents take. The backend keeps an age, one free-text emergency contact
 * and notes, so the screens only send those (serverFeatures.residentDetails).
 */
function residentBody(b: ResidentRequest) {
  if (b.sex !== null || b.birthDate !== null || b.mobilityAid !== null || b.caregiverIds.length > 0)
    throw notYet('Keeping sex, birth date, mobility aid and caregivers');
  const [contact, ...more] = b.emergencyContacts;
  if (more.length > 0 || (contact && contact.phone !== ''))
    throw notYet('Keeping several emergency contacts with phone numbers');
  return {
    full_name: b.fullName,
    age: b.age,
    risk_level: b.fallRisk,
    room_id: b.roomId === null ? null : numericId(b.roomId, 'room'),
    emergency_contact: contact?.fullName ?? '',
    notes: b.careNotes ?? '',
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
  // The backend has no activity log yet, but each alert records who acknowledged, classified and
  // resolved it, and when. Those are real staff actions, so the log is built from them.
  // Logins and changes to rooms, cameras, residents and users are not recorded anywhere yet.
  async activity(limit: number): Promise<ActivityEntry[]> {
    const [alerts, staff] = await Promise.all([alertsRaw(`limit=${ALERT_PAGE}`), people()]);
    const entries: ActivityEntry[] = [];
    for (const a of alerts) {
      const code = alertCode(a);
      const test = a.is_test ? ' (test alarm)' : '';
      const add = (
        id: string,
        by: number | null,
        at: string | null,
        action: ActivityEntry['action'],
        text: string,
      ) => {
        const user = person(staff, by);
        if (user && at)
          entries.push({
            id: `${a.id}-${id}`,
            user,
            summary: `${user.fullName} ${text.replace('#', code)}${test}`,
            createdAt: isoUtc(at),
            module: 'alerts',
            action,
            record: code,
          });
      };
      add('ack', a.acknowledged_by, a.acknowledged_at, 'acknowledged', 'acknowledged #');
      add(
        'classified',
        a.classified_by,
        a.classified_at,
        'classified',
        a.classification === 'false_alarm' ? 'marked # as a false alarm' : 'confirmed # as a fall',
      );
      if (a.classification !== 'false_alarm')
        add('resolved', a.resolved_by, a.resolved_at, 'resolved', 'resolved #');
    }
    return entries.toSorted((x, y) => Date.parse(y.createdAt) - Date.parse(x.createdAt)).slice(0, limit);
  },

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
        // The server only runs a camera while fall detection is on; otherwise it streams a grey card.
        liveUrl: c.detection_enabled ? withToken(`/cameras/${c.id}/stream`) : null,
        liveFormat: c.detection_enabled ? 'mjpeg' : null,
        status,
        detectionEnabled: c.detection_enabled,
        lastSeenAt: null,
        statusDetail: c.detection_enabled ? s?.error || null : null,
      };
    });
  },

  // Den's server sends its newest frame, with the login header (no token in the link).
  cameraPicture: async (id: string, signal?: AbortSignal) =>
    apiBlob(`/cameras/${numericId(id, 'camera')}/snapshot`, signal ? { signal } : {}),

  async residents(archived = false): Promise<Resident[]> {
    const [list, roomList, incidents] = await Promise.all([
      residentsRaw(archived),
      rooms(),
      incidentsFrom('limit=500', false),
    ]);
    return list.map((r) => toResident(r, roomList, incidents));
  },
  resident: async (id: string): Promise<ResidentDetail> =>
    toResidentDetail(await get(`/residents/${numericId(id, 'resident')}`, rawResident)),
  createResident: async (body: ResidentRequest): Promise<ResidentDetail> =>
    toResidentDetail(
      await apiRequest('/residents', rawResident, { method: 'POST', body: residentBody(body) }),
    ),
  updateResident: async (id: string, body: ResidentRequest): Promise<ResidentDetail> =>
    toResidentDetail(
      await apiRequest(`/residents/${numericId(id, 'resident')}`, rawResident, {
        method: 'PATCH',
        body: residentBody(body),
      }),
    ),
  async archiveResident(id: string, body: ArchiveRequest | null): Promise<ResidentDetail> {
    if (body !== null) throw notYet('Keeping the reason a resident was archived');
    return toResidentDetail(
      await apiRequest(`/residents/${numericId(id, 'resident')}/archive`, rawResident, { method: 'POST' }),
    );
  },
  restoreResident: async (id: string): Promise<ResidentDetail> =>
    toResidentDetail(
      await apiRequest(`/residents/${numericId(id, 'resident')}/restore`, rawResident, { method: 'POST' }),
    ),
  rooms: async (): Promise<RoomRef[]> => (await rooms()).map(toRoom),
  cameraSettings: async (id: string): Promise<CameraSettings> =>
    toCameraSettings(await get(`/cameras/${numericId(id, 'camera')}`, rawCameraSettings)),
  createCamera: async (body: CameraRequest): Promise<CameraSettings> =>
    toCameraSettings(
      await apiRequest('/cameras', rawCameraSettings, { method: 'POST', body: cameraBody(body) }),
    ),
  updateCamera: async (id: string, body: CameraRequest): Promise<CameraSettings> =>
    toCameraSettings(
      await apiRequest(`/cameras/${numericId(id, 'camera')}`, rawCameraSettings, {
        method: 'PATCH',
        body: cameraBody(body),
      }),
    ),
  deleteCamera: async (id: string) => {
    await apiRequest(`/cameras/${numericId(id, 'camera')}`, z.null(), { method: 'DELETE' });
  },
  // The backend takes the source as a query parameter.
  testCameraSource: async (source: string): Promise<CameraTestResult> => {
    const res = await apiRequest(
      `/cameras/test?source=${encodeURIComponent(source)}`,
      z.object({ width: z.number(), height: z.number() }),
      { method: 'POST' },
    );
    return { width: res.width, height: res.height };
  },
  createRoom: async (body: RoomRequest): Promise<RoomRef> =>
    toRoom(
      await apiRequest('/rooms', rawRoom, {
        method: 'POST',
        body: { name: body.name, area: body.wing ?? '' },
      }),
    ),
  updateRoom: async (id: string, body: RoomRequest): Promise<RoomRef> =>
    toRoom(
      await apiRequest(`/rooms/${numericId(id, 'room')}`, rawRoom, {
        method: 'PATCH',
        body: { name: body.name, area: body.wing ?? '' },
      }),
    ),
  deleteRoom: async (id: string) => {
    await apiRequest(`/rooms/${numericId(id, 'room')}`, z.null(), { method: 'DELETE' });
  },

  activeIncidents: () => incidentsFrom('active=true&limit=200', true),
  incidents: (limit = 50) => incidentsFrom(`limit=${limit}`, false),
  incidentsBetween,
  incident: (code: string) => incidentDetail(alertIdFromCode(code)),
  // Den's backend keeps its settings in config.py, with no route to read or change them.
  settings: async (): Promise<FacilitySettings> => {
    throw notYet('Settings');
  },
  saveSettings: async (_section: SettingsSection, _body: unknown): Promise<FacilitySettings> => {
    throw notYet('Saving settings');
  },
  sendSos: async (_body: unknown): Promise<IncidentDetail> => {
    throw notYet('Sending an SOS');
  },
  cancelSos: async (_code: string, _body: unknown): Promise<IncidentDetail> => {
    throw notYet('Cancelling an SOS');
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
    toStaff(await get(`/users/${numericId(id, 'user')}`, rawStaff)),
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
    const res = await apiRequest(`/users/${numericId(id, 'user')}`, rawStaff, {
      method: 'PATCH',
      body: { full_name: body.fullName, email: body.email, role: body.role },
    });
    peopleCache = null;
    return toStaff(res);
  },
  deactivateStaff: async (id: string): Promise<StaffMember> =>
    toStaff(await apiRequest(`/users/${numericId(id, 'user')}/deactivate`, rawStaff, { method: 'POST' })),
  reactivateStaff: async (id: string): Promise<StaffMember> =>
    toStaff(await apiRequest(`/users/${numericId(id, 'user')}/reactivate`, rawStaff, { method: 'POST' })),
  resetStaffPassword: async (id: string): Promise<StaffWithPassword> =>
    toStaffWithPassword(
      await apiRequest(`/users/${numericId(id, 'user')}/reset-password`, rawStaffWithPassword, {
        method: 'POST',
      }),
    ),
};

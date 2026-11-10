/**
 * In-memory "database" for the fake API. It starts from the sample data in
 * @elderguard/shared/fixtures and changes as you use the app (acknowledge,
 * resolve, ...). Reloading the page starts over.
 */
import {
  isActiveStatus,
  type Camera,
  type Resident,
  type RoomRef,
  type SosRequest,
  type ResidentDetail,
  type User,
  type DashboardSummary,
  type Incident,
  type IncidentDetail,
  type IncidentEvent,
} from '@elderguard/shared';
import {
  createSeed,
  DEMO_PASSWORD,
  type Seed,
  type SeedResident,
  type SeedUser,
} from '@elderguard/shared/fixtures';

let seed: Seed = createSeed();
/** Passwords people changed during this session (everyone else uses the demo password). */
let passwords = new Map<string, string>();
let ids = 1000;
const nextId = (prefix: string) => `${prefix}-${++ids}`;

export function resetDb(now: Date = new Date()) {
  seed = createSeed(now);
  passwords = new Map();
}

function nextIncidentCode() {
  const year = new Date().getFullYear();
  const highest = Math.max(0, ...seed.incidents.map((i) => Number(i.code.split('-').at(-1)) || 0));
  return `INC-${year}-${String(highest + 1).padStart(4, '0')}`;
}

/**
 * A resident as the list returns it. Only incidents this user can open count towards
 * hasActiveAlert and lastIncidentAt, so they never point at a page the user cannot see.
 */
function toResident(user: SeedUser, r: SeedResident): Resident {
  const theirs = seed.incidents.filter((i) => i.resident?.id === r.id && db.canSeeRoom(user, i.room.id));
  const room = seed.rooms.find((x) => x.id === r.roomId) ?? null;
  const latest = theirs.toSorted((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt))[0];
  return {
    id: r.id,
    fullName: r.fullName,
    age: r.age,
    fallRisk: r.fallRisk,
    room: room ? { id: room.id, name: room.name, wing: room.wing } : null,
    caregivers: r.caregiverIds.flatMap((id) => {
      const u = seed.users.find((x) => x.id === id);
      return u ? [{ id: u.id, fullName: u.fullName }] : [];
    }),
    hasActiveAlert: theirs.some((i) => isActiveStatus(i.status)),
    lastIncidentAt: latest?.detectedAt ?? null,
  };
}

export const db = {
  get facilityName() {
    return seed.facilityName;
  },

  findUserByLogin(login: string): SeedUser | undefined {
    const key = login.trim().toLowerCase();
    return seed.users.find((u) => u.username === key || u.email.toLowerCase() === key);
  },
  checkPassword(user: SeedUser, password: string): boolean {
    return password === (passwords.get(user.id) ?? DEMO_PASSWORD);
  },

  changePassword(user: SeedUser, password: string) {
    passwords.set(user.id, password);
    user.mustChangePassword = false;
  },

  findUserById(id: string) {
    return seed.users.find((u) => u.id === id);
  },

  /** The user as the API returns it (no password status, areas expanded). */
  toPublicUser({ status: _s, areaIds, ...user }: SeedUser): User {
    const areas = areaIds.flatMap((id) => {
      const room = seed.rooms.find((r) => r.id === id);
      return room ? [{ id: room.id, name: room.name, wing: room.wing }] : [];
    });
    return { ...user, areas };
  },

  /**
   * Which rooms a user may see. null = everything (Admin/Head).
   * Caregivers see only their assigned rooms/areas (AREA_ASSIGNMENT in the ERD).
   */
  visibleRoomIds(user: SeedUser): ReadonlySet<string> | null {
    return user.role === 'admin' ? null : new Set(user.areaIds);
  },

  canSeeRoom(user: SeedUser, roomId: string | null): boolean {
    const visible = db.visibleRoomIds(user);
    return visible === null || (roomId !== null && visible.has(roomId));
  },

  listIncidents(user: SeedUser, scope: 'active' | 'all', limit = 50): Incident[] {
    return seed.incidents
      .filter((i) => db.canSeeRoom(user, i.room.id))
      .filter((i) => scope === 'all' || isActiveStatus(i.status))
      .toSorted((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt))
      .slice(0, limit)
      .map(({ events: _e, notes: _n, ...incident }) => incident);
  },

  /** Returns the incident only if this user may see it (otherwise behaves as "not found"). */
  getIncident(user: SeedUser, code: string): IncidentDetail | undefined {
    const incident = seed.incidents.find((i) => i.code === code);
    return incident && db.canSeeRoom(user, incident.room.id) ? incident : undefined;
  },

  updateIncident(code: string, change: (i: IncidentDetail) => void): IncidentDetail | undefined {
    const incident = seed.incidents.find((i) => i.code === code);
    if (incident) change(incident);
    return incident;
  },

  addEvent(
    incident: IncidentDetail,
    action: IncidentEvent['action'],
    user: SeedUser | null,
    detail: string | null = null,
  ) {
    incident.events.push({
      id: nextId('ev'),
      action,
      occurredAt: new Date().toISOString(),
      user: user ? { id: user.id, fullName: user.fullName } : null,
      detail,
    });
  },

  addActivity(user: SeedUser, summary: string) {
    seed.activity.unshift({
      id: nextId('act'),
      user: { id: user.id, fullName: user.fullName },
      summary,
      createdAt: new Date().toISOString(),
    });
  },

  listActivity(limit: number) {
    return seed.activity.slice(0, limit);
  },

  listCameras(user: SeedUser): Camera[] {
    return seed.cameras.filter((c) => db.canSeeRoom(user, c.roomId));
  },

  listResidents(user: SeedUser): Resident[] {
    return seed.residents.filter((r) => db.canSeeRoom(user, r.roomId)).map((r) => toResident(user, r));
  },

  /** Returns the resident only if this user may see them (otherwise behaves as "not found"). */
  getResident(user: SeedUser, id: string): ResidentDetail | undefined {
    const r = seed.residents.find((x) => x.id === id);
    if (!r || !db.canSeeRoom(user, r.roomId)) return undefined;
    return {
      ...toResident(user, r),
      sex: r.sex,
      birthDate: r.birthDate,
      mobilityAid: r.mobilityAid,
      careNotes: r.careNotes,
      emergencyContacts: r.emergencyContacts,
    };
  },

  /**
   * Creates a new fall alert, like the camera system would. Used by "Simulate fall".
   * Picks a resident the given user can see, so the alert shows up for them.
   */
  simulateFall(user: SeedUser): IncidentDetail {
    const mine = seed.residents.filter((r) => db.canSeeRoom(user, r.roomId));
    const residents = mine.length > 0 ? mine : seed.residents;
    const resident = residents[Math.floor(Math.random() * residents.length)]!;
    const room = seed.rooms.find((r) => r.id === resident.roomId)!;
    const camera = seed.cameras.find((c) => c.roomName === room.name) ?? null;
    const code = nextIncidentCode();
    const confidence = Math.round((0.7 + Math.random() * 0.28) * 100) / 100;
    const now = new Date().toISOString();
    const incident: IncidentDetail = {
      code,
      type: 'fall',
      status: 'new',
      resident: {
        id: resident.id,
        fullName: resident.fullName,
        age: resident.age,
        fallRisk: resident.fallRisk,
      },
      room: { id: room.id, name: room.name, wing: room.wing },
      camera: camera ? { id: camera.id, code: camera.code } : null,
      sentBy: null,
      confidence,
      snapshotUrl: null,
      clipUrl: null,
      detectedAt: now,
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      escalatedAt: null,
      falseAlarmReason: null,
      outcome: null,
      events: [
        {
          id: nextId('ev'),
          action: 'detected',
          occurredAt: now,
          user: null,
          detail: `${camera?.code ?? 'Camera'} · confidence ${Math.round(confidence * 100)}%`,
        },
      ],
      notes: [],
    };
    seed.incidents.push(incident);
    return incident;
  },

  /** Rooms and areas this user may see (all for the Admin/Head), in building order. */
  listRooms(user: SeedUser): RoomRef[] {
    return seed.rooms
      .filter((r) => db.canSeeRoom(user, r.id))
      .map((r) => ({ id: r.id, name: r.name, wing: r.wing }));
  },

  /** SOS-01. Returns undefined when the room (or resident) is not one this user may see. */
  sendSos(user: SeedUser, req: SosRequest): IncidentDetail | undefined {
    const room = seed.rooms.find((r) => r.id === req.roomId);
    if (!room || !db.canSeeRoom(user, room.id)) return undefined;
    const resident = req.residentId ? seed.residents.find((r) => r.id === req.residentId) : undefined;
    if (req.residentId && (!resident || !db.canSeeRoom(user, resident.roomId))) return undefined;
    const now = new Date().toISOString();
    const by = { id: user.id, fullName: user.fullName };
    const incident: IncidentDetail = {
      code: nextIncidentCode(),
      type: 'sos',
      status: 'new',
      resident: resident
        ? { id: resident.id, fullName: resident.fullName, age: resident.age, fallRisk: resident.fallRisk }
        : null,
      room: { id: room.id, name: room.name, wing: room.wing },
      camera: null,
      sentBy: by,
      confidence: null,
      snapshotUrl: null,
      clipUrl: null,
      detectedAt: now,
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      escalatedAt: null,
      falseAlarmReason: null,
      outcome: null,
      events: [
        {
          id: nextId('ev'),
          action: 'detected',
          occurredAt: now,
          user: by,
          detail: `SOS sent from ${room.name}`,
        },
      ],
      notes: req.note ? [{ id: nextId('note'), body: req.note, author: by, createdAt: now }] : [],
    };
    seed.incidents.push(incident);
    db.addActivity(user, `${user.fullName} sent an SOS from ${room.name}`);
    return incident;
  },

  addNote(incident: IncidentDetail, author: SeedUser, body: string) {
    incident.notes.push({
      id: nextId('note'),
      body,
      author: { id: author.id, fullName: author.fullName },
      createdAt: new Date().toISOString(),
    });
  },

  dashboardSummary(now: Date = new Date()): DashboardSummary {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const incidents = seed.incidents;
    const active = incidents.filter((i) => isActiveStatus(i.status));
    const today = incidents.filter((i) => Date.parse(i.detectedAt) >= startOfToday.getTime());
    const weekAgo = now.getTime() - 7 * 24 * 3600_000;
    const lastWeek = incidents.filter((i) => Date.parse(i.detectedAt) >= weekAgo);
    const acked = incidents.filter((i) => i.acknowledgedAt);
    const cams = seed.cameras;
    const count = (s: string) => cams.filter((c) => c.status === s).length;

    const fallsToday = today.filter((i) => i.type === 'fall').length;
    const fallsThisWeek = [...seed.fallHistory, fallsToday].map((count, idx, arr) => {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - (arr.length - 1 - idx));
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { date, count };
    });

    return {
      facilityName: seed.facilityName,
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
      residentsMonitored: seed.residents.length,
      falseAlarmRate7d:
        lastWeek.length === 0
          ? null
          : lastWeek.filter((i) => i.status === 'false_alarm').length / lastWeek.length,
      avgAckSeconds:
        acked.length === 0
          ? null
          : acked.reduce(
              (sum, i) => sum + (Date.parse(i.acknowledgedAt!) - Date.parse(i.detectedAt)) / 1000,
              0,
            ) / acked.length,
      fallsThisWeek,
    };
  },
};

/**
 * In-memory "database" for the fake API. It starts from the sample data in
 * @elderguard/shared/fixtures and changes as you use the app (acknowledge,
 * resolve, ...). Reloading the page starts over.
 */
import {
  isActiveStatus,
  type DashboardSummary,
  type Incident,
  type IncidentDetail,
  type IncidentEvent,
} from '@elderguard/shared';
import { createSeed, type Seed, type SeedUser } from '@elderguard/shared/fixtures';

let seed: Seed = createSeed();
let ids = 1000;
const nextId = (prefix: string) => `${prefix}-${++ids}`;

export function resetDb(now: Date = new Date()) {
  seed = createSeed(now);
}

export const db = {
  get facilityName() {
    return seed.facilityName;
  },

  findUserByLogin(login: string): SeedUser | undefined {
    const key = login.trim().toLowerCase();
    return seed.users.find((u) => u.username === key || u.email.toLowerCase() === key);
  },
  findUserById(id: string) {
    return seed.users.find((u) => u.id === id);
  },

  listIncidents(scope: 'active' | 'all', limit = 50): Incident[] {
    return seed.incidents
      .filter((i) => scope === 'all' || isActiveStatus(i.status))
      .toSorted((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt))
      .slice(0, limit)
      .map(({ events: _e, notes: _n, ...incident }) => incident);
  },

  getIncident(code: string): IncidentDetail | undefined {
    return seed.incidents.find((i) => i.code === code);
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

  listCameras() {
    return seed.cameras;
  },

  /** Creates a new fall alert, like the camera system would. Used by "Simulate fall". */
  simulateFall(): IncidentDetail {
    const residents = seed.residents;
    const resident = residents[Math.floor(Math.random() * residents.length)]!;
    const room = seed.rooms.find((r) => r.id === resident.roomId)!;
    const camera = seed.cameras.find((c) => c.roomName === room.name) ?? null;
    const year = new Date().getFullYear();
    const highest = Math.max(...seed.incidents.map((i) => Number(i.code.split('-').at(-1)) || 0));
    const code = `INC-${year}-${String(highest + 1).padStart(4, '0')}`;
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

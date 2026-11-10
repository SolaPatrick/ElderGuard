/**
 * Sample data that matches the Figma mockups ("Demo Home for the Aged").
 * Used by the fake API (web/src/mocks) and by tests until the real backend is ready.
 *
 * Times are generated relative to `now`, so the "elapsed" timers and the
 * "today" counts always look like the mockups no matter when you run the app.
 */
import type {
  ActivityEntry,
  ArchiveReason,
  Camera,
  EmergencyContact,
  FallRisk,
  IncidentDetail,
  IncidentEvent,
  Sex,
  User,
} from '../schemas';

/** Demo password for every sample account (fake API only, never a real password). */
export const DEMO_PASSWORD = 'elderguard123';

export interface SeedUser extends Omit<User, 'areas'> {
  status: 'active' | 'deactivated';
  lastLoginAt: string | null;
  createdAt: string;
  /** Rooms and areas this caregiver monitors (AREA_ASSIGNMENT). Empty for the Admin/Head, who sees everything. */
  areaIds: string[];
}

export interface SeedResident {
  id: string;
  fullName: string;
  age: number;
  fallRisk: FallRisk;
  roomId: string;
  caregiverIds: string[];
  sex: Sex;
  /** ISO date, chosen so the resident is exactly `age` today. */
  birthDate: string;
  mobilityAid: string | null;
  careNotes: string | null;
  emergencyContacts: EmergencyContact[];
  /** Set when the resident moved out or was transferred (RES-07). */
  archived: { reason: ArchiveReason; note: string | null } | null;
}

export interface SeedRoom {
  id: string;
  name: string;
  wing: string | null;
}

export interface Seed {
  facilityName: string;
  users: SeedUser[];
  rooms: SeedRoom[];
  residents: SeedResident[];
  cameras: Camera[];
  incidents: IncidentDetail[];
  activity: ActivityEntry[];
  /** Fall counts for the 6 days before today (oldest first); today's count is computed from incidents. */
  fallHistory: number[];
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function createSeed(now: Date = new Date()): Seed {
  const t = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString();

  const users: SeedUser[] = [
    {
      id: 'u-teresa',
      fullName: 'Ma. Teresa Reyes',
      username: 'teresa.reyes',
      email: 'teresa.reyes@demohome.example',
      role: 'admin',
      title: 'Admin/Head',
      mustChangePassword: false,
      status: 'active',
      lastLoginAt: t(2 * HOUR),
      createdAt: t(300 * DAY),
      areaIds: [],
    },
    {
      id: 'u-joel',
      fullName: 'Joel Ramos',
      username: 'joel.ramos',
      email: 'joel.ramos@demohome.example',
      role: 'employee',
      title: 'Caregiver',
      mustChangePassword: false,
      status: 'active',
      lastLoginAt: t(40 * MIN),
      createdAt: t(160 * DAY),
      areaIds: ['r-101', 'r-102', 'r-103'],
    },
    {
      id: 'u-angelica',
      fullName: 'Angelica Cruz',
      username: 'angelica.cruz',
      email: 'angelica.cruz@demohome.example',
      role: 'employee',
      title: 'Caregiver',
      mustChangePassword: false,
      status: 'active',
      lastLoginAt: t(70 * MIN),
      createdAt: t(120 * DAY),
      areaIds: ['r-dining', 'r-activity'],
    },
    {
      id: 'u-mark',
      fullName: 'Mark Dizon',
      username: 'mark.dizon',
      email: 'mark.dizon@demohome.example',
      role: 'employee',
      title: 'Caregiver',
      mustChangePassword: false,
      status: 'active',
      lastLoginAt: t(105 * MIN),
      createdAt: t(150 * DAY),
      areaIds: ['r-104', 'r-105', 'r-106', 'r-hall-a', 'r-hall-b', 'r-garden'],
    },
    {
      id: 'u-liza',
      fullName: 'Liza Fernandez',
      username: 'liza.fernandez',
      email: 'liza.fernandez@demohome.example',
      role: 'employee',
      title: 'Caregiver',
      mustChangePassword: false,
      status: 'deactivated',
      lastLoginAt: t(68 * DAY),
      createdAt: t(240 * DAY),
      areaIds: [],
    },
  ];

  const rooms: SeedRoom[] = [
    { id: 'r-101', name: 'Room 101', wing: 'East Wing' },
    { id: 'r-102', name: 'Room 102', wing: 'East Wing' },
    { id: 'r-103', name: 'Room 103', wing: 'East Wing' },
    { id: 'r-104', name: 'Room 104', wing: 'West Wing' },
    { id: 'r-105', name: 'Room 105', wing: 'West Wing' },
    { id: 'r-106', name: 'Room 106', wing: 'West Wing' },
    { id: 'r-hall-a', name: 'Hallway A', wing: null },
    { id: 'r-hall-b', name: 'Hallway B', wing: null },
    { id: 'r-dining', name: 'Dining Hall', wing: null },
    { id: 'r-activity', name: 'Activity Area', wing: null },
    { id: 'r-garden', name: 'Garden Walkway', wing: null },
    { id: 'r-lobby', name: 'Lobby', wing: null },
  ];

  /** Birth date (YYYY-MM-DD) on month-day `md` that makes someone `age` years old on `now`. */
  const born = (age: number, md: string) => {
    const [m, d] = md.split('-').map(Number) as [number, number];
    const hadBirthday = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
    return `${now.getFullYear() - age - (hadBirthday ? 0 : 1)}-${md}`;
  };

  const residents: SeedResident[] = [
    {
      id: 'res-remedios',
      fullName: 'Remedios Santos',
      age: 84,
      fallRisk: 'high',
      roomId: 'r-101',
      caregiverIds: ['u-joel'],
      sex: 'female',
      birthDate: born(84, '03-12'),
      mobilityAid: 'Walker',
      careNotes: 'Needs help standing up at night. Previous fall in August 2026.',
      archived: null,
      emergencyContacts: [
        { id: 'ec-remedios-1', fullName: 'Maricel Santos', relationship: 'Daughter', phone: '0918 555 0172' },
      ],
    },
    {
      id: 'res-lourdes',
      fullName: 'Lourdes Aquino',
      age: 85,
      fallRisk: 'moderate',
      roomId: 'r-101',
      caregiverIds: ['u-joel'],
      sex: 'female',
      birthDate: born(85, '07-04'),
      mobilityAid: 'Cane',
      careNotes: 'Prefers to walk with a companion to the dining hall.',
      archived: null,
      emergencyContacts: [
        { id: 'ec-lourdes-1', fullName: 'Ramon Aquino', relationship: 'Son', phone: '0917 555 0148' },
      ],
    },
    {
      id: 'res-ernesto',
      fullName: 'Ernesto Villanueva',
      age: 79,
      fallRisk: 'moderate',
      roomId: 'r-102',
      caregiverIds: ['u-joel'],
      sex: 'male',
      birthDate: born(79, '01-22'),
      mobilityAid: null,
      careNotes: 'Takes blood pressure medicine in the morning; may feel dizzy after.',
      archived: null,
      emergencyContacts: [
        {
          id: 'ec-ernesto-1',
          fullName: 'Grace Villanueva',
          relationship: 'Daughter',
          phone: '0920 555 0133',
        },
      ],
    },
    {
      id: 'res-corazon',
      fullName: 'Corazon Mendoza',
      age: 88,
      fallRisk: 'high',
      roomId: 'r-103',
      caregiverIds: ['u-joel'],
      sex: 'female',
      birthDate: born(88, '11-30'),
      mobilityAid: 'Wheelchair',
      careNotes: 'Transfers from bed to wheelchair need two staff.',
      archived: null,
      emergencyContacts: [
        { id: 'ec-corazon-1', fullName: 'Teodoro Mendoza', relationship: 'Son', phone: '0915 555 0190' },
        {
          id: 'ec-corazon-2',
          fullName: 'Liza Mendoza',
          relationship: 'Granddaughter',
          phone: '0927 555 0111',
        },
      ],
    },
    {
      id: 'res-rodolfo',
      fullName: 'Rodolfo Garcia',
      age: 76,
      fallRisk: 'low',
      roomId: 'r-104',
      caregiverIds: ['u-mark'],
      sex: 'male',
      birthDate: born(76, '05-17'),
      mobilityAid: null,
      careNotes: null,
      archived: null,
      emergencyContacts: [
        { id: 'ec-rodolfo-1', fullName: 'Elena Garcia', relationship: 'Wife', phone: '0918 555 0125' },
      ],
    },
    {
      id: 'res-felicidad',
      fullName: 'Felicidad Bautista',
      age: 91,
      fallRisk: 'high',
      roomId: 'r-105',
      caregiverIds: ['u-mark', 'u-angelica'],
      sex: 'female',
      birthDate: born(91, '09-08'),
      mobilityAid: 'Walker',
      careNotes: 'Hard of hearing; speak clearly and face her.',
      archived: null,
      emergencyContacts: [
        { id: 'ec-felicidad-1', fullName: 'Jose Bautista', relationship: 'Nephew', phone: '0919 555 0164' },
      ],
    },
    {
      id: 'res-antonio',
      fullName: 'Antonio Navarro',
      age: 82,
      fallRisk: 'moderate',
      roomId: 'r-106',
      caregiverIds: ['u-mark', 'u-angelica'],
      sex: 'male',
      birthDate: born(82, '02-14'),
      mobilityAid: 'Cane',
      careNotes: null,
      archived: null,
      emergencyContacts: [
        { id: 'ec-antonio-1', fullName: 'Carmela Navarro', relationship: 'Daughter', phone: '0916 555 0157' },
      ],
    },
    {
      id: 'res-benjamin',
      fullName: 'Benjamin Torres',
      age: 80,
      fallRisk: 'low',
      roomId: 'r-106',
      caregiverIds: ['u-mark'],
      sex: 'male',
      birthDate: born(80, '08-25'),
      mobilityAid: null,
      careNotes: null,
      archived: null,
      emergencyContacts: [],
    },
  ];

  const cam = (n: number, roomId: string, status: Camera['status'] = 'online'): Camera => ({
    id: `cam-${String(n).padStart(2, '0')}`,
    code: `CAM-${String(n).padStart(2, '0')}`,
    roomId,
    roomName: rooms.find((r) => r.id === roomId)!.name,
    roomWing: rooms.find((r) => r.id === roomId)!.wing,
    resolutionFps: '1080p · 15 FPS',
    liveUrl: null,
    liveFormat: null,
    status,
    detectionEnabled: status !== 'paused',
    lastSeenAt: status === 'offline' ? t(25 * MIN) : t(5_000),
  });
  const cameras: Camera[] = [
    cam(1, 'r-101'),
    cam(2, 'r-102'),
    cam(3, 'r-103'),
    cam(4, 'r-104'),
    cam(5, 'r-105'),
    cam(6, 'r-106'),
    cam(7, 'r-hall-b', 'offline'),
    cam(8, 'r-dining'),
    cam(9, 'r-garden', 'paused'),
    cam(10, 'r-hall-a'),
    cam(11, 'r-lobby'),
  ];

  const person = (id: string) => {
    const u = users.find((x) => x.id === id) ?? residents.find((x) => x.id === id);
    if (!u) throw new Error(`Unknown person ${id}`);
    return { id: u.id, fullName: u.fullName };
  };
  const resident = (id: string) => {
    const r = residents.find((x) => x.id === id);
    if (!r) throw new Error(`Unknown resident ${id}`);
    return { id: r.id, fullName: r.fullName, age: r.age, fallRisk: r.fallRisk };
  };
  const room = (id: string) => {
    const r = rooms.find((x) => x.id === id);
    if (!r) throw new Error(`Unknown room ${id}`);
    return { id: r.id, name: r.name, wing: r.wing };
  };
  const camera = (n: number) => {
    const c = cameras[n - 1]!;
    return { id: c.id, code: c.code };
  };

  let eventId = 0;
  const ev = (
    action: IncidentEvent['action'],
    occurredAt: string,
    userId: string | null = null,
    detail: string | null = null,
  ): IncidentEvent => ({
    id: `ev-${++eventId}`,
    action,
    occurredAt,
    user: userId ? person(userId) : null,
    detail,
  });

  const base = {
    camera: null,
    sentBy: null,
    confidence: null,
    snapshotUrl: null,
    clipUrl: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    escalatedAt: null,
    falseAlarmReason: null,
    outcome: null,
    notes: [],
  } satisfies Partial<IncidentDetail>;

  const incidents: IncidentDetail[] = [
    {
      ...base,
      code: 'INC-2026-0142',
      type: 'fall',
      status: 'new',
      resident: resident('res-remedios'),
      room: room('r-101'),
      camera: camera(1),
      confidence: 0.87,
      detectedAt: t(3 * MIN + 12_000),
      events: [ev('detected', t(3 * MIN + 12_000), null, 'CAM-01 · confidence 87%')],
    },
    {
      ...base,
      code: 'INC-2026-0141',
      type: 'sos',
      status: 'acknowledged',
      resident: resident('res-lourdes'),
      room: room('r-dining'),
      sentBy: person('u-angelica'),
      detectedAt: t(6 * MIN + 40_000),
      acknowledgedAt: t(5 * MIN + 52_000),
      acknowledgedBy: person('u-mark'),
      events: [
        ev('detected', t(6 * MIN + 40_000), 'u-angelica', 'SOS sent from Dining Hall'),
        ev('acknowledged', t(5 * MIN + 52_000), 'u-mark'),
      ],
    },
    {
      ...base,
      code: 'INC-2026-0140',
      type: 'fall',
      status: 'resolved',
      resident: resident('res-felicidad'),
      room: room('r-105'),
      camera: camera(5),
      confidence: 0.92,
      detectedAt: t(55 * MIN),
      acknowledgedAt: t(54 * MIN),
      acknowledgedBy: person('u-mark'),
      escalatedAt: t(52 * MIN),
      resolvedAt: t(39 * MIN),
      resolvedBy: person('u-mark'),
      outcome: 'Assisted, no injury',
      events: [
        ev('detected', t(55 * MIN), null, 'CAM-05 · confidence 92%'),
        ev('acknowledged', t(54 * MIN), 'u-mark'),
        ev('escalated', t(52 * MIN), null, 'Escalated to Admin/Head'),
        ev('classified', t(50 * MIN), 'u-mark', 'Confirmed fall'),
        ev('resolved', t(39 * MIN), 'u-mark', 'Assisted, no injury'),
      ],
    },
    {
      ...base,
      code: 'INC-2026-0139',
      type: 'fall',
      status: 'false_alarm',
      resident: resident('res-rodolfo'),
      room: room('r-104'),
      camera: camera(4),
      confidence: 0.64,
      detectedAt: t(3 * HOUR + 20 * MIN),
      acknowledgedAt: t(3 * HOUR + 19 * MIN),
      acknowledgedBy: person('u-mark'),
      resolvedAt: t(3 * HOUR + 17 * MIN),
      resolvedBy: person('u-mark'),
      falseAlarmReason: 'Resident sat down on the floor intentionally',
      events: [
        ev('detected', t(3 * HOUR + 20 * MIN), null, 'CAM-04 · confidence 64%'),
        ev('acknowledged', t(3 * HOUR + 19 * MIN), 'u-mark'),
        ev('classified', t(3 * HOUR + 17 * MIN), 'u-mark', 'False alarm'),
      ],
    },
    {
      ...base,
      code: 'INC-2026-0138',
      type: 'fall',
      status: 'resolved',
      resident: resident('res-ernesto'),
      room: room('r-102'),
      camera: camera(2),
      confidence: 0.9,
      detectedAt: t(5 * HOUR + 35 * MIN),
      acknowledgedAt: t(5 * HOUR + 33 * MIN + 50_000),
      acknowledgedBy: person('u-joel'),
      resolvedAt: t(5 * HOUR + 20 * MIN),
      resolvedBy: person('u-joel'),
      outcome: 'Assisted, minor bruise',
      events: [
        ev('detected', t(5 * HOUR + 35 * MIN), null, 'CAM-02 · confidence 90%'),
        ev('acknowledged', t(5 * HOUR + 33 * MIN + 50_000), 'u-joel'),
        ev('classified', t(5 * HOUR + 30 * MIN), 'u-joel', 'Confirmed fall'),
        ev('resolved', t(5 * HOUR + 20 * MIN), 'u-joel', 'Assisted, minor bruise'),
      ],
    },
    {
      ...base,
      code: 'INC-2026-0137',
      type: 'fall',
      status: 'resolved',
      resident: resident('res-antonio'),
      room: room('r-106'),
      camera: camera(6),
      confidence: 0.88,
      detectedAt: t(24 * HOUR),
      acknowledgedAt: t(24 * HOUR - MIN),
      acknowledgedBy: person('u-angelica'),
      resolvedAt: t(23 * HOUR),
      resolvedBy: person('u-angelica'),
      outcome: 'Assisted, no injury',
      events: [
        ev('detected', t(24 * HOUR), null, 'CAM-06 · confidence 88%'),
        ev('acknowledged', t(24 * HOUR - MIN), 'u-angelica'),
        ev('classified', t(24 * HOUR - 3 * MIN), 'u-angelica', 'Confirmed fall'),
        ev('resolved', t(23 * HOUR), 'u-angelica', 'Assisted, no injury'),
      ],
    },
    {
      ...base,
      code: 'INC-2026-0136',
      type: 'fall',
      status: 'false_alarm',
      resident: resident('res-lourdes'),
      room: room('r-101'),
      camera: camera(1),
      confidence: 0.58,
      detectedAt: t(29 * HOUR),
      acknowledgedAt: t(29 * HOUR - 52_000),
      acknowledgedBy: person('u-joel'),
      resolvedAt: t(29 * HOUR - 4 * MIN),
      resolvedBy: person('u-joel'),
      falseAlarmReason: 'Object dropped on the floor',
      events: [
        ev('detected', t(29 * HOUR), null, 'CAM-01 · confidence 58%'),
        ev('acknowledged', t(29 * HOUR - 52_000), 'u-joel'),
        ev('classified', t(29 * HOUR - 4 * MIN), 'u-joel', 'False alarm'),
      ],
    },
    {
      ...base,
      code: 'INC-2026-0135',
      type: 'sos',
      status: 'resolved',
      resident: null,
      room: room('r-garden'),
      sentBy: person('u-mark'),
      detectedAt: t(50 * HOUR),
      acknowledgedAt: t(50 * HOUR - MIN),
      acknowledgedBy: person('u-teresa'),
      resolvedAt: t(49 * HOUR),
      resolvedBy: person('u-teresa'),
      outcome: 'Assistance given',
      events: [
        ev('detected', t(50 * HOUR), 'u-mark', 'SOS sent from Garden Walkway'),
        ev('acknowledged', t(50 * HOUR - MIN), 'u-teresa'),
        ev('resolved', t(49 * HOUR), 'u-teresa', 'Assistance given'),
      ],
    },
  ];

  const activity: ActivityEntry[] = [
    {
      id: 'act-3',
      user: person('u-mark'),
      summary: 'Mark Dizon resolved INC-2026-0140',
      createdAt: t(39 * MIN),
    },
    { id: 'act-2', user: person('u-joel'), summary: 'Joel Ramos logged in', createdAt: t(46 * MIN) },
    {
      id: 'act-1',
      user: person('u-teresa'),
      summary: 'Ma. Teresa Reyes paused CAM-09',
      createdAt: t(3 * HOUR + 36 * MIN),
    },
  ];

  return {
    facilityName: 'Demo Home for the Aged',
    users,
    rooms,
    residents,
    cameras,
    incidents,
    activity,
    fallHistory: [3, 1, 4, 0, 3, 1],
  };
}

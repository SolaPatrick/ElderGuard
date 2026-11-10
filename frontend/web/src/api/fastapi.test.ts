import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/node';
import { tokenStorage } from '../auth/tokenStorage';
import { ApiError } from './client';
import { alertCode, alertIdFromCode, fastApi, isoUtc } from './fastapi';

/** Responses shaped exactly like the FastAPI backend in backend/app. */
const rawUser = {
  id: 7,
  username: 'joel',
  full_name: 'Joel Ramos',
  email: null,
  role: 'employee',
  is_active: true,
  must_change_password: false,
  created_at: '2026-11-01T08:00:00',
};
const rawAlert = (over: Record<string, unknown> = {}) => ({
  id: 12,
  camera_id: 3,
  room_id: 5,
  fall_type: 'FALL FROM BED',
  confidence: 0.87,
  is_test: false,
  snapshot: null,
  status: 'new',
  detected_at: '2026-11-09T03:41:08.123456',
  acknowledged_at: null,
  acknowledged_by: null,
  classification: null,
  false_alarm_reason: null,
  classified_at: null,
  classified_by: null,
  resolved_at: null,
  resolved_by: null,
  camera_name: 'CAM-01',
  room_name: 'Room 101',
  area: 'East Wing',
  residents: ['Remedios Santos'],
  snapshot_url: null,
  notes: [],
  ...over,
});
const rawResident = {
  id: 4,
  full_name: 'Remedios Santos',
  age: 84,
  risk_level: 'high',
  room_id: 5,
  emergency_contact: 'Maricel Santos (daughter) 0918 555 0172',
  notes: 'Needs help standing up at night.',
  is_archived: false,
  created_at: '2026-11-01T08:00:00',
};
const rawRoom = { id: 5, name: 'Room 101', area: 'East Wing' };

function backend(extra: Parameters<typeof server.use> = []) {
  server.use(
    ...extra,
    http.get('/api/users', () =>
      HttpResponse.json({ detail: 'Only an admin can do this.' }, { status: 403 }),
    ),
    http.get('/api/residents', () => HttpResponse.json([rawResident])),
    http.get('/api/rooms', () => HttpResponse.json([rawRoom])),
  );
}

beforeEach(() => tokenStorage.set('jwt-abc', false));

describe('FastAPI adapter: names and codes', () => {
  it('turns alert ids into incident codes and back', () => {
    expect(alertCode({ id: 12, detected_at: '2026-11-09T03:41:08' })).toBe('INC-2026-0012');
    expect(alertIdFromCode('INC-2026-0012')).toBe(12);
    expect(() => alertIdFromCode('12; DROP TABLE')).toThrow(ApiError);
  });

  it('reads times without a time zone as UTC', () => {
    expect(isoUtc('2026-11-09T03:41:08.123456')).toBe('2026-11-09T03:41:08.123Z');
    expect(isoUtc('2026-11-09T11:41:08+08:00')).toBe('2026-11-09T03:41:08.000Z');
  });
});

describe('FastAPI adapter: requests', () => {
  it('logs in with a form and maps the user', async () => {
    let sent = '';
    let type = '';
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        type = request.headers.get('Content-Type') ?? '';
        sent = await request.text();
        return HttpResponse.json({ access_token: 'jwt-1', token_type: 'bearer', user: rawUser });
      }),
    );
    const res = await fastApi.login({ username: 'joel', password: 'p@ss word' });
    expect(type).toBe('application/x-www-form-urlencoded');
    expect(new URLSearchParams(sent).get('password')).toBe('p@ss word');
    expect(res.token).toBe('jwt-1');
    expect(res.user).toMatchObject({
      id: '7',
      fullName: 'Joel Ramos',
      role: 'employee',
      title: 'Caregiver',
      email: null,
    });
  });

  it('shows the backend error message from "detail"', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ detail: 'Wrong username or password.' }, { status: 401 }),
      ),
    );
    await expect(fastApi.login({ username: 'x', password: 'y' })).rejects.toMatchObject({
      status: 401,
      message: 'Wrong username or password.',
    });
  });

  it('maps alerts to incidents, with the resident looked up by name', async () => {
    let query = '';
    backend([
      http.get('/api/alerts', ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json([
          rawAlert(),
          rawAlert({
            id: 13,
            status: 'classified',
            classification: 'false_alarm',
            classified_at: '2026-11-09T03:45:00',
            false_alarm_reason: 'sitting_down',
          }),
        ]);
      }),
    ]);
    const active = await fastApi.activeIncidents();
    expect(query).toContain('active=true');
    // A false alarm is closed in the app even before the backend resolves it.
    expect(active.map((i) => i.code)).toEqual(['INC-2026-0012']);
    expect(active[0]).toMatchObject({
      type: 'fall',
      status: 'new',
      room: { id: '5', name: 'Room 101', wing: 'East Wing' },
      camera: { id: '3', code: 'CAM-01' },
      resident: { id: '4', fullName: 'Remedios Santos', age: 84, fallRisk: 'high' },
      detectedAt: '2026-11-09T03:41:08.123Z',
    });

    const all = await fastApi.incidents();
    expect(all[1]).toMatchObject({
      status: 'false_alarm',
      falseAlarmReason: 'Resident sat or lay down on purpose',
    });
  });

  it('classifies a false alarm and then closes it on the backend', async () => {
    const calls: { path: string; body: unknown }[] = [];
    backend([
      http.post('/api/alerts/:id/:action', async ({ request, params }) => {
        calls.push({ path: `${String(params.id)}/${String(params.action)}`, body: await request.json() });
        return HttpResponse.json(
          rawAlert({
            status: params.action === 'resolve' ? 'resolved' : 'classified',
            classification: 'false_alarm',
            classified_at: '2026-11-09T03:45:00',
            false_alarm_reason: 'other',
          }),
        );
      }),
    ]);
    const result = await fastApi.classify('INC-2026-0012', {
      classification: 'false_alarm',
      falseAlarmReason: 'Staff or visitor in view',
    });
    expect(calls).toEqual([
      {
        path: '12/classify',
        body: {
          classification: 'false_alarm',
          false_alarm_reason: 'other',
          note: 'Staff or visitor in view',
        },
      },
      { path: '12/resolve', body: { text: '' } },
    ]);
    expect(result.status).toBe('false_alarm');
    expect(result.resolvedAt).not.toBeNull();
  });

  it('sends the outcome as the resolve note', async () => {
    let body: unknown;
    backend([
      http.post('/api/alerts/12/resolve', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(rawAlert({ status: 'resolved', classification: 'confirmed' }));
      }),
    ]);
    await fastApi.resolve('INC-2026-0012', {
      outcome: 'Assisted, no injury',
      responseSummary: 'Helped back to bed.',
    });
    expect(body).toEqual({ text: 'Outcome: Assisted, no injury. Helped back to bed.' });
  });

  it('gives cameras an MJPEG live link with the login token', async () => {
    backend([
      http.get('/api/cameras', () =>
        HttpResponse.json([
          {
            id: 3,
            name: 'CAM-01',
            source: '',
            room_id: 5,
            place: 'room',
            privacy_blur: 'off',
            detection_enabled: true,
            created_at: '2026-11-01T08:00:00',
          },
          {
            id: 4,
            name: 'CAM-02',
            source: '',
            room_id: null,
            place: 'room',
            privacy_blur: 'off',
            detection_enabled: true,
            created_at: '2026-11-01T08:00:00',
          },
          {
            id: 5,
            name: 'CAM-03',
            source: '0',
            room_id: null,
            place: 'room',
            privacy_blur: 'off',
            detection_enabled: false,
            created_at: '2026-11-01T08:00:00',
          },
        ]),
      ),
      http.get('/api/cameras/status', () =>
        HttpResponse.json([
          { name: 'CAM-01', camera_id: 3, online: true, fps: 9.8, error: null },
          { name: 'CAM-02', camera_id: 4, online: false, fps: 0, error: 'Cannot open the camera' },
        ]),
      ),
    ]);
    const [cam1, cam2, cam3] = await fastApi.cameras();
    expect(cam1).toMatchObject({
      code: 'CAM-01',
      roomName: 'Room 101',
      roomWing: 'East Wing',
      status: 'online',
      liveFormat: 'mjpeg',
      liveUrl: '/api/cameras/3/stream?token=jwt-abc',
    });
    expect(cam2).toMatchObject({ status: 'error', roomName: null });
    // The server only runs a camera while detection is on; otherwise its stream is a grey card.
    expect(cam3).toMatchObject({ status: 'paused', liveUrl: null, liveFormat: null });
  });

  it('downloads the newest picture with the login header, not a token in the link', async () => {
    let seen: { auth: string | null; url: string } | null = null;
    backend([
      http.get('/api/cameras/:id/snapshot', ({ request }) => {
        seen = { auth: request.headers.get('Authorization'), url: request.url };
        return new HttpResponse(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }),
    ]);
    const picture = await fastApi.cameraPicture('3');
    expect(picture).toMatchObject({ size: 4, type: 'image/jpeg' });
    expect(seen).toEqual({ auth: 'Bearer jwt-abc', url: 'http://localhost:3000/api/cameras/3/snapshot' });
    await expect(fastApi.cameraPicture('CAM-01')).rejects.toMatchObject({ status: 404 });
  });

  it('shows the free-text emergency contact without a phone number', async () => {
    backend([
      http.get('/api/residents/4', () => HttpResponse.json(rawResident)),
      http.get('/api/alerts', () => HttpResponse.json([rawAlert()])),
    ]);
    const r = await fastApi.resident('4');
    expect(r).toMatchObject({
      fullName: 'Remedios Santos',
      careNotes: 'Needs help standing up at night.',
      hasActiveAlert: true,
      emergencyContacts: [{ fullName: 'Maricel Santos (daughter) 0918 555 0172', phone: '' }],
    });
  });

  it('names no resident when several were in the room', async () => {
    backend([
      http.get('/api/alerts', () =>
        HttpResponse.json([rawAlert({ residents: ['Lourdes Aquino', 'Remedios Santos'] })]),
      ),
    ]);
    const [incident] = await fastApi.activeIncidents();
    expect(incident!.resident).toBeNull();
  });

  it('says clearly that SOS is not on the server yet', async () => {
    await expect(fastApi.sendSos({})).rejects.toMatchObject({ status: 501 });
  });
});

describe('FastAPI adapter: staff accounts', () => {
  const rawStaff = { ...rawUser, is_active: true };

  it('maps users, with no last login or areas the backend does not have', async () => {
    server.use(
      http.get('/api/users', () => HttpResponse.json([rawStaff, { ...rawStaff, id: 8, is_active: false }])),
    );
    const [joel, other] = await fastApi.staff();
    expect(joel).toEqual({
      id: '7',
      fullName: 'Joel Ramos',
      username: 'joel',
      email: null,
      role: 'employee',
      title: 'Caregiver',
      isActive: true,
      mustChangePassword: false,
      areas: [],
      lastLoginAt: null,
      createdAt: '2026-11-01T08:00:00.000Z',
    });
    expect(other!.isActive).toBe(false);
  });

  it('creates a user with snake_case fields and returns the temporary password', async () => {
    let body: unknown;
    server.use(
      http.post('/api/users', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user: rawStaff, temporary_password: 'Tmp-123456' }, { status: 201 });
      }),
    );
    const res = await fastApi.createStaff({
      fullName: 'Joel Ramos',
      username: 'joel',
      email: null,
      role: 'employee',
      areaIds: [],
    });
    expect(body).toEqual({ username: 'joel', full_name: 'Joel Ramos', email: null, role: 'employee' });
    expect(res.temporaryPassword).toBe('Tmp-123456');
    expect(res.user.id).toBe('7');
  });

  it('refuses room assignments instead of dropping them', async () => {
    await expect(
      fastApi.updateStaff('7', { fullName: 'Joel', email: null, role: 'employee', areaIds: ['5'] }),
    ).rejects.toMatchObject({ status: 501 });
  });

  it('calls the deactivate, reactivate and reset-password routes', async () => {
    const paths: string[] = [];
    server.use(
      http.post('/api/users/:id/:action', ({ params }) => {
        paths.push(`${String(params.id)}/${String(params.action)}`);
        return params.action === 'reset-password'
          ? HttpResponse.json({ user: rawStaff, temporary_password: 'New-123456' })
          : HttpResponse.json({ ...rawStaff, is_active: params.action === 'reactivate' });
      }),
    );
    expect((await fastApi.deactivateStaff('7')).isActive).toBe(false);
    expect((await fastApi.reactivateStaff('7')).isActive).toBe(true);
    expect((await fastApi.resetStaffPassword('7')).temporaryPassword).toBe('New-123456');
    expect(paths).toEqual(['7/deactivate', '7/reactivate', '7/reset-password']);
  });

  it('treats a non-numeric user id as not found', async () => {
    await expect(fastApi.staffMember('u-joel')).rejects.toMatchObject({ status: 404 });
  });
});

describe('FastAPI adapter: rooms', () => {
  it('sends the wing as "area" (empty for none) and deletes with no response body', async () => {
    const calls: { method: string; path: string; body: unknown }[] = [];
    server.use(
      http.post('/api/rooms', async ({ request }) => {
        calls.push({ method: 'POST', path: '/rooms', body: await request.json() });
        return HttpResponse.json({ id: 9, name: 'Lobby', area: '' }, { status: 201 });
      }),
      http.patch('/api/rooms/:id', async ({ request, params }) => {
        calls.push({ method: 'PATCH', path: `/rooms/${String(params.id)}`, body: await request.json() });
        return HttpResponse.json({ id: 9, name: 'Room 107', area: 'West Wing' });
      }),
      http.delete('/api/rooms/:id', ({ params }) => {
        calls.push({ method: 'DELETE', path: `/rooms/${String(params.id)}`, body: null });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    expect(await fastApi.createRoom({ name: 'Lobby', wing: null })).toEqual({
      id: '9',
      name: 'Lobby',
      wing: null,
    });
    expect(await fastApi.updateRoom('9', { name: 'Room 107', wing: 'West Wing' })).toEqual({
      id: '9',
      name: 'Room 107',
      wing: 'West Wing',
    });
    await fastApi.deleteRoom('9');
    expect(calls).toEqual([
      { method: 'POST', path: '/rooms', body: { name: 'Lobby', area: '' } },
      { method: 'PATCH', path: '/rooms/9', body: { name: 'Room 107', area: 'West Wing' } },
      { method: 'DELETE', path: '/rooms/9', body: null },
    ]);
  });
});

describe('FastAPI adapter: camera setup', () => {
  const raw = {
    id: 3,
    name: 'CAM-01',
    source: 'rtsp://cam/1',
    room_id: 5,
    place: 'room',
    privacy_blur: 'person',
    detection_enabled: true,
    created_at: '2026-11-01T08:00:00',
  };

  it('reads and saves camera settings with the backend names', async () => {
    let sent: unknown;
    server.use(
      http.get('/api/cameras/3', () => HttpResponse.json(raw)),
      http.patch('/api/cameras/3', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...raw, room_id: null, place: 'bathroom', privacy_blur: 'whole' });
      }),
    );
    expect(await fastApi.cameraSettings('3')).toEqual({
      id: '3',
      code: 'CAM-01',
      source: 'rtsp://cam/1',
      roomId: '5',
      place: 'room',
      privacyBlur: 'person',
      detectionEnabled: true,
    });
    const saved = await fastApi.updateCamera('3', {
      code: 'CAM-01',
      source: 'rtsp://cam/1',
      roomId: null,
      place: 'bathroom',
      privacyBlur: 'whole',
      detectionEnabled: true,
    });
    expect(sent).toEqual({
      name: 'CAM-01',
      source: 'rtsp://cam/1',
      room_id: null,
      place: 'bathroom',
      privacy_blur: 'whole',
      detection_enabled: true,
    });
    expect(saved).toMatchObject({ roomId: null, privacyBlur: 'whole' });
  });

  it('sends the connection test source as a query parameter', async () => {
    let query = '';
    server.use(
      http.post('/api/cameras/test', ({ request }) => {
        query = new URL(request.url).searchParams.get('source') ?? '';
        return HttpResponse.json({ ok: true, width: 1280, height: 720 });
      }),
    );
    expect(await fastApi.testCameraSource('rtsp://a b/1?x=1')).toEqual({ width: 1280, height: 720 });
    expect(query).toBe('rtsp://a b/1?x=1');
  });
});

describe('FastAPI adapter: resident editing', () => {
  const basic = {
    fullName: 'Benjamin Torres',
    sex: null,
    birthDate: null,
    age: 80,
    roomId: '5',
    fallRisk: 'low' as const,
    mobilityAid: null,
    careNotes: 'Walks with a cane.',
    emergencyContacts: [{ fullName: 'Carlo Torres (son) 0917 555 0134', relationship: null, phone: '' }],
    caregiverIds: [],
  };

  it('creates and updates a resident with the backend names', async () => {
    const sent: unknown[] = [];
    const saved = { ...rawResident, id: 9, full_name: 'Benjamin Torres', age: 80, risk_level: 'low' };
    backend([
      http.get('/api/alerts', () => HttpResponse.json([])),
      http.post('/api/residents', async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json(saved, { status: 201 });
      }),
      http.patch('/api/residents/9', async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ ...saved, room_id: null });
      }),
    ]);
    const created = await fastApi.createResident(basic);
    expect(sent[0]).toEqual({
      full_name: 'Benjamin Torres',
      age: 80,
      risk_level: 'low',
      room_id: 5,
      emergency_contact: 'Carlo Torres (son) 0917 555 0134',
      notes: 'Walks with a cane.',
    });
    expect(created).toMatchObject({ id: '9', fullName: 'Benjamin Torres', isArchived: false });
    expect(created.room).toEqual({ id: '5', name: 'Room 101', wing: 'East Wing' });

    await fastApi.updateResident('9', { ...basic, roomId: null, emergencyContacts: [], careNotes: null });
    expect(sent[1]).toMatchObject({ room_id: null, emergency_contact: '', notes: '' });
  });

  it('refuses details the backend does not keep instead of dropping them', async () => {
    await expect(fastApi.createResident({ ...basic, sex: 'male' })).rejects.toMatchObject({ status: 501 });
    await expect(fastApi.createResident({ ...basic, caregiverIds: ['7'] })).rejects.toMatchObject({
      status: 501,
    });
    await expect(
      fastApi.createResident({
        ...basic,
        emergencyContacts: [{ fullName: 'Carlo Torres', relationship: 'Son', phone: '09175550134' }],
      }),
    ).rejects.toMatchObject({ status: 501 });
    await expect(fastApi.archiveResident('4', { reason: 'moved_out', note: null })).rejects.toMatchObject({
      status: 501,
    });
  });

  it('archives and restores with no body, and lists archived residents', async () => {
    const calls: string[] = [];
    backend([
      http.get('/api/alerts', () => HttpResponse.json([])),
      http.post('/api/residents/4/archive', async ({ request }) => {
        calls.push(`archive:${await request.text()}`);
        return HttpResponse.json({ ...rawResident, is_archived: true });
      }),
      http.post('/api/residents/4/restore', () => {
        calls.push('restore');
        return HttpResponse.json(rawResident);
      }),
      http.get('/api/residents', ({ request }) => {
        const archived = new URL(request.url).searchParams.get('archived') === 'true';
        return HttpResponse.json(archived ? [{ ...rawResident, id: 8, full_name: 'Former' }] : [rawResident]);
      }),
    ]);
    expect((await fastApi.archiveResident('4', null)).isArchived).toBe(true);
    expect((await fastApi.restoreResident('4')).isArchived).toBe(false);
    expect(calls).toEqual(['archive:', 'restore']);
    expect((await fastApi.residents(true)).map((r) => r.fullName)).toEqual(['Former']);
  });

  it('still names an archived resident on their past alerts', async () => {
    backend([
      http.get('/api/alerts/12', () => HttpResponse.json(rawAlert({ residents: ['Former'] }))),
      http.get('/api/residents', ({ request }) => {
        const archived = new URL(request.url).searchParams.get('archived') === 'true';
        return HttpResponse.json(archived ? [{ ...rawResident, id: 8, full_name: 'Former' }] : [rawResident]);
      }),
    ]);
    const incident = await fastApi.incident('INC-2026-0012');
    expect(incident.resident).toMatchObject({ id: '8', fullName: 'Former' });
  });
});

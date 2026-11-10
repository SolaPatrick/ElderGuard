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
      email: '',
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
        ]),
      ),
      http.get('/api/cameras/status', () =>
        HttpResponse.json([
          { name: 'CAM-01', camera_id: 3, online: true, fps: 9.8, error: null },
          { name: 'CAM-02', camera_id: 4, online: false, fps: 0, error: 'Cannot open the camera' },
        ]),
      ),
    ]);
    const [cam1, cam2] = await fastApi.cameras();
    expect(cam1).toMatchObject({
      code: 'CAM-01',
      roomName: 'Room 101',
      roomWing: 'East Wing',
      status: 'online',
      liveFormat: 'mjpeg',
      liveUrl: '/api/cameras/3/stream?token=jwt-abc',
    });
    expect(cam2).toMatchObject({ status: 'error', roomName: null });
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

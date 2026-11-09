import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../api/config';

/** Calls the fake API directly, as a given sample user. */
async function call(userId: string, path: string, method = 'GET') {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer mock-token:${userId}` },
  });
  return { status: res.status, body: (await res.json()) as unknown };
}

describe('What each role can see (AREA_ASSIGNMENT)', () => {
  it('gives the Admin/Head every active alert', async () => {
    const { body } = await call('u-teresa', '/incidents?scope=active');
    expect((body as { code: string }[]).map((i) => i.code).sort()).toEqual([
      'INC-2026-0141',
      'INC-2026-0142',
    ]);
  });

  it('gives a caregiver only alerts in their rooms', async () => {
    const { body } = await call('u-joel', '/incidents?scope=active');
    expect((body as { code: string }[]).map((i) => i.code)).toEqual(['INC-2026-0142']);
  });

  it('limits a caregiver history to their rooms', async () => {
    const { body } = await call('u-joel', '/incidents?scope=all');
    const rooms = new Set((body as { room: { name: string } }[]).map((i) => i.room.name));
    expect([...rooms].sort()).toEqual(['Room 101', 'Room 102']);
  });

  it('hides other areas from caregivers as "not found", even by direct link', async () => {
    expect((await call('u-joel', '/incidents/INC-2026-0141')).status).toBe(404);
    expect((await call('u-joel', '/incidents/INC-2026-0141/acknowledge', 'POST')).status).toBe(404);
  });

  it('gives a caregiver only their cameras and residents', async () => {
    const cams = (await call('u-joel', '/cameras')).body as { code: string }[];
    expect(cams.map((c) => c.code)).toEqual(['CAM-01', 'CAM-02', 'CAM-03']);
    const residents = (await call('u-joel', '/residents')).body as { fullName: string }[];
    expect(residents.map((r) => r.fullName)).toEqual([
      'Remedios Santos',
      'Lourdes Aquino',
      'Ernesto Villanueva',
      'Corazon Mendoza',
    ]);
  });

  it('keeps facility-wide numbers and the activity log for the Admin/Head', async () => {
    expect((await call('u-joel', '/dashboard/summary')).status).toBe(403);
    expect((await call('u-joel', '/activity?limit=3')).status).toBe(403);
    expect((await call('u-teresa', '/dashboard/summary')).status).toBe(200);
  });

  it('includes the assigned areas in the signed-in user', async () => {
    const me = (await call('u-joel', '/auth/me')).body as { areas: { name: string }[] };
    expect(me.areas.map((a) => a.name)).toEqual(['Room 101', 'Room 102', 'Room 103']);
  });
});

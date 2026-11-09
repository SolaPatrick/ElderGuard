import { describe, expect, it } from 'vitest';
import { createSeed } from '../fixtures';
import { cameraSchema, incidentDetailSchema, activityEntrySchema } from '../schemas';

describe('sample data', () => {
  const seed = createSeed(new Date('2026-10-19T14:44:20+08:00'));

  it('matches the API contract, so the fake API cannot drift from the schemas', () => {
    for (const incident of seed.incidents) expect(() => incidentDetailSchema.parse(incident)).not.toThrow();
    for (const camera of seed.cameras) expect(() => cameraSchema.parse(camera)).not.toThrow();
    for (const entry of seed.activity) expect(() => activityEntrySchema.parse(entry)).not.toThrow();
  });

  it('matches the numbers shown in the mockups', () => {
    const active = seed.incidents.filter((i) => ['new', 'acknowledged', 'confirmed'].includes(i.status));
    expect(active).toHaveLength(2);
    expect(seed.cameras).toHaveLength(11);
    expect(seed.cameras.filter((c) => c.status === 'online')).toHaveLength(9);
    expect(seed.residents).toHaveLength(8);
  });

  it('uses unique incident codes', () => {
    const codes = seed.incidents.map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

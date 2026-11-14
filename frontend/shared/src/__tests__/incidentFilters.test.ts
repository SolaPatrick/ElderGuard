import { describe, expect, it } from 'vitest';
import type { Incident } from '../schemas';
import { UNKNOWN_STAFF_NAME, pickerOptions } from '../incidentFilters';

let n = 0;
function incident(overrides: Partial<Incident>): Incident {
  n += 1;
  return {
    code: `INC-2026-${String(n).padStart(4, '0')}`,
    type: 'fall',
    status: 'resolved',
    detectedAt: '2026-11-13T06:00:00.000Z',
    resident: null,
    room: { id: 'r-101', name: 'Room 101', wing: 'East Wing' },
    camera: null,
    sentBy: null,
    confidence: 0.9,
    snapshotUrl: null,
    clipUrl: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    escalatedAt: null,
    falseAlarmReason: null,
    outcome: null,
    ...overrides,
  };
}

describe('pickerOptions', () => {
  it('leaves out staff the server would not name, which nobody could tell apart', () => {
    const options = pickerOptions([
      incident({ resolvedBy: { id: '2', fullName: UNKNOWN_STAFF_NAME } }),
      incident({ resolvedBy: { id: '3', fullName: UNKNOWN_STAFF_NAME } }),
      incident({ acknowledgedBy: { id: '4', fullName: 'Joel Ramos' } }),
    ]);
    expect(options.staff).toEqual([{ id: '4', name: 'Joel Ramos' }]);
  });

  it('lists each room once, with its wing', () => {
    const options = pickerOptions([incident({}), incident({})]);
    expect(options.rooms).toEqual([{ id: 'r-101', name: 'Room 101 · East Wing' }]);
  });
});

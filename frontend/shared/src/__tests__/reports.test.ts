import { describe, expect, it } from 'vitest';
import type { Incident } from '../schemas';
import { isValidRange, lastDays, localDateString, reportStats } from '../reports';

/** Local time, so weekday/hour buckets don't depend on the machine's time zone. */
const at = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();
const plus = (iso: string, seconds: number) => new Date(Date.parse(iso) + seconds * 1000).toISOString();

let n = 0;
function incident(overrides: Partial<Incident> & Pick<Incident, 'detectedAt' | 'status'>): Incident {
  n += 1;
  return {
    code: `INC-2026-${String(n).padStart(4, '0')}`,
    type: 'fall',
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

const remedios = { id: 'res-1', fullName: 'Remedios Santos', age: 84, fallRisk: 'high' as const };

// Mon 2 Nov 2026 to Wed 4 Nov 2026
const range = { from: '2026-11-02', to: '2026-11-04' };
const monMorning = at('2026-11-02', '08:15:00');
const incidents: Incident[] = [
  incident({
    detectedAt: monMorning,
    status: 'resolved',
    resident: remedios,
    acknowledgedAt: plus(monMorning, 60),
    resolvedAt: plus(monMorning, 600),
  }),
  incident({ detectedAt: at('2026-11-02', '08:40:00'), status: 'confirmed', resident: remedios }),
  incident({
    detectedAt: at('2026-11-03', '22:05:00'),
    status: 'false_alarm',
    room: { id: 'r-hall', name: 'Hallway B', wing: null },
    acknowledgedAt: plus(at('2026-11-03', '22:05:00'), 120),
    falseAlarmReason: 'Object dropped on the floor',
  }),
  incident({
    detectedAt: at('2026-11-04', '23:59:00'),
    status: 'new',
    room: { id: 'r-hall', name: 'Hallway B', wing: null },
  }),
  incident({ detectedAt: at('2026-11-04', '12:00:00'), status: 'acknowledged', type: 'sos' }),
  // Outside the range on both sides
  incident({ detectedAt: at('2026-11-01', '23:59:00'), status: 'confirmed' }),
  incident({ detectedAt: at('2026-11-05', '00:00:00'), status: 'confirmed' }),
];

describe('reportStats', () => {
  const s = reportStats(incidents, range);

  it('counts only incidents detected inside the whole days of the range', () => {
    expect(s.totalAlerts).toBe(5);
    expect(s.confirmedFalls).toBe(2);
    expect(s.falseAlarms).toBe(1);
    expect(s.sosCount).toBe(1);
    expect(s.open).toBe(2);
  });

  it('works out the false alarm rate from classified alerts only', () => {
    expect(s.falseAlarmRate).toBeCloseTo(1 / 3);
  });

  it('averages acknowledge and resolve times where they exist', () => {
    expect(s.avgAckSeconds).toBe(90);
    expect(s.avgResolveSeconds).toBe(600);
  });

  it('groups falls (not false alarms, not SOS) by day, room, resident and hour', () => {
    expect(s.fallsByDay).toEqual([
      { date: '2026-11-02', count: 2 },
      { date: '2026-11-03', count: 0 },
      { date: '2026-11-04', count: 1 },
    ]);
    expect(s.fallsByLocation).toEqual([
      { label: 'Room 101', count: 2 },
      { label: 'Hallway B', count: 1 },
    ]);
    expect(s.fallsByResident).toEqual([{ label: 'Remedios Santos', count: 2 }]);
    expect(s.fallsByWeekdayHour[0]![8]).toBe(2); // Monday 8 AM
    expect(s.fallsByWeekdayHour[2]![23]).toBe(1); // Wednesday 11 PM
    expect(s.fallsByWeekdayHour.flat().reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('lists outcomes and false alarm reasons', () => {
    expect(s.outcomes).toEqual([
      { status: 'new', count: 1 },
      { status: 'acknowledged', count: 1 },
      { status: 'confirmed', count: 1 },
      { status: 'resolved', count: 1 },
      { status: 'false_alarm', count: 1 },
    ]);
    expect(s.falseAlarmReasons).toEqual([{ label: 'Object dropped on the floor', count: 1 }]);
  });

  it('has nothing to average in an empty range', () => {
    const empty = reportStats([], range);
    expect(empty.totalAlerts).toBe(0);
    expect(empty.falseAlarmRate).toBeNull();
    expect(empty.avgAckSeconds).toBeNull();
    expect(empty.avgResolveSeconds).toBeNull();
    expect(empty.fallsByDay).toHaveLength(3);
  });
});

describe('ranges', () => {
  it('makes the last N days end today', () => {
    expect(lastDays(7, new Date(2026, 10, 13, 15))).toEqual({ from: '2026-11-07', to: '2026-11-13' });
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('refuses an end before the start, or an empty date', () => {
    expect(isValidRange({ from: '2026-11-02', to: '2026-11-02' })).toBe(true);
    expect(isValidRange({ from: '2026-11-03', to: '2026-11-02' })).toBe(false);
    expect(isValidRange({ from: '', to: '2026-11-02' })).toBe(false);
  });
});

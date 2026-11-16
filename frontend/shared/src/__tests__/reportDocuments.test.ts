import { describe, expect, it } from 'vitest';
import type { Incident } from '../schemas';
import { buildReport, REPORT_TYPES, reportToCsv } from '../reportDocuments';

const at = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();
const plus = (iso: string, s: number) => new Date(Date.parse(iso) + s * 1000).toISOString();
const joel = { id: 'u-joel', fullName: 'Joel Ramos' };
const ana = { id: 'u-ana', fullName: 'Ana Reyes' };
const room101 = { id: 'r-101', name: 'Room 101', wing: 'East Wing' };
const hall = { id: 'r-hall', name: 'Hallway B', wing: null };

let n = 0;
function incident(o: Partial<Incident> & Pick<Incident, 'detectedAt' | 'status'>): Incident {
  n += 1;
  return {
    code: `INC-2026-${String(n).padStart(4, '0')}`,
    type: 'fall',
    resident: null,
    room: room101,
    camera: { id: '1', code: 'CAM-01' },
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
    ...o,
  };
}

const t1 = at('2026-11-02', '08:00:00');
const t2 = at('2026-11-03', '09:00:00');
const t3 = at('2026-11-03', '10:00:00');
const incidents = [
  incident({
    detectedAt: t1,
    status: 'resolved',
    resident: { id: 'res-1', fullName: 'Remedios Santos', age: 84, fallRisk: 'high' },
    acknowledgedAt: plus(t1, 60),
    acknowledgedBy: joel,
    resolvedAt: plus(t1, 600),
    resolvedBy: joel,
    outcome: 'Assisted, no injury',
  }),
  incident({
    detectedAt: t2,
    status: 'false_alarm',
    room: hall,
    acknowledgedAt: plus(t2, 30),
    acknowledgedBy: ana,
    resolvedAt: plus(t2, 90),
    resolvedBy: ana,
    falseAlarmReason: '=HYPERLINK("x")',
  }),
  incident({
    detectedAt: t3,
    status: 'acknowledged',
    type: 'sos',
    camera: null,
    sentBy: ana,
    acknowledgedAt: plus(t3, 20),
    acknowledgedBy: joel,
  }),
  incident({ detectedAt: at('2026-11-09', '10:00:00'), status: 'new' }),
];
const range = { from: '2026-11-02', to: '2026-11-03' };

describe('buildReport', () => {
  it('builds every report type without throwing', () => {
    for (const t of REPORT_TYPES) expect(buildReport(t.id, incidents, range).title).toBe(t.label);
  });

  it('lists every alert in the range, oldest first, in the incident summary', () => {
    const doc = buildReport('incident_summary', incidents, range);
    expect(doc.summary).toContainEqual(['Total alerts', '3']);
    expect(doc.tables[0]!.rows.map((r) => r[0])).toEqual(['INC-2026-0001', 'INC-2026-0002', 'INC-2026-0003']);
    expect(doc.tables[0]!.rows[0]![6]).toBe('Assisted, no injury');
  });

  it('can be limited to one room', () => {
    const doc = buildReport('incident_summary', incidents, range, 'r-hall');
    expect(doc.tables[0]!.rows.map((r) => r[0])).toEqual(['INC-2026-0002']);
  });

  it('groups falls by location and by known resident', () => {
    expect(buildReport('falls_by_location', incidents, range).tables[0]!.rows).toEqual([
      ['Room 101', 'East Wing', '1', '1', '0'],
      ['Hallway B', '', '0', '0', '1'],
    ]);
    expect(buildReport('falls_by_resident', incidents, range).tables[0]!.rows).toEqual([
      ['Remedios Santos', 'Room 101', '1', '1', '0'],
    ]);
  });

  it('works out response times and staff activity', () => {
    const rt = buildReport('response_times', incidents, range);
    expect(rt.summary).toContainEqual(['Slowest acknowledge', '1m 0s']);
    expect(rt.tables[0]!.rows[0]!.slice(3)).toEqual(['Joel Ramos', '1m 0s', 'Joel Ramos', '10m 0s']);
    expect(buildReport('staff_activity', incidents, range).tables[0]!.rows).toEqual([
      ['Joel Ramos', '2', '1', '0m 40s'],
      ['Ana Reyes', '1', '1', '0m 30s'],
    ]);
  });

  it('logs SOS with who sent it', () => {
    const rows = buildReport('sos_log', incidents, range).tables[0]!.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]![3]).toBe('Ana Reyes');
  });
});

describe('reportToCsv', () => {
  it('quotes commas and quotes, and stops spreadsheet formulas', () => {
    const csv = reportToCsv(buildReport('false_alarms', incidents, range), [['Facility', 'Home, East']]);
    expect(csv).toContain('"Home, East"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(csv.split('\r\n')[0]).toBe('False alarm analysis');
  });
});

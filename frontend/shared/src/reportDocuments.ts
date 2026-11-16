import { formatDate, formatShortDuration, formatTime, INCIDENT_STATUS_LABEL } from './format';
import { rangeBounds, reportStats, type ReportRange } from './reports';
import type { Incident } from './schemas';

/** RPT-02: the reports staff can generate. Camera uptime is missing: no backend keeps camera history. */
export const REPORT_TYPES = [
  {
    id: 'incident_summary',
    label: 'Incident summary',
    description: 'Every alert in the period, with key figures.',
  },
  {
    id: 'falls_by_resident',
    label: 'Falls by resident',
    description: 'Falls per resident, where the resident is known.',
  },
  { id: 'falls_by_location', label: 'Falls by location', description: 'Falls per room or area.' },
  {
    id: 'response_times',
    label: 'Response times',
    description: 'How fast each alert was acknowledged and resolved.',
  },
  { id: 'false_alarms', label: 'False alarm analysis', description: 'False alarms and their reasons.' },
  { id: 'sos_log', label: 'SOS log', description: 'Every SOS sent by staff.' },
  {
    id: 'staff_activity',
    label: 'Staff activity',
    description: 'Alerts each staff member acknowledged and closed.',
  },
] as const;
export type ReportType = (typeof REPORT_TYPES)[number]['id'];

export const isReportType = (v: string | null): v is ReportType => REPORT_TYPES.some((t) => t.id === v);

export interface ReportTable {
  title: string;
  columns: string[];
  rows: string[][];
  /** Shown instead of an empty table. */
  empty: string;
}

export interface ReportDocument {
  title: string;
  /** Key figures as label/value pairs. */
  summary: [string, string][];
  tables: ReportTable[];
}

/** "11 Nov 2026, 2:41 PM" */
const dateTime = (iso: string | null) => (iso === null ? '' : `${formatDate(iso)}, ${formatTime(iso)}`);

const secondsBetween = (from: string, to: string | null) =>
  to === null ? null : (Date.parse(to) - Date.parse(from)) / 1000;
const duration = (from: string, to: string | null) => {
  const s = secondsBetween(from, to);
  return s === null || s < 0 ? '' : formatShortDuration(s);
};
const percent = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);
const typeLabel = (i: Incident) => (i.type === 'sos' ? 'SOS' : 'Fall');
const isFall = (i: Incident) => i.type === 'fall' && i.status !== 'false_alarm';
const isConfirmed = (i: Incident) => i.status === 'confirmed' || i.status === 'resolved';

function groupRows(
  incidents: Incident[],
  key: (i: Incident) => string | null,
  extra: (i: Incident) => string = () => '',
): string[][] {
  const groups = new Map<string, Incident[]>();
  for (const i of incidents) {
    const k = key(i);
    if (k !== null) groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  return [...groups]
    .map(([name, list]) => ({ name, list, falls: list.filter(isFall).length }))
    .toSorted((a, b) => b.falls - a.falls || a.name.localeCompare(b.name))
    .map(({ name, list, falls }) => [
      name,
      extra(list[0]!),
      String(falls),
      String(list.filter((i) => i.type === 'fall' && isConfirmed(i)).length),
      String(list.filter((i) => i.status === 'false_alarm').length),
    ]);
}

/** Builds one report from the incidents detected in the range (and, if given, in one room). */
export function buildReport(
  type: ReportType,
  allIncidents: readonly Incident[],
  range: ReportRange,
  roomId: string | null = null,
): ReportDocument {
  const { start, end } = rangeBounds(range);
  const incidents = allIncidents
    .filter((i) => {
      const t = Date.parse(i.detectedAt);
      return t >= start.getTime() && t < end.getTime() && (roomId === null || i.room.id === roomId);
    })
    .toSorted((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt));
  const s = reportStats(incidents, range);
  const title = REPORT_TYPES.find((t) => t.id === type)!.label;
  const keyFigures: [string, string][] = [
    ['Total alerts', String(s.totalAlerts)],
    ['Confirmed falls', String(s.confirmedFalls)],
    ['False alarms', String(s.falseAlarms)],
    ['False alarm rate', percent(s.falseAlarmRate)],
    ['Avg time to acknowledge', formatShortDuration(s.avgAckSeconds)],
    ['Avg time to resolve', formatShortDuration(s.avgResolveSeconds)],
  ];

  switch (type) {
    case 'incident_summary':
      return {
        title,
        summary: [...keyFigures, ['SOS alerts', String(s.sosCount)]],
        tables: [
          {
            title: 'Alerts',
            columns: ['Incident', 'Detected', 'Type', 'Room', 'Resident', 'Status', 'Outcome or reason'],
            rows: incidents.map((i) => [
              i.code,
              dateTime(i.detectedAt),
              typeLabel(i),
              i.room.name,
              i.resident?.fullName ?? '',
              INCIDENT_STATUS_LABEL[i.status],
              i.outcome ?? i.falseAlarmReason ?? '',
            ]),
            empty: 'No alerts in this period.',
          },
        ],
      };
    case 'falls_by_resident':
      return {
        title,
        summary: [
          ['Falls', String(s.fallsByDay.reduce((a, d) => a + d.count, 0))],
          ['Residents with a fall', String(s.fallsByResident.length)],
        ],
        tables: [
          {
            title: 'Falls by resident (only where the resident is known)',
            columns: ['Resident', 'Room', 'Falls', 'Confirmed', 'False alarms'],
            rows: groupRows(
              incidents.filter((i) => i.type === 'fall'),
              (i) => i.resident?.fullName ?? null,
              (i) => i.room.name,
            ),
            empty: 'No falls with a known resident in this period.',
          },
        ],
      };
    case 'falls_by_location':
      return {
        title,
        summary: [
          ['Falls', String(s.fallsByDay.reduce((a, d) => a + d.count, 0))],
          ['Rooms with a fall', String(s.fallsByLocation.length)],
        ],
        tables: [
          {
            title: 'Falls by room or area',
            columns: ['Room', 'Wing', 'Falls', 'Confirmed', 'False alarms'],
            rows: groupRows(
              incidents.filter((i) => i.type === 'fall'),
              (i) => i.room.name,
              (i) => i.room.wing ?? '',
            ),
            empty: 'No fall alerts in this period.',
          },
        ],
      };
    case 'response_times': {
      const acks = incidents
        .map((i) => secondsBetween(i.detectedAt, i.acknowledgedAt))
        .filter((x): x is number => x !== null && x >= 0);
      return {
        title,
        summary: [
          ['Avg time to acknowledge', formatShortDuration(s.avgAckSeconds)],
          ['Slowest acknowledge', formatShortDuration(acks.length ? Math.max(...acks) : null)],
          ['Avg time to resolve', formatShortDuration(s.avgResolveSeconds)],
          ['Not acknowledged yet', String(incidents.filter((i) => !i.acknowledgedAt).length)],
        ],
        tables: [
          {
            title: 'Response per alert',
            columns: [
              'Incident',
              'Detected',
              'Room',
              'Acknowledged by',
              'Time to acknowledge',
              'Closed by',
              'Time to close',
            ],
            rows: incidents.map((i) => [
              i.code,
              dateTime(i.detectedAt),
              i.room.name,
              i.acknowledgedBy?.fullName ?? '',
              duration(i.detectedAt, i.acknowledgedAt),
              i.resolvedBy?.fullName ?? '',
              duration(i.detectedAt, i.resolvedAt),
            ]),
            empty: 'No alerts in this period.',
          },
        ],
      };
    }
    case 'false_alarms': {
      const falseAlarms = incidents.filter((i) => i.status === 'false_alarm');
      return {
        title,
        summary: [
          ['False alarms', String(s.falseAlarms)],
          ['False alarm rate', percent(s.falseAlarmRate)],
        ],
        tables: [
          {
            title: 'Reasons',
            columns: ['Reason', 'False alarms'],
            rows: s.falseAlarmReasons.map((r) => [r.label, String(r.count)]),
            empty: 'No false alarms in this period.',
          },
          {
            title: 'False alarms',
            columns: ['Incident', 'Detected', 'Room', 'Camera', 'Reason', 'Closed by'],
            rows: falseAlarms.map((i) => [
              i.code,
              dateTime(i.detectedAt),
              i.room.name,
              i.camera?.code ?? '',
              i.falseAlarmReason ?? '',
              i.resolvedBy?.fullName ?? '',
            ]),
            empty: 'No false alarms in this period.',
          },
        ],
      };
    }
    case 'sos_log': {
      const sos = incidents.filter((i) => i.type === 'sos');
      return {
        title,
        summary: [['SOS alerts', String(sos.length)]],
        tables: [
          {
            title: 'SOS alerts',
            columns: ['Incident', 'Sent', 'Room', 'Sent by', 'Resident', 'Status', 'Acknowledged by'],
            rows: sos.map((i) => [
              i.code,
              dateTime(i.detectedAt),
              i.room.name,
              i.sentBy?.fullName ?? '',
              i.resident?.fullName ?? '',
              INCIDENT_STATUS_LABEL[i.status],
              i.acknowledgedBy?.fullName ?? '',
            ]),
            empty: 'No SOS alerts in this period.',
          },
        ],
      };
    }
    case 'staff_activity': {
      const staff = new Map<string, { acked: number; closed: number; ackSeconds: number[] }>();
      const entry = (name: string) => {
        const e = staff.get(name) ?? { acked: 0, closed: 0, ackSeconds: [] };
        staff.set(name, e);
        return e;
      };
      for (const i of incidents) {
        if (i.acknowledgedBy) {
          const e = entry(i.acknowledgedBy.fullName);
          e.acked += 1;
          const sec = secondsBetween(i.detectedAt, i.acknowledgedAt);
          if (sec !== null && sec >= 0) e.ackSeconds.push(sec);
        }
        if (i.resolvedBy) entry(i.resolvedBy.fullName).closed += 1;
      }
      return {
        title,
        summary: [['Staff who responded', String(staff.size)]],
        tables: [
          {
            title: 'Alerts handled per staff member',
            columns: ['Staff member', 'Acknowledged', 'Closed', 'Avg time to acknowledge'],
            rows: [...staff]
              .toSorted((a, b) => b[1].acked - a[1].acked || a[0].localeCompare(b[0]))
              .map(([name, e]) => [
                name,
                String(e.acked),
                String(e.closed),
                formatShortDuration(
                  e.ackSeconds.length ? e.ackSeconds.reduce((a, b) => a + b, 0) / e.ackSeconds.length : null,
                ),
              ]),
            empty: 'No staff responses in this period.',
          },
        ],
      };
    }
  }
}

const csvCell = (v: string) =>
  /[",\n\r]/.test(v) || /^[=+\-@]/.test(v)
    ? `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`
    : v;

/**
 * CSV with the key figures, then each table under its title. Cells that start with = + - @
 * get a leading apostrophe so a spreadsheet does not run them as formulas.
 */
export function reportToCsv(doc: ReportDocument, header: [string, string][]): string {
  const lines: string[][] = [[doc.title], ...header, [], ...doc.summary];
  for (const t of doc.tables) {
    lines.push([], [t.title], t.columns, ...t.rows);
  }
  return lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

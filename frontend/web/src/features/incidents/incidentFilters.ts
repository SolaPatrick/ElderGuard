import {
  INCIDENT_STATUS_LABEL,
  formatDate,
  formatShortDuration,
  formatTime,
  incidentPersonName,
  incidentStatusSchema,
  incidentTypeSchema,
  secondsBetween,
  type Incident,
  type IncidentStatus,
  type IncidentType,
} from '@elderguard/shared';

export type DatePreset = 'today' | '7d' | '30d' | 'all' | 'custom';
export type Classification = 'confirmed' | 'false_alarm';

export const DATE_LABEL: Record<DatePreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
  custom: 'Custom range',
};
export const TYPE_LABEL: Record<IncidentType, string> = { fall: 'Fall', sos: 'SOS' };
export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  confirmed: 'Confirmed incident',
  false_alarm: 'False alarm',
};

/** Everything the incident history can be filtered by. Kept in the page link, so Back and shared links work. */
export interface IncidentFilters {
  search: string;
  date: DatePreset;
  /** YYYY-MM-DD, local days, both included. Only for date = custom. */
  from: string;
  to: string;
  statuses: IncidentStatus[];
  types: IncidentType[];
  residentId: string;
  roomId: string;
  /** Id of who acknowledged or resolved it. */
  handledById: string;
  classification: Classification | '';
}

/** The design opens on the last 7 days. */
export const NO_FILTERS: IncidentFilters = {
  search: '',
  date: '7d',
  from: '',
  to: '',
  statuses: [],
  types: [],
  residentId: '',
  roomId: '',
  handledById: '',
  classification: '',
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const list = <T extends string>(raw: string | null, allowed: readonly T[]): T[] =>
  (raw ?? '').split(',').filter((v): v is T => (allowed as readonly string[]).includes(v));

export function readFilters(params: URLSearchParams): IncidentFilters {
  const date = params.get('date');
  const day = (key: string) => {
    const v = params.get(key) ?? '';
    return DAY_RE.test(v) ? v : '';
  };
  const classification = params.get('classification');
  return {
    search: params.get('q') ?? '',
    date: date !== null && date in DATE_LABEL ? (date as DatePreset) : NO_FILTERS.date,
    from: day('from'),
    to: day('to'),
    statuses: list(params.get('status'), incidentStatusSchema.options),
    types: list(params.get('type'), incidentTypeSchema.options),
    residentId: params.get('resident') ?? '',
    roomId: params.get('room') ?? '',
    handledById: params.get('handledBy') ?? '',
    classification: classification === 'confirmed' || classification === 'false_alarm' ? classification : '',
  };
}

/** Only what differs from NO_FILTERS goes in the link. */
export function writeFilters(f: IncidentFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.search) p.set('q', f.search);
  if (f.date !== NO_FILTERS.date) p.set('date', f.date);
  if (f.date === 'custom') {
    if (f.from) p.set('from', f.from);
    if (f.to) p.set('to', f.to);
  }
  if (f.statuses.length) p.set('status', f.statuses.join(','));
  if (f.types.length) p.set('type', f.types.join(','));
  if (f.residentId) p.set('resident', f.residentId);
  if (f.roomId) p.set('room', f.roomId);
  if (f.handledById) p.set('handledBy', f.handledById);
  if (f.classification) p.set('classification', f.classification);
  return p;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const localDay = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

/** [from, to) in milliseconds for the date filter; null ends are open. */
export function dateWindow(f: IncidentFilters, now: Date): [number | null, number | null] {
  const today = startOfDay(now);
  const daysBack = (n: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - n).getTime();
  switch (f.date) {
    case 'today':
      return [today.getTime(), null];
    case '7d':
      return [daysBack(6), null];
    case '30d':
      return [daysBack(29), null];
    case 'all':
      return [null, null];
    case 'custom': {
      const from = f.from ? localDay(f.from).getTime() : null;
      const to = f.to ? new Date(localDay(f.to).getTime() + 24 * 3600_000).getTime() : null;
      return [from, to];
    }
  }
}

/** Who handled it: whoever resolved it, otherwise whoever acknowledged it. */
export const handledBy = (i: Incident) => i.resolvedBy ?? i.acknowledgedBy;

/** Seconds from detection to acknowledgement, or null while nobody has responded. */
export const responseSeconds = (i: Incident) =>
  i.acknowledgedAt === null ? null : secondsBetween(i.detectedAt, Date.parse(i.acknowledgedAt));

/** A confirmed incident stays "confirmed" once resolved; a false alarm is closed as such. */
export function classificationOf(i: Incident): Classification | null {
  if (i.status === 'false_alarm') return 'false_alarm';
  if (i.status === 'confirmed' || i.status === 'resolved') return 'confirmed';
  return null;
}

export function filterIncidents(all: Incident[], f: IncidentFilters, now: Date): Incident[] {
  const [from, to] = dateWindow(f, now);
  const q = f.search.trim().toLowerCase();
  return all.filter((i) => {
    const at = Date.parse(i.detectedAt);
    if (from !== null && at < from) return false;
    if (to !== null && at >= to) return false;
    if (f.statuses.length && !f.statuses.includes(i.status)) return false;
    if (f.types.length && !f.types.includes(i.type)) return false;
    if (f.residentId && i.resident?.id !== f.residentId) return false;
    if (f.roomId && i.room.id !== f.roomId) return false;
    if (f.handledById && handledBy(i)?.id !== f.handledById) return false;
    if (f.classification && classificationOf(i) !== f.classification) return false;
    if (q) {
      const text = [i.code, incidentPersonName(i), i.resident?.fullName ?? '', i.room.name, i.room.wing ?? '']
        .join(' ')
        .toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
}

/** How many filters are set besides search and the date preset (shown on "More filters (n)"). */
export function drawerCount(f: IncidentFilters): number {
  return (
    (f.date === 'custom' ? 1 : 0) +
    f.statuses.length +
    f.types.length +
    (f.residentId ? 1 : 0) +
    (f.roomId ? 1 : 0) +
    (f.handledById ? 1 : 0) +
    (f.classification ? 1 : 0)
  );
}

/** Distinct values seen in the incidents, for the drawer's pickers, sorted by name. */
export function pickerOptions(all: Incident[]) {
  const byId = <T extends { id: string }>(items: T[]) => [...new Map(items.map((x) => [x.id, x])).values()];
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  return {
    residents: byId(
      all.flatMap((i) => (i.resident ? [{ id: i.resident.id, name: i.resident.fullName }] : [])),
    ).sort(byName),
    rooms: byId(
      all.map((i) => ({
        id: i.room.id,
        name: i.room.wing ? `${i.room.name} · ${i.room.wing}` : i.room.name,
      })),
    ).sort(byName),
    staff: byId(
      all.flatMap((i) => {
        const h = handledBy(i);
        return h ? [{ id: h.id, name: h.fullName }] : [];
      }),
    ).sort(byName),
  };
}

const csvCell = (v: string) => {
  // Quote every cell, and stop spreadsheet apps from running a cell as a formula.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replaceAll('"', '""')}"`;
};

/** The filtered incidents as a CSV file (all pages), with the same columns as the table. */
export function incidentsCsv(incidents: Incident[]): string {
  const header = [
    'ID',
    'Type',
    'Resident / sender',
    'Location',
    'Detected at',
    'Status',
    'Handled by',
    'Response time',
  ];
  const rows = incidents.map((i) => [
    i.code,
    TYPE_LABEL[i.type],
    incidentPersonName(i),
    i.room.wing ? `${i.room.name} · ${i.room.wing}` : i.room.name,
    `${formatTime(i.detectedAt)} · ${formatDate(i.detectedAt)}`,
    INCIDENT_STATUS_LABEL[i.status],
    handledBy(i)?.fullName ?? '',
    responseSeconds(i) === null ? '' : formatShortDuration(responseSeconds(i)),
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

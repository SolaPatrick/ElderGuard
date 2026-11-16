import type { Incident, IncidentStatus } from './schemas';

/** A report covers whole local days, from the start of `from` to the end of `to`. */
export interface ReportRange {
  /** "2026-11-01" */
  from: string;
  /** "2026-11-07" (inclusive) */
  to: string;
}

export interface Count {
  label: string;
  count: number;
}

export interface ReportStats {
  totalAlerts: number;
  /** Fall alerts staff classified as a real fall. */
  confirmedFalls: number;
  falseAlarms: number;
  /** False alarms out of alerts that were classified; null when none were. */
  falseAlarmRate: number | null;
  avgAckSeconds: number | null;
  avgResolveSeconds: number | null;
  sosCount: number;
  /** Not yet classified: still new or acknowledged. */
  open: number;
  /** One entry per day in the range, oldest first. Falls = fall alerts that were not false alarms. */
  fallsByDay: { date: string; count: number }[];
  fallsByLocation: Count[];
  fallsByResident: Count[];
  /** [weekday 0 = Monday][hour 0..23] -> falls */
  fallsByWeekdayHour: number[][];
  outcomes: { status: IncidentStatus; count: number }[];
  falseAlarmReasons: Count[];
}

/** "2026-11-09" for a Date in local time. */
export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Start of the first day and start of the day after the last, in local time. */
export function rangeBounds(range: ReportRange): { start: Date; end: Date } {
  const start = new Date(`${range.from}T00:00:00`);
  const end = new Date(`${range.to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** The last `days` days, ending today. */
export function lastDays(days: number, today = new Date()): ReportRange {
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: localDateString(from), to: localDateString(today) };
}

export function isValidRange(range: ReportRange): boolean {
  const { start, end } = rangeBounds(range);
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start < end;
}

const isFall = (i: Incident) => i.type === 'fall' && i.status !== 'false_alarm';
const isConfirmed = (i: Incident) => i.status === 'confirmed' || i.status === 'resolved';

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

function seconds(fromIso: string, toIso: string | null): number | null {
  if (!toIso) return null;
  const s = (Date.parse(toIso) - Date.parse(fromIso)) / 1000;
  return Number.isFinite(s) && s >= 0 ? s : null;
}

function countBy(items: Incident[], key: (i: Incident) => string | null): Count[] {
  const counts = new Map<string, number>();
  for (const i of items) {
    const k = key(i);
    if (k !== null) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

const OUTCOME_ORDER: IncidentStatus[] = ['new', 'acknowledged', 'confirmed', 'resolved', 'false_alarm'];

/** Everything the analytics page shows, from the incidents detected inside the range. */
export function reportStats(incidents: readonly Incident[], range: ReportRange): ReportStats {
  const { start, end } = rangeBounds(range);
  const inRange = incidents.filter((i) => {
    const t = Date.parse(i.detectedAt);
    return t >= start.getTime() && t < end.getTime();
  });
  const falls = inRange.filter(isFall);
  const falseAlarms = inRange.filter((i) => i.status === 'false_alarm');
  const classified = inRange.filter((i) => isConfirmed(i) || i.status === 'false_alarm');

  const fallsByDay: ReportStats['fallsByDay'] = [];
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const date = localDateString(d);
    fallsByDay.push({
      date,
      count: falls.filter((i) => localDateString(new Date(i.detectedAt)) === date).length,
    });
  }

  const fallsByWeekdayHour = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const i of falls) {
    const d = new Date(i.detectedAt);
    fallsByWeekdayHour[(d.getDay() + 6) % 7]![d.getHours()]! += 1;
  }

  return {
    totalAlerts: inRange.length,
    confirmedFalls: inRange.filter((i) => i.type === 'fall' && isConfirmed(i)).length,
    falseAlarms: falseAlarms.length,
    falseAlarmRate: classified.length === 0 ? null : falseAlarms.length / classified.length,
    avgAckSeconds: average(
      inRange.map((i) => seconds(i.detectedAt, i.acknowledgedAt)).filter((s): s is number => s !== null),
    ),
    avgResolveSeconds: average(
      inRange
        .filter((i) => i.status === 'resolved')
        .map((i) => seconds(i.detectedAt, i.resolvedAt))
        .filter((s): s is number => s !== null),
    ),
    sosCount: inRange.filter((i) => i.type === 'sos').length,
    open: inRange.filter((i) => i.status === 'new' || i.status === 'acknowledged').length,
    fallsByDay,
    fallsByLocation: countBy(falls, (i) => i.room.name),
    fallsByResident: countBy(falls, (i) => i.resident?.fullName ?? null),
    fallsByWeekdayHour,
    outcomes: OUTCOME_ORDER.map((status) => ({
      status,
      count: inRange.filter((i) => i.status === status).length,
    })),
    falseAlarmReasons: countBy(falseAlarms, (i) => i.falseAlarmReason ?? 'No reason given'),
  };
}

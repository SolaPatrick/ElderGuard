import type { CameraStatus, FallRisk, Incident, IncidentStatus } from './schemas';

/** 192 -> "3:12", 3725 -> "1:02:05". Negative or invalid input shows "0:00". */
export function formatElapsed(totalSeconds: number): string {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** 84 -> "1m 24s", 48 -> "0m 48s", null -> "—". */
export function formatShortDuration(totalSeconds: number | null): string {
  if (totalSeconds === null || !Number.isFinite(totalSeconds)) return '—';
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`;
}

/** Seconds between two instants, never negative. */
export function secondsBetween(fromIso: string, to: Date | number): number {
  const from = Date.parse(fromIso);
  if (Number.isNaN(from)) return 0;
  const toMs = typeof to === 'number' ? to : to.getTime();
  return Math.max(0, Math.floor((toMs - from) / 1000));
}

/** "2:41 PM" */
export function formatTime(iso: string, locale = 'en-US'): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/** "2:41:08 PM" */
export function formatTimeWithSeconds(iso: string, locale = 'en-US'): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** "19 Oct 2026" */
export function formatDate(iso: string | Date, locale = 'en-GB'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Monday, 19 Oct 2026" */
export function formatLongDate(d: Date, locale = 'en-GB'): string {
  const weekday = d.toLocaleDateString(locale, { weekday: 'long' });
  return `${weekday}, ${formatDate(d, locale)}`;
}

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  new: 'New',
  acknowledged: 'Acknowledged',
  confirmed: 'Confirmed',
  false_alarm: 'False alarm',
  resolved: 'Resolved',
};

export const CAMERA_STATUS_LABEL: Record<CameraStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  error: 'Error',
  paused: 'Detection paused',
  connecting: 'Connecting',
};

export const FALL_RISK_LABEL: Record<FallRisk, string> = {
  low: 'Low risk',
  moderate: 'Moderate risk',
  high: 'High risk',
};

/**
 * Headline for an alert. Copy rule from the design: never diagnostic,
 * always "Possible fall detected".
 */
export function incidentTitle(incident: Pick<Incident, 'type'>): string {
  return incident.type === 'fall' ? 'Possible fall detected' : 'SOS';
}

/** "Remedios Santos" for falls, "Angelica Cruz" (sender) for SOS, or a fallback. */
export function incidentPersonName(incident: Pick<Incident, 'type' | 'resident' | 'sentBy'>): string {
  if (incident.type === 'sos')
    return incident.sentBy?.fullName ?? incident.resident?.fullName ?? 'Unknown sender';
  return incident.resident?.fullName ?? 'Unknown resident';
}

/**
 * First + last initial: "Joel Ramos" -> "JR". Abbreviated words such as "Ma."
 * are skipped, so "Ma. Teresa Reyes" -> "TR" (as in the design).
 */
export function initials(fullName: string): string {
  const all = fullName.split(/\s+/).filter(Boolean);
  const kept = all.filter((w) => !w.endsWith('.'));
  const words = (kept.length > 0 ? kept : all).map((w) => w.replace(/[^\p{L}]/gu, '')).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

/**
 * Short description of a caregiver's assigned areas for page subtitles:
 * [{Room 101, East Wing}, {Room 102}, {Room 103}] -> "East Wing · Rooms 101–103".
 */
export function describeAreas(areas: readonly { name: string; wing: string | null }[]): string {
  if (areas.length === 0) return 'No areas assigned';
  const wings = [...new Set(areas.map((a) => a.wing).filter((w): w is string => !!w))];

  const roomNumbers: number[] = [];
  const others: string[] = [];
  for (const a of areas) {
    const m = /^Room (\d+)$/.exec(a.name);
    if (m) roomNumbers.push(Number(m[1]));
    else others.push(a.name);
  }
  roomNumbers.sort((x, y) => x - y);

  // Collapse consecutive room numbers into ranges: 101,102,103,105 -> "101–103", "105"
  const ranges: string[] = [];
  for (let i = 0; i < roomNumbers.length;) {
    let j = i;
    while (j + 1 < roomNumbers.length && roomNumbers[j + 1] === roomNumbers[j]! + 1) j++;
    ranges.push(j > i ? `${roomNumbers[i]}–${roomNumbers[j]}` : String(roomNumbers[i]));
    i = j + 1;
  }
  const roomsText =
    roomNumbers.length === 0 ? null : `${roomNumbers.length === 1 ? 'Room' : 'Rooms'} ${ranges.join(', ')}`;

  return [...wings, [roomsText, ...others].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
}

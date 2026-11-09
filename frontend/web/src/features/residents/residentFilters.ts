import { formatDate, formatTime, type FallRisk, type Resident } from '@elderguard/shared';

export const NO_ROOM = 'No room';

export const roomOf = (r: Resident) => r.room?.name ?? NO_ROOM;

/** Room options for the filter, in the order the residents list them. */
export function roomOptions(residents: Resident[]): string[] {
  return [...new Set(residents.map(roomOf))].toSorted((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

export function filterResidents(
  residents: Resident[],
  { search, room, risk }: { search: string; room: string; risk: FallRisk | '' },
): Resident[] {
  const q = search.trim().toLowerCase();
  return residents.filter(
    (r) =>
      (room === '' || roomOf(r) === room) &&
      (risk === '' || r.fallRisk === risk) &&
      (q === '' ||
        [r.fullName, r.room?.name ?? '', ...r.caregivers.map((c) => c.fullName)].some((s) =>
          s.toLowerCase().includes(q),
        )),
  );
}

/** "2:41 PM · 19 Oct 2026", or an em dash when there is no date. */
export const formatDateTime = (iso: string | null) => (iso ? `${formatTime(iso)} · ${formatDate(iso)}` : '—');

export type ResidentView = 'cards' | 'table';

const VIEW_KEY = 'elderguard.residentsView';

export function loadView(fallback: ResidentView): ResidentView {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'cards' || v === 'table' ? v : fallback;
  } catch {
    return fallback;
  }
}

export function saveView(view: ResidentView) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

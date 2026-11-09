import { isActiveStatus, type Camera, type Incident } from '@elderguard/shared';

/** Cameras outside a wing (hallways, dining hall, garden...). */
export const COMMON_AREAS = 'Common areas';

export const areaOf = (c: Camera) => c.roomWing ?? COMMON_AREAS;

/** Area options for the filter, wings first, in the order the cameras list them. */
export function areaOptions(cameras: Camera[]): string[] {
  const areas = [...new Set(cameras.map(areaOf))];
  return areas.toSorted((a, b) => Number(a === COMMON_AREAS) - Number(b === COMMON_AREAS));
}

export function filterCameras(cameras: Camera[], area: string, search: string): Camera[] {
  const q = search.trim().toLowerCase();
  return cameras.filter(
    (c) =>
      (area === '' || areaOf(c) === area) &&
      (q === '' || [c.code, c.roomName ?? '', c.roomWing ?? ''].some((s) => s.toLowerCase().includes(q))),
  );
}

export const LAYOUTS = [1, 4, 9, 16] as const;
export type Layout = (typeof LAYOUTS)[number];
export const COLUMNS: Record<Layout, number> = { 1: 1, 4: 2, 9: 3, 16: 4 };

const LAYOUT_KEY = 'elderguard.monitoringLayout';

export function loadLayout(): Layout {
  try {
    const n = Number(localStorage.getItem(LAYOUT_KEY));
    return (LAYOUTS as readonly number[]).includes(n) ? (n as Layout) : 9;
  } catch {
    return 9;
  }
}

export function saveLayout(layout: Layout) {
  try {
    localStorage.setItem(LAYOUT_KEY, String(layout));
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

/** The open alert shown on a camera: one from that camera, else one in its room. */
export function alertForCamera(camera: Camera, alerts: Incident[]): Incident | null {
  const open = alerts.filter((a) => isActiveStatus(a.status));
  return (
    open.find((a) => a.camera?.id === camera.id) ??
    open.find((a) => camera.roomId !== null && a.room.id === camera.roomId) ??
    null
  );
}

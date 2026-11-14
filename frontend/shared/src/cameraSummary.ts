import type { Camera } from './schemas';

/** Offline or failing: someone should look at it. Paused cameras were turned off on purpose. */
export const cameraNeedsAttention = (cam: Camera) => cam.status === 'offline' || cam.status === 'error';

/** "3 of 4 cameras online · 1 paused · none offline" */
export function cameraSummary(cams: readonly Camera[]): string {
  const count = (s: Camera['status']) => cams.filter((cam) => cam.status === s).length;
  const broken = cams.filter(cameraNeedsAttention).length;
  return [
    `${count('online')} of ${cams.length} ${cams.length === 1 ? 'camera' : 'cameras'} online`,
    count('paused') > 0 && `${count('paused')} paused`,
    count('connecting') > 0 && `${count('connecting')} connecting`,
    broken === 0 ? 'none offline' : `${broken} need attention`,
  ]
    .filter(Boolean)
    .join(' · ');
}

import { formatTime, type Camera } from '@elderguard/shared';

/** "Just now" while it is working, the time it was last seen when it isn't, or an em dash. */
export function lastSeenLabel(c: Camera): string {
  if (c.status === 'online' || c.status === 'paused') return 'Just now';
  return c.lastSeenAt ? formatTime(c.lastSeenAt) : '—';
}

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { incidentPersonName, incidentTitle, type Incident } from '@elderguard/shared';
import { showDesktopNotification } from './desktopNotifications';

/**
 * Shows a desktop notification for each new alert that arrives while the ElderGuard tab is hidden.
 * Alerts already known when the page loaded, and alerts this user sent (SOS), are skipped.
 */
export function useDesktopAlertNotifications(incidents: Incident[] | undefined, userId: string) {
  const navigate = useNavigate();
  const seen = useRef<Set<string> | null>(null);
  const shown = useRef(new Map<string, Notification>());

  useEffect(() => {
    if (!incidents) return;
    const fresh = incidents.filter((i) => i.status === 'new');
    if (seen.current === null) {
      // First answer from the server: these were already there, the popup shows them.
      seen.current = new Set(fresh.map((i) => i.code));
      return;
    }
    for (const i of fresh) {
      if (seen.current.has(i.code)) continue;
      seen.current.add(i.code);
      if (i.sentBy?.id === userId || document.visibilityState !== 'hidden') continue;
      const n = showDesktopNotification(i.type === 'sos' ? `SOS · ${i.room.name}` : incidentTitle(i), {
        body: `${incidentPersonName(i)} · ${i.room.name}`,
        tag: i.code,
        onClick: () => void navigate(`/alerts/${i.code}`),
      });
      if (n) shown.current.set(i.code, n);
    }
    // Close notifications for alerts someone has acknowledged since.
    for (const [code, n] of shown.current) {
      if (!fresh.some((i) => i.code === code)) {
        n.close();
        shown.current.delete(code);
      }
    }
  }, [incidents, userId, navigate]);
}

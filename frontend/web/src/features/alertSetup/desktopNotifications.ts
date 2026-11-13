import { useEffect, useSyncExternalStore } from 'react';

/** What the browser allows for desktop notifications on this site. */
export type NotificationAccess = 'granted' | 'default' | 'denied' | 'unsupported';

/**
 * Desktop notifications need a browser that has them and a secure page
 * (https, or localhost while developing).
 */
export function notificationAccess(): NotificationAccess {
  if (typeof window === 'undefined' || !('Notification' in window) || !window.isSecureContext) {
    return 'unsupported';
  }
  return Notification.permission;
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  // The user can change the permission in the browser's site settings at any time.
  window.addEventListener('focus', listener);
  document.addEventListener('visibilitychange', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('focus', listener);
    document.removeEventListener('visibilitychange', listener);
  };
}

export function useNotificationAccess(): NotificationAccess {
  // Also follow changes reported by the Permissions API where the browser has it.
  useEffect(() => {
    let status: PermissionStatus | undefined;
    let cancelled = false;
    navigator.permissions
      ?.query({ name: 'notifications' })
      .then((s) => {
        if (cancelled) return;
        status = s;
        s.addEventListener('change', emit);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      status?.removeEventListener('change', emit);
    };
  }, []);
  return useSyncExternalStore(subscribe, notificationAccess, () => 'unsupported');
}

/** Asks the browser for permission. Must run from a click. */
export async function requestNotificationAccess(): Promise<NotificationAccess> {
  if (notificationAccess() !== 'default') return notificationAccess();
  try {
    await Notification.requestPermission();
  } catch {
    // Old browsers only take a callback; the permission is read again below either way.
  }
  emit();
  return notificationAccess();
}

/** Shows a desktop notification if allowed. Returns it, or null when it could not be shown. */
export function showDesktopNotification(
  title: string,
  options: { body: string; tag: string; onClick: () => void },
): Notification | null {
  if (notificationAccess() !== 'granted') return null;
  try {
    const n = new Notification(title, { body: options.body, tag: options.tag, requireInteraction: true });
    n.addEventListener('click', () => {
      window.focus();
      options.onClick();
      n.close();
    });
    return n;
  } catch {
    // Some browsers (mostly on phones) only allow notifications from a service worker.
    return null;
  }
}

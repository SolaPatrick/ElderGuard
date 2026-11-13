import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  buildNotifications,
  isUnread,
  loadReadState,
  markAllRead,
  markRead,
  saveReadState,
  type NotificationItem,
  type ReadState,
} from '@elderguard/shared';
import { useCurrentUser } from '../auth/authContext';
import { useCameras, useIncidentHistory } from '../queries';

const LINKS = {
  incident: (i: { code: string }) => `/alerts/${i.code}`,
  camera: (c: { id: string }) => `/cameras/${c.id}`,
};

// One read state for the whole app, so the More tab count and the Notifications screen agree.
let current: { userId: string; state: ReadState } | null = null;
const listeners = new Set<() => void>();

function readState(userId: string): ReadState {
  if (current?.userId !== userId) current = { userId, state: loadReadState(userId, Date.now()) };
  return current.state;
}

function writeState(userId: string, state: ReadState) {
  current = { userId, state };
  saveReadState(userId, state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * M-27: notifications built from incidents and camera status (no server keeps notifications yet),
 * with read state kept on this phone, the same rules as the web.
 */
export function useNotifications() {
  const userId = useCurrentUser().id;
  const incidents = useIncidentHistory();
  const cameras = useCameras();
  const state = useSyncExternalStore(
    subscribe,
    useCallback(() => readState(userId), [userId]),
  );

  const items = useMemo(
    () => buildNotifications(incidents.data ?? [], cameras.data ?? [], LINKS),
    [incidents.data, cameras.data],
  );
  const update = (next: ReadState) => writeState(userId, next);

  return {
    items,
    isPending: incidents.isPending || cameras.isPending,
    error: incidents.error ?? cameras.error,
    refetch: () => {
      void incidents.refetch();
      void cameras.refetch();
    },
    unread: (n: NotificationItem) => isUnread(n, state),
    unreadCount: items.filter((n) => isUnread(n, state)).length,
    setRead: (n: NotificationItem, read: boolean) => update(markRead(state, n.id, read)),
    markAllRead: () => update(markAllRead(items)),
  };
}

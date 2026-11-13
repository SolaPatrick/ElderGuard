import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  buildNotifications,
  getReadState,
  isUnread,
  markAllRead,
  markRead,
  setReadState,
  subscribeReadState,
  type NotificationItem,
  type ReadState,
} from '@elderguard/shared';
import { useCurrentUser } from '../auth/authContext';
import { useCameras, useIncidentHistory } from '../queries';

const LINKS = {
  incident: (i: { code: string }) => `/alerts/${i.code}`,
  camera: (c: { id: string }) => `/cameras/${c.id}`,
};

/**
 * M-27: notifications built from incidents and camera status (no server keeps notifications yet),
 * with read state kept on this phone, the same rules as the web.
 */
export function useNotifications() {
  const userId = useCurrentUser().id;
  const incidents = useIncidentHistory();
  const cameras = useCameras();
  const state = useSyncExternalStore(
    subscribeReadState,
    useCallback(() => getReadState(userId), [userId]),
  );

  const items = useMemo(
    () => buildNotifications(incidents.data ?? [], cameras.data ?? [], LINKS),
    [incidents.data, cameras.data],
  );
  const update = (next: ReadState) => setReadState(userId, next);

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

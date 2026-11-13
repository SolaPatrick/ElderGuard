import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { getReadState, setReadState, subscribeReadState, type Incident } from '@elderguard/shared';
import { useActiveIncidents, useCameras, useIncidentHistory } from '../../api/queries';
import { useCurrentUser } from '../../auth/authContext';
import {
  buildNotifications,
  isUnread,
  markAllRead,
  markRead,
  type NotificationItem,
} from './notificationItems';

/**
 * NTF-01 / SH-03: notifications built from incidents and camera status, with the read state
 * kept on this computer. The history refreshes every 30 s; the active alerts (every 5 s) are
 * merged in so a new alert reaches the bell quickly.
 */
export function useNotifications() {
  const userId = useCurrentUser().id;
  const history = useIncidentHistory();
  const active = useActiveIncidents();
  const cameras = useCameras();
  const state = useSyncExternalStore(
    subscribeReadState,
    useCallback(() => getReadState(userId), [userId]),
  );

  const items = useMemo(() => {
    const byCode = new Map<string, Incident>();
    for (const i of history.data ?? []) byCode.set(i.code, i);
    for (const i of active.data ?? []) byCode.set(i.code, i);
    return buildNotifications([...byCode.values()], cameras.data ?? []);
  }, [history.data, active.data, cameras.data]);

  const unread = useCallback((n: NotificationItem) => isUnread(n, state), [state]);
  return {
    items,
    isPending: history.isPending || cameras.isPending,
    failed: history.isError ? history : cameras.isError ? cameras : null,
    unread,
    unreadCount: items.filter(unread).length,
    setRead: (n: NotificationItem, read: boolean) => setReadState(userId, markRead(state, n.id, read)),
    markAllRead: () => setReadState(userId, markAllRead(items)),
  };
}

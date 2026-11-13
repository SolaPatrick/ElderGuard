import { buildNotifications as build, type Camera, type Incident } from '@elderguard/shared';

// The notification rules live in shared/src/notifications.ts, shared with the mobile app.
export {
  isUnread,
  loadReadState,
  markAllRead,
  markRead,
  saveReadState,
  type NotificationItem,
  type NotificationKind,
  type ReadState,
} from '@elderguard/shared';

/** NTF-01 with the web app's links. */
export function buildNotifications(incidents: Incident[], cameras: Camera[]) {
  return build(incidents, cameras, {
    incident: (i, open) => (open ? `/alerts/${i.code}` : `/incidents/${i.code}`),
    camera: (c) => `/monitoring/${c.code}`,
  });
}

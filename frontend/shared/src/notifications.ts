import { formatDate, formatTime, incidentPersonName } from './format';
import { isActiveStatus, type Camera, type Incident } from './schemas';

/** The design's filter tabs. "Account" and report notifications need data no server sends yet. */
export type NotificationKind = 'fall' | 'sos' | 'camera';

export interface NotificationItem {
  /** Stable while the event is the same, so "read" sticks to it. */
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  /** ISO time of the event, or null for a camera whose last-seen time the server doesn't know. */
  at: string | null;
  /** Where tapping it goes; each app makes its own links (see NotificationLinks). */
  to: string;
}

/** Each app's screen paths for an alert (open or closed) and a camera. */
export interface NotificationLinks {
  incident: (incident: Incident, open: boolean) => string;
  camera: (camera: Camera) => string;
}

const when = (iso: string) => `${formatTime(iso)} · ${formatDate(iso)}`;
const place = (i: Incident) => i.room.name;

/**
 * NTF-01 Notification center. There is no notification table on the servers yet, so the list is built
 * from what they do send: incidents (falls, SOS, escalations) and the cameras' current status.
 */
export function buildNotifications(
  incidents: Incident[],
  cameras: Camera[],
  links: NotificationLinks,
): NotificationItem[] {
  const items: NotificationItem[] = [];
  for (const i of incidents) {
    const to = links.incident(i, isActiveStatus(i.status));
    if (i.type === 'sos') {
      items.push({
        id: `sos-${i.code}`,
        kind: 'sos',
        title: `SOS from ${i.sentBy?.fullName ?? 'a staff member'} · ${place(i)}`,
        detail: [i.resident?.fullName, when(i.detectedAt)].filter(Boolean).join(' · '),
        at: i.detectedAt,
        to,
      });
    } else {
      items.push({
        id: `fall-${i.code}`,
        kind: 'fall',
        title: `Possible fall detected · ${place(i)}`,
        detail: [incidentPersonName(i), i.camera?.code, when(i.detectedAt)].filter(Boolean).join(' · '),
        at: i.detectedAt,
        to,
      });
    }
    if (i.escalatedAt) {
      items.push({
        id: `escalated-${i.code}`,
        kind: i.type,
        title: `Alert escalated · ${place(i)}`,
        detail: `${i.code} was not acknowledged in time · ${when(i.escalatedAt)}`,
        at: i.escalatedAt,
        to,
      });
    }
  }
  for (const c of cameras) {
    const where = c.roomName ? ` ${c.roomName}` : '';
    if (c.status === 'offline' || c.status === 'error') {
      items.push({
        id: `camera-${c.id}-down-${c.lastSeenAt ?? 'unknown'}`,
        kind: 'camera',
        title: `${c.code}${where} is ${c.status === 'error' ? 'not working' : 'offline'}`,
        detail: c.lastSeenAt ? `Last seen ${when(c.lastSeenAt)}` : 'Not seen recently',
        at: c.lastSeenAt,
        to: links.camera(c),
      });
    } else if (c.status === 'paused' || !c.detectionEnabled) {
      items.push({
        id: `camera-${c.id}-paused`,
        kind: 'camera',
        title: `Detection paused on ${c.code}`,
        detail: c.roomName
          ? `${c.roomName} · falls here won't raise alerts`
          : "Falls it sees won't raise alerts",
        at: null,
        to: links.camera(c),
      });
    }
  }
  // Newest first; camera problems without a time are current, so they go on top.
  return items.toSorted(
    (a, b) =>
      (b.at === null ? Infinity : Date.parse(b.at)) - (a.at === null ? Infinity : Date.parse(a.at)) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Which notifications this person has read, kept on this device (no server stores it yet). The web
 * uses the browser's localStorage; the phone installs expo-sqlite's localStorage at start-up.
 * Everything older than `readBefore` counts as read; on first use that is 24 hours ago,
 * so a new device doesn't show the whole history as unread.
 */
export interface ReadState {
  readBefore: number;
  read: string[];
  unread: string[];
}

/** Keeps the stored lists small. */
const MAX_IDS = 1000;
const key = (userId: string) => `eg.notifications.${userId}`;

export function loadReadState(userId: string, now: number): ReadState {
  try {
    const raw = localStorage.getItem(key(userId));
    if (raw) {
      const v = JSON.parse(raw) as Partial<ReadState>;
      if (typeof v.readBefore === 'number' && Array.isArray(v.read) && Array.isArray(v.unread)) {
        return {
          readBefore: v.readBefore,
          read: v.read.filter((x) => typeof x === 'string'),
          unread: v.unread.filter((x) => typeof x === 'string'),
        };
      }
    }
  } catch {
    // Storage blocked or broken: start fresh.
  }
  return { readBefore: now - 24 * 3600_000, read: [], unread: [] };
}

export function saveReadState(userId: string, state: ReadState) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(state));
  } catch {
    // Not saved; the page still works for this visit.
  }
}

export function isUnread(n: NotificationItem, s: ReadState): boolean {
  if (s.unread.includes(n.id)) return true;
  if (s.read.includes(n.id)) return false;
  // A current camera problem has no time; it stays unread until marked.
  return n.at === null || Date.parse(n.at) > s.readBefore;
}

export function markRead(s: ReadState, id: string, read: boolean): ReadState {
  const without = (list: string[]) => list.filter((x) => x !== id);
  return read
    ? { ...s, read: [...without(s.read), id].slice(-MAX_IDS), unread: without(s.unread) }
    : { ...s, read: without(s.read), unread: [...without(s.unread), id].slice(-MAX_IDS) };
}

/** Marks everything shown as read. Ids are kept only for items without a time. */
export function markAllRead(items: NotificationItem[], now = Date.now()): ReadState {
  return { readBefore: now, read: items.filter((n) => n.at === null).map((n) => n.id), unread: [] };
}

/*
 * One read state for the whole app, so every place that shows notifications (the bell, the
 * notification page, the phone's More tab) agrees right away. Hooks read it with
 * React's useSyncExternalStore(subscribeReadState, () => getReadState(userId)).
 */
let cached: { userId: string; raw: string | null; state: ReadState } | null = null;
const readStateListeners = new Set<() => void>();

function storedRaw(userId: string): string | null {
  try {
    return localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

/** The same object until the stored state changes, as useSyncExternalStore needs. */
export function getReadState(userId: string): ReadState {
  let raw = storedRaw(userId);
  if (cached?.userId === userId && cached.raw === raw) return cached.state;
  const state = loadReadState(userId, Date.now());
  if (raw === null) {
    // Save the starting point right away, so "the last 24 hours" is counted from the first
    // visit and does not move on every page load. (Stays null if storage is blocked.)
    saveReadState(userId, state);
    raw = storedRaw(userId);
  }
  cached = { userId, raw, state };
  return state;
}

export function setReadState(userId: string, state: ReadState) {
  saveReadState(userId, state);
  cached = { userId, raw: storedRaw(userId), state };
  readStateListeners.forEach((l) => l());
}

export function subscribeReadState(listener: () => void): () => void {
  readStateListeners.add(listener);
  return () => {
    readStateListeners.delete(listener);
  };
}

import packageJson from '../../../package.json?raw';
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, signInAs } from '../../test/renderApp';
import { APP_VERSION } from '../../version';
import {
  isUnread,
  loadReadState,
  markAllRead,
  markRead,
  saveReadState,
  type NotificationItem,
} from './notificationItems';

async function open(userId: 'u-teresa' | 'u-joel', path: string) {
  signInAs(userId);
  const app = renderApp(path);
  const popup = await screen.findByRole('alertdialog');
  await app.user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
  return app;
}

const titles = () =>
  within(screen.getByRole('list', { name: 'Notifications' }))
    .getAllByRole('link')
    .map((a) => a.textContent);

describe('Read state', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  const item = (id: string, hoursAgo: number | null): NotificationItem => ({
    id,
    kind: 'fall',
    title: id,
    detail: '',
    at: hoursAgo === null ? null : new Date(now - hoursAgo * 3600_000).toISOString(),
    to: '/',
  });

  it('starts with only the last 24 hours unread, and survives broken storage', () => {
    localStorage.setItem('eg.notifications.u1', '{not json');
    const s = loadReadState('u1', now);
    expect(isUnread(item('a', 2), s)).toBe(true);
    expect(isUnread(item('b', 30), s)).toBe(false);
    expect(isUnread(item('camera', null), s)).toBe(true);
  });

  it('marks one read or unread, and everything read', () => {
    let s = loadReadState('u1', now);
    s = markRead(s, 'a', true);
    expect(isUnread(item('a', 2), s)).toBe(false);
    s = markRead(s, 'b', false);
    expect(isUnread(item('b', 30), s)).toBe(true);
    s = markAllRead([item('a', 2), item('b', 30), item('camera', null)], now);
    expect([item('a', 2), item('b', 30), item('camera', null)].some((n) => isUnread(n, s))).toBe(false);
    expect(isUnread(item('later', -1), s)).toBe(true);
    saveReadState('u1', s);
    expect(loadReadState('u1', now)).toEqual(s);
  });
});

describe('Notification center (NTF-01)', () => {
  it('lists falls, SOS, escalations and camera problems, newest first', async () => {
    await open('u-teresa', '/notifications');
    expect(await screen.findByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
    const list = await screen.findAllByRole('listitem');
    expect(list.length).toBeGreaterThan(5);
    const all = titles();
    expect(all.slice(0, 2)).toEqual(['Detection paused on CAM-09', 'Possible fall detected · Room 101']);
    expect(all).toContain('SOS from Angelica Cruz · Dining Hall');
    expect(all).toContain('CAM-07 Hallway B is offline');
    expect(all).toContain('Alert escalated · Room 105');
    expect(screen.getByRole('button', { name: 'Unread (8)' })).toBeInTheDocument();
  });

  it('filters by kind and marks notifications read, remembering it', async () => {
    const { user } = await open('u-teresa', '/notifications');
    await screen.findByRole('list', { name: 'Notifications' });
    await user.click(screen.getByRole('button', { name: 'Camera offline' }));
    expect(titles()).toEqual(['Detection paused on CAM-09', 'CAM-07 Hallway B is offline']);

    const cam7 = screen.getByRole('listitem', { name: 'Unread: CAM-07 Hallway B is offline' });
    await user.click(within(cam7).getByRole('button', { name: 'Mark as read' }));
    expect(screen.getByRole('button', { name: 'Unread (7)' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'CAM-07 Hallway B is offline' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(screen.getByRole('button', { name: 'Unread (0)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unread (0)' }));
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it('shows caregivers only their rooms', async () => {
    await open('u-joel', '/notifications');
    await screen.findByRole('list', { name: 'Notifications' });
    expect(titles()).toContain('Possible fall detected · Room 101');
    expect(titles()).not.toContain('CAM-07 Hallway B is offline');
  });
});

describe('Help & About (PRF-04)', () => {
  it('explains the alert steps and statuses, with the real version', async () => {
    await open('u-joel', '/help');
    expect(await screen.findByRole('heading', { level: 1, name: 'Help & About' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'How alerts work' })).getAllByRole('listitem'),
    ).toHaveLength(5);
    expect(screen.getByLabelText('False alarm: No fall happened')).toBeInTheDocument();
    expect(
      screen.getByText(`ElderGuard ${APP_VERSION} (web) · connected to the demo data`),
    ).toBeInTheDocument();
    expect(screen.getByText(/ask your Admin\/Head/)).toBeInTheDocument();
  });

  it('shows the same version as package.json', () => {
    const pkg = JSON.parse(packageJson) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });
});

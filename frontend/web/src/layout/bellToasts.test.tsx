import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp, signInAs, closeAlertPopup } from '../test/renderApp';

describe('Notification bell (SH-03)', () => {
  it('shows the unread count, opens the latest, and marks one read when opened', async () => {
    signInAs('u-teresa');
    const { user, router } = renderApp('/');
    await closeAlertPopup(user);
    const bell = await screen.findByRole('button', { name: 'Notifications, 8 unread' });
    await user.click(bell);
    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getByText('8 unread')).toBeInTheDocument();
    const items = within(panel).getAllByRole('button', { name: /^Unread: / });
    expect(items.length).toBe(6);

    await user.click(
      within(panel).getByRole('button', { name: 'Unread: Possible fall detected · Room 101' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/alerts\/INC-/));
    expect(screen.getByRole('button', { name: 'Notifications, 7 unread' })).toBeInTheDocument();
  });

  it('marks all read, and the notification page agrees right away', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/notifications');
    await closeAlertPopup(user);
    expect(await screen.findByRole('button', { name: 'Unread (8)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Notifications, 8 unread' }));
    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    await user.click(within(panel).getByRole('button', { name: 'Mark all as read' }));
    expect(within(panel).getByText('All read')).toBeInTheDocument();
    // Focus stays in the panel, so Escape still closes it.
    expect(within(panel).getByRole('button', { name: 'View all notifications' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Notifications, 0 unread' }));
    const again = screen.getByRole('dialog', { name: 'Notifications' });
    await user.click(within(again).getByRole('button', { name: 'View all notifications' }));
    expect(screen.getByRole('button', { name: 'Unread (0)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications, 0 unread' })).toBeInTheDocument();
  });
});

describe('Toasts (SH-08)', () => {
  it('confirms acknowledging and adding a note, and can be closed', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/');
    const popup = await screen.findByRole('alertdialog');
    await user.click(within(popup).getByRole('button', { name: 'Acknowledge' }));
    expect(await screen.findByText(/^Acknowledged · INC-/)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Add note' }));
    const noteDialog = screen.getByRole('dialog');
    await user.type(
      within(noteDialog).getByRole('textbox', { name: 'Note' }),
      'Checked on her, she is fine.',
    );
    await user.click(within(noteDialog).getByRole('button', { name: /save|add note/i }));
    expect(await screen.findByText('Note added')).toBeInTheDocument();
    // A new toast replaces the old one.
    expect(screen.queryByText(/^Acknowledged · INC-/)).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText('Note added')).not.toBeInTheDocument());
  });
});

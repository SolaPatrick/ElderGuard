import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, signInAs } from '../../test/renderApp';

async function closeAlertPopup(user: ReturnType<typeof renderApp>['user']) {
  const popup = await screen.findByRole('alertdialog');
  await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
}

const holdButton = () => screen.getByRole('button', { name: /hold to send SOS/i });

async function openSos(user: ReturnType<typeof renderApp>['user']) {
  await user.click(screen.getByRole('button', { name: 'SOS' }));
  return screen.findByRole('dialog', { name: /Send SOS/ });
}

describe('Send SOS (SOS-01)', () => {
  it('sends after holding, then opens the new SOS', async () => {
    signInAs('u-joel');
    const { user, router } = renderApp('/');
    await closeAlertPopup(user);
    const dialog = await openSos(user);

    // Joel's first assigned area is prefilled.
    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: /Location/ })).toHaveTextContent('Room 101'),
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Note (optional)' }),
      'Need help lifting a resident.',
    );

    fireEvent.pointerDown(holdButton());
    expect(await within(dialog).findByText(/Keep holding/)).toBeInTheDocument();
    expect(await screen.findByText('SOS sent', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/^Sent at .* · Room 101$/)).toBeInTheDocument();

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/alerts\/INC-\d{4}-\d{4}$/), {
      timeout: 4000,
    });
    expect(await screen.findByText('Need help lifting a resident.')).toBeInTheDocument();
    // The sender is not interrupted by a popup about their own SOS.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not send when released early', async () => {
    signInAs('u-joel');
    const { user, router } = renderApp('/');
    await closeAlertPopup(user);
    await openSos(user);
    await waitFor(() => expect(holdButton()).toBeEnabled());

    fireEvent.pointerDown(holdButton());
    fireEvent.pointerUp(holdButton());
    await new Promise((r) => setTimeout(r, 600));
    expect(screen.queryByText('SOS sent')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('makes the Admin/Head choose a location first', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/');
    await closeAlertPopup(user);
    const dialog = await openSos(user);

    expect(holdButton()).toBeDisabled();
    await user.click(within(dialog).getByRole('combobox', { name: /Location/ }));
    await user.click(await screen.findByRole('option', { name: 'Dining Hall' }));
    expect(holdButton()).toBeEnabled();
  });

  it('only offers a caregiver their own areas', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/');
    await closeAlertPopup(user);
    const dialog = await openSos(user);
    await user.click(within(dialog).getByRole('combobox', { name: /Location/ }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Room 101 · East Wing', 'Room 102 · East Wing', 'Room 103 · East Wing']);
  });
});

describe('SOS API rules', () => {
  it('refuses an SOS from a room outside the caregiver areas', async () => {
    const res = await fetch('/api/incidents/sos', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token:u-joel', 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'r-104' }),
    });
    expect(res.status).toBe(403);
  });
});

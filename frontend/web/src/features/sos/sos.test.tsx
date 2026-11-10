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

async function sendSosAsJoel() {
  signInAs('u-joel');
  const app = renderApp('/');
  await closeAlertPopup(app.user);
  await openSos(app.user);
  await waitFor(() => expect(holdButton()).toBeEnabled());
  fireEvent.pointerDown(holdButton());
  await waitFor(() => expect(app.router.state.location.pathname).toMatch(/^\/alerts\/INC-\d{4}-\d{4}$/), {
    timeout: 5000,
  });
  return app;
}

describe('SOS status and cancel (SOS-02, SOS-03)', () => {
  it('shows the sender their active SOS and lets them cancel it with a reason', async () => {
    const { user } = await sendSosAsJoel();
    const card = await screen.findByRole('heading', { name: 'Your SOS is active' });
    expect(card).toBeInTheDocument();
    expect(screen.getByText('Waiting for someone to respond')).toBeInTheDocument();
    expect(
      screen.getByText(/^Your SOS is active · \d+:\d{2} elapsed · \d+ active alerts?$/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View SOS' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel SOS' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel SOS?' });
    await user.click(within(dialog).getByRole('radio', { name: 'Other' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel SOS' }));
    expect(await within(dialog).findByText('Explain why')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Situation handled' }));
    await user.type(within(dialog).getByRole('textbox', { name: /Note/ }), 'Resident was helped up.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel SOS' }));

    expect(await screen.findByText('SOS cancelled · Situation handled')).toBeInTheDocument();
    expect(screen.getByText('Resident was helped up.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your SOS is active' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Cancel SOS?' })).not.toBeInTheDocument();
  });

  it('lets the Admin/Head cancel someone else’s SOS', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/alerts/INC-2026-0141');
    await closeAlertPopup(user);
    await user.click(await screen.findByRole('button', { name: 'Cancel SOS' }));
    expect(screen.queryByRole('heading', { name: 'Your SOS is active' })).not.toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'Cancel SOS?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel SOS' }));
    expect(await screen.findByText('SOS cancelled · Pressed by mistake')).toBeInTheDocument();
  });

  it('offers no cancel on a fall alert', async () => {
    signInAs('u-joel');
    renderApp('/alerts/INC-2026-0142');
    expect(await screen.findByRole('button', { name: 'Add note' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel SOS' })).not.toBeInTheDocument();
  });
});

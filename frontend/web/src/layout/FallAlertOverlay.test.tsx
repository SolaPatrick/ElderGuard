import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { db } from '../mocks/db';
import { renderApp, signInAs } from '../test/renderApp';

/** Adds two more new falls, so three alerts wait for Teresa (one is in the seed data). */
function threeAlertsWaiting() {
  const teresa = db.findUserById('u-teresa')!;
  return [db.simulateFall(teresa).code, db.simulateFall(teresa).code];
}

describe('Fall alert popup with several alerts (SH-05 stacked)', () => {
  it('shows them in one popup that can be paged through', async () => {
    const [second, third] = threeAlertsWaiting();
    signInAs('u-teresa');
    const { user, router } = renderApp('/');

    const popup = await screen.findByRole('alertdialog');
    expect(within(popup).getByText('Alert 1 of 3')).toBeInTheDocument();
    expect(within(popup).getByRole('button', { name: 'Previous alert' })).toBeDisabled();

    await user.click(within(popup).getByRole('button', { name: 'Next alert' }));
    expect(within(popup).getByText('Alert 2 of 3')).toBeInTheDocument();
    await user.click(within(popup).getByRole('button', { name: 'Next alert' }));
    expect(within(popup).getByText('Alert 3 of 3')).toBeInTheDocument();
    expect(within(popup).getByRole('button', { name: 'Next alert' })).toBeDisabled();

    // "View details" opens the alert that is showing, not the oldest one.
    await user.click(within(popup).getByRole('button', { name: 'View details' }));
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/'));
    expect([`/alerts/${second}`, `/alerts/${third}`]).toContain(router.state.location.pathname);
  });

  it('closes all waiting alerts with one click', async () => {
    threeAlertsWaiting();
    signInAs('u-teresa');
    const { user } = renderApp('/');

    const popup = await screen.findByRole('alertdialog');
    expect(within(popup).getByText('Alert 1 of 3')).toBeInTheDocument();
    await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    // The red banner still lists them until someone handles them.
    expect(screen.getByRole('status')).toHaveTextContent(/4 active alerts/);
  });

  it('opens again when a new alert arrives after closing', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/');
    const popup = await screen.findByRole('alertdialog');
    expect(within(popup).queryByText(/Alert 1 of/)).not.toBeInTheDocument();
    await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    db.simulateFall(db.findUserById('u-teresa')!);
    expect(await screen.findByRole('alertdialog', {}, { timeout: 15_000 })).toBeInTheDocument();
  }, 20_000);

  it('"See all alerts" closes the popup and opens the alert queue', async () => {
    threeAlertsWaiting();
    signInAs('u-teresa');
    const { user, router } = renderApp('/');
    const popup = await screen.findByRole('alertdialog');
    await user.click(within(popup).getByRole('button', { name: 'See all 3 alerts' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/alerts'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

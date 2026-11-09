import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp, signInAs } from '../../test/renderApp';

describe('Fall alert flow (SH-05 -> ALT-02 -> ALT-03 -> ALT-04)', () => {
  it('pops up the new fall alert and takes the caregiver through to resolved', async () => {
    signInAs('u-joel');
    const { user, router } = renderApp('/');

    // The takeover popup appears for the unacknowledged fall.
    const popup = await screen.findByRole('alertdialog', { name: /possible fall detected/i });
    expect(within(popup).getByText(/Remedios Santos · 84 · High risk/)).toBeInTheDocument();

    // Acknowledge -> lands on the alert detail page.
    await user.click(within(popup).getByRole('button', { name: 'Acknowledge' }));
    expect(await screen.findByText('Alerts')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/alerts/INC-2026-0142');
    expect(await screen.findByRole('button', { name: 'Classify' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    // Classify as a confirmed fall.
    await user.click(screen.getByRole('button', { name: 'Classify' }));
    const classify = await screen.findByRole('dialog', { name: 'Classify alert' });
    await user.click(within(classify).getByRole('button', { name: 'Save' }));

    // Resolve with an outcome.
    await user.click(await screen.findByRole('button', { name: 'Resolve' }));
    const resolve = await screen.findByRole('dialog', { name: 'Resolve incident' });
    await user.click(within(resolve).getByRole('combobox', { name: /outcome/i }));
    await user.click(await screen.findByRole('option', { name: 'Assisted, no injury' }));
    await user.type(
      within(resolve).getByRole('textbox', { name: /what was done/i }),
      'Helped her up, checked vitals.',
    );
    await user.click(within(resolve).getByRole('button', { name: 'Resolve' }));

    expect(await screen.findByText('Helped her up, checked vitals.')).toBeInTheDocument();
    expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument());
  });

  it('requires a reason before closing as a false alarm', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/alerts/INC-2026-0141'); // SOS, already acknowledged
    await user.click(await screen.findByRole('button', { name: 'Classify' }));
    const dialog = await screen.findByRole('dialog', { name: 'Classify alert' });
    await user.click(within(dialog).getByRole('radio', { name: 'False alarm' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Choose why this is a false alarm')).toBeInTheDocument();
  });

  it('closing the popup keeps the red banner until the alert is handled', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/');
    const popup = await screen.findByRole('alertdialog');
    await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/2 active alerts/);
  });

  it('shows a 404 page for an unknown incident', async () => {
    signInAs('u-teresa');
    renderApp('/incidents/INC-0000-0000');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

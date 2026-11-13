import { describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { closeAlertPopup, renderApp, signInAs } from '../../test/renderApp';

async function openLog() {
  signInAs('u-teresa');
  const app = renderApp('/activity');
  await closeAlertPopup(app.user);
  await screen.findByRole('table', { name: 'Activity log' });
  return app;
}

const rows = () =>
  within(screen.getByRole('table', { name: 'Activity log' }))
    .getAllByRole('row')
    .slice(1);

describe('Activity log (LOG-01, LOG-02)', () => {
  it('lists who did what, newest first, with their role', async () => {
    await openLog();
    expect(screen.getByRole('heading', { level: 1, name: 'Activity log' })).toBeInTheDocument();
    const first = rows()[0]!;
    expect(within(first).getByText('Mark Dizon')).toBeInTheDocument();
    expect(within(first).getByText('Resolved')).toBeInTheDocument();
    expect(within(first).getByText('Alerts')).toBeInTheDocument();
    expect(within(first).getByText('INC-2026-0140')).toBeInTheDocument();
    expect(rows()).toHaveLength(3);
  });

  it('logs new actions, and filters by user, action and module', async () => {
    signInAs('u-teresa');
    const { user, router } = renderApp('/activity');
    const popup = await screen.findByRole('alertdialog');
    await user.click(within(popup).getByRole('button', { name: 'Acknowledge' }));
    // Acknowledging opens the alert; come back to the log.
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/alerts\//));
    await act(() => router.navigate('/activity'));
    await screen.findByRole('table', { name: 'Activity log' });
    expect(await within(rows()[0]!).findByText('Ma. Teresa Reyes')).toBeInTheDocument();
    expect(within(rows()[0]!).getByText('Acknowledged')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Module' }));
    await user.click(screen.getByRole('option', { name: 'Sign-in' }));
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]!).getByText('Joel Ramos')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.click(screen.getByRole('combobox', { name: 'User' }));
    await user.click(screen.getByRole('option', { name: 'Ma. Teresa Reyes' }));
    expect(rows().every((r) => within(r).queryByText('Ma. Teresa Reyes'))).toBe(true);

    await user.click(screen.getByRole('combobox', { name: 'Action' }));
    await user.click(screen.getByRole('option', { name: 'Deleted' }));
    expect(screen.getByText('No entries match these filters.')).toBeInTheDocument();
  });

  it('opens an entry in a drawer with a link to the alert', async () => {
    const { user } = await openLog();
    await user.click(within(rows()[0]!).getByRole('button', { name: /Mark Dizon resolved INC-2026-0140/ }));
    const drawer = await screen.findByRole('region', { name: 'Log entry' });
    expect(within(drawer).getByText('Mark Dizon resolved INC-2026-0140')).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'INC-2026-0140' })).toHaveAttribute(
      'href',
      '/incidents/INC-2026-0140',
    );
    expect(within(drawer).getByText(/IP address/)).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Log entry' })).not.toBeInTheDocument();
  });

  it('is only for the Admin/Head', async () => {
    signInAs('u-joel');
    renderApp('/activity');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });
});

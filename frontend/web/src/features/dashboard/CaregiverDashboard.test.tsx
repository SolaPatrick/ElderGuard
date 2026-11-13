import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, signInAs, closeAlertPopup as closeAlertPopupShared } from '../../test/renderApp';

async function closeAlertPopup(user: ReturnType<typeof renderApp>['user']) {
  const popup = await screen.findByRole('alertdialog');
  await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
}

describe('Caregiver dashboard (DASH-02)', () => {
  it("shows only Joel's alerts, residents, cameras and handled incidents", async () => {
    signInAs('u-joel');
    const { user } = renderApp('/');
    await closeAlertPopup(user);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Joel$/);
    expect(screen.getByText('East Wing · Rooms 101–103')).toBeInTheDocument();
    expect(screen.getByText(/1 active alert · oldest unresolved/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'My active alerts (1)' })).toBeInTheDocument();

    for (const name of ['Remedios Santos', 'Lourdes Aquino', 'Ernesto Villanueva', 'Corazon Mendoza']) {
      expect(await screen.findAllByText(name)).not.toHaveLength(0);
    }
    expect(screen.queryByText('Rodolfo Garcia')).not.toBeInTheDocument();
    // Only Remedios has an alert Joel can open (Lourdes' SOS is in the Dining Hall, not his area).
    expect(screen.getAllByText('Alert active')).toHaveLength(1);

    expect(screen.getByRole('link', { name: /CAM-01 · Room 101, live, alert active/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /CAM-03 · Room 103, live$/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /CAM-07/ })).not.toBeInTheDocument();

    const handled = screen.getByRole('table');
    expect(within(handled).getByText('INC-2026-0138')).toBeInTheDocument();
    expect(within(handled).getByText('1m 10s')).toBeInTheDocument();
    expect(within(handled).getByText('INC-2026-0136')).toBeInTheDocument();
    expect(within(handled).getByText('0m 52s')).toBeInTheDocument();
  });

  it('does not ask the server for facility-wide numbers', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/');
    await closeAlertPopup(user);
    expect(screen.queryByText('Residents monitored')).not.toBeInTheDocument();
    expect(screen.queryByText(/Only the Admin\/Head/)).not.toBeInTheDocument();
  });

  it('shows a 404 when a caregiver opens an alert outside their areas', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/alerts/INC-2026-0141');
    await closeAlertPopupShared(user);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('still gives the Admin/Head the facility-wide dashboard', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/');
    await closeAlertPopup(user);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findByText('Residents monitored')).toBeInTheDocument();
    expect(screen.getByText(/2 active alerts · oldest unresolved/)).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, signInAs } from '../../test/renderApp';

async function closeAlertPopup(user: ReturnType<typeof renderApp>['user']) {
  const popup = await screen.findByRole('alertdialog');
  await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
}

const tiles = () => within(screen.getByRole('list', { name: 'Cameras' })).getAllByRole('link');

describe('Live Monitoring grid (MON-01)', () => {
  it('shows every camera to the Admin/Head, 9 per page by default', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);

    expect(await screen.findByText('11 cameras · 9 online')).toBeInTheDocument();
    expect(tiles()).toHaveLength(9);
    expect(screen.getByText('Showing 9 of 11 cameras')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(tiles()).toHaveLength(2);
    expect(screen.getByRole('link', { name: /CAM-11 · Lobby/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '16 per page' }));
    expect(tiles()).toHaveLength(11);
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });

  it('marks the alerting, offline and paused cameras', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);
    await user.click(await screen.findByRole('button', { name: '16 per page' }));

    const cam1 = screen.getByRole('link', { name: 'CAM-01 · Room 101, live, alert active' });
    expect(within(cam1).getByText('Possible fall detected')).toBeInTheDocument();

    const cam7 = screen.getByRole('link', { name: 'CAM-07 · Hallway B, offline' });
    expect(within(cam7).getByText('OFFLINE')).toBeInTheDocument();
    expect(within(cam7).getByText(/^Last seen /)).toBeInTheDocument();

    const cam9 = screen.getByRole('link', { name: 'CAM-09 · Garden Walkway, live' });
    expect(within(cam9).getByText('Detection paused')).toBeInTheDocument();

    const cam2 = screen.getByRole('link', { name: 'CAM-02 · Room 102, live' });
    expect(within(cam2).getByText('Detection on')).toBeInTheDocument();
  });

  it('filters by area and search', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);
    await screen.findByText('Showing 9 of 11 cameras');

    await user.click(screen.getByRole('combobox', { name: 'Area' }));
    await user.click(screen.getByRole('option', { name: 'West Wing' }));
    expect(tiles().map((t) => t.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^CAM-04/),
      expect.stringMatching(/^CAM-05/),
      expect.stringMatching(/^CAM-06/),
    ]);

    await user.type(screen.getByRole('textbox', { name: 'Search cameras' }), '105');
    expect(tiles()).toHaveLength(1);
    expect(screen.getByText('Showing 1 of 1 cameras')).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'Search cameras' }));
    await user.type(screen.getByRole('textbox', { name: 'Search cameras' }), 'lobby');
    expect(screen.getByText('No cameras match your search.')).toBeInTheDocument();
  });

  it('shows a caregiver only the cameras in their areas', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);

    expect(await screen.findByText('3 cameras · 3 online')).toBeInTheDocument();
    expect(tiles().map((t) => t.getAttribute('aria-label'))).toEqual([
      'CAM-01 · Room 101, live, alert active',
      'CAM-02 · Room 102, live',
      'CAM-03 · Room 103, live',
    ]);
  });

  it('remembers the chosen layout', async () => {
    signInAs('u-teresa');
    const first = renderApp('/monitoring');
    await closeAlertPopup(first.user);
    await first.user.click(await screen.findByRole('button', { name: '4 per page' }));
    expect(tiles()).toHaveLength(4);
    first.unmount();

    const second = renderApp('/monitoring');
    await closeAlertPopup(second.user);
    await screen.findByText('Showing 4 of 11 cameras');
    expect(screen.getByRole('button', { name: '4 per page' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Single camera view (MON-02)', () => {
  it('shows the camera, its residents and recent detections', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);
    await user.click(await screen.findByRole('link', { name: /^CAM-01 · Room 101/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'CAM-01 · Room 101' })).toBeInTheDocument();
    expect(screen.getByText('Live feed · CAM-01')).toBeInTheDocument();
    expect(screen.getByText('Room 101 · East Wing')).toBeInTheDocument();
    expect(screen.getByText('1080p · 15 FPS')).toBeInTheDocument();

    const residents = await screen.findByRole('list', { name: 'Residents in this room' });
    expect(within(residents).getByText('Remedios Santos')).toBeInTheDocument();
    expect(within(residents).getByText('Lourdes Aquino')).toBeInTheDocument();
    expect(within(residents).queryByText('Ernesto Villanueva')).not.toBeInTheDocument();

    const detections = await screen.findByRole('list', { name: 'Recent detections' });
    expect(within(detections).getByRole('link', { name: 'INC-2026-0142' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Open alert' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Possible fall detected/ }),
    ).toBeInTheDocument();
  });

  it('explains an offline camera', async () => {
    signInAs('u-teresa');
    renderApp('/monitoring/CAM-07');
    expect(await screen.findByRole('heading', { level: 1, name: 'CAM-07 · Hallway B' })).toBeInTheDocument();
    expect(screen.getByText(/Camera is offline · last seen/)).toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('shows a 404 for a camera outside the caregiver areas', async () => {
    signInAs('u-joel');
    renderApp('/monitoring/CAM-07');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

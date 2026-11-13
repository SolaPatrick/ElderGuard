import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/node';
import { closeAlertPopup, renderApp, signInAs } from '../../test/renderApp';

async function openHealth() {
  signInAs('u-teresa');
  const app = renderApp('/cameras');
  await closeAlertPopup(app.user);
  await app.user.click(await screen.findByRole('link', { name: 'Device health' }));
  return app;
}

describe('Device health (CAM-06)', () => {
  it('shows the server, fall detection and every camera, problems first', async () => {
    await openHealth();
    expect(await screen.findByRole('heading', { level: 1, name: 'Device health' })).toBeInTheDocument();
    const serverPanel = screen.getByRole('region', { name: 'Server' });
    expect(await within(serverPanel).findByText('Responding')).toBeInTheDocument();
    expect(within(serverPanel).getByText(/Answered in \d+ ms/)).toBeInTheDocument();

    const detection = screen.getByRole('region', { name: 'Fall detection' });
    // Demo data: 11 cameras, CAM-07 offline and CAM-09 paused
    expect(await within(detection).findByText(/^9 of 11 cameras analysed/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Notifications and storage' })).getByText('Not reported'),
    ).toBeInTheDocument();

    const rows = within(screen.getByRole('table', { name: 'Camera health' }))
      .getAllByRole('row')
      .slice(1);
    expect(rows).toHaveLength(11);
    expect(rows[0]).toHaveTextContent('CAM-07');
    expect(screen.getByRole('heading', { name: 'Cameras · 1 need attention' })).toBeInTheDocument();
  });

  it('says when the server does not answer', async () => {
    const app = await openHealth();
    await screen.findByRole('heading', { level: 1, name: 'Device health' });
    server.use(http.get('/api/auth/me', () => HttpResponse.error()));
    await app.queryClient.refetchQueries({ queryKey: ['server-check'] });
    expect(
      await within(screen.getByRole('region', { name: 'Server' })).findByText('Not responding'),
    ).toBeInTheDocument();
  });
});

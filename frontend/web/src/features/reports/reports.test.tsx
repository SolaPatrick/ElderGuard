import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/node';
import { closeAlertPopup, renderApp, signInAs } from '../../test/renderApp';

async function openReports() {
  signInAs('u-teresa');
  const app = renderApp('/reports');
  await closeAlertPopup(app.user);
  return app;
}

const kpi = (label: string) =>
  within(screen.getByRole('list', { name: 'Key figures' })).getByRole('listitem', {
    name: new RegExp(`^${label}:`),
  });

describe('Reports & analytics (RPT-01)', () => {
  it('sums up the last 7 days of the demo data', async () => {
    await openReports();
    expect(await screen.findByRole('heading', { level: 1, name: 'Reports & analytics' })).toBeInTheDocument();
    await screen.findByRole('list', { name: 'Key figures' });
    // Demo data: 8 alerts in the last 3 days (6 falls, 2 SOS); 3 confirmed falls, 2 false alarms
    expect(kpi('Total alerts')).toHaveAccessibleName('Total alerts: 8');
    expect(kpi('Confirmed falls')).toHaveAccessibleName('Confirmed falls: 3');
    expect(kpi('False alarms')).toHaveAccessibleName('False alarms: 2');
    expect(kpi('False alarm rate')).toHaveAccessibleName('False alarm rate: 33%');
    expect(kpi('SOS alerts')).toHaveAccessibleName('SOS alerts: 2');

    const reasons = screen.getByRole('list', { name: 'False alarm reasons' });
    expect(within(reasons).getAllByRole('listitem')).toHaveLength(2);
    const byRoom = screen.getByRole('list', { name: 'Falls by location' });
    // Room 101 has one open fall and one false alarm: only the fall counts
    expect(within(byRoom).getByRole('listitem', { name: 'Room 101: 1' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Falls by day of the week and hour' })).toBeInTheDocument();
    expect(screen.getByText(/Camera uptime is not shown/)).toBeInTheDocument();
  });

  it('asks the server for the chosen whole days', async () => {
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => {
      const u = new URL(request.url);
      if (u.pathname === '/api/incidents' && u.searchParams.has('from')) asked.push(u.search);
    });
    const { user } = await openReports();
    await screen.findByRole('list', { name: 'Key figures' });
    const from = screen.getByLabelText('From');
    await user.clear(from);
    await user.type(from, '2026-01-01');
    const to = screen.getByLabelText('To');
    await user.clear(to);
    await user.type(to, '2026-01-31');

    expect(await screen.findByRole('listitem', { name: 'Total alerts: 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true');
    // Falls over time, by location, and by day and hour
    expect(screen.getAllByText('No falls in this period.')).toHaveLength(3);
    const last = new URLSearchParams(asked.at(-1));
    expect(new Date(last.get('from')!).getTime()).toBe(new Date(2026, 0, 1).getTime());
    expect(new Date(last.get('to')!).getTime()).toBe(new Date(2026, 1, 1).getTime());
    server.events.removeAllListeners();
  });

  it('refuses an end date before the start', async () => {
    const { user } = await openReports();
    await screen.findByRole('list', { name: 'Key figures' });
    const from = screen.getByLabelText('From');
    await user.clear(from);
    await user.type(from, '2099-01-01');
    expect(screen.getByText('Choose a start date on or before the end date.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Last 30 days' }));
    expect(await screen.findByRole('list', { name: 'Key figures' })).toBeInTheDocument();
  });

  it('offers to try again when the server fails', async () => {
    server.use(
      http.get('/api/incidents', ({ request }) =>
        new URL(request.url).searchParams.has('from') ? new HttpResponse(null, { status: 500 }) : undefined,
      ),
    );
    await openReports();
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('is only for the Admin/Head', async () => {
    signInAs('u-joel');
    renderApp('/reports');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });
});

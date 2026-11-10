import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { Incident } from '@elderguard/shared';
import { server } from '../../mocks/node';
import { renderApp, signInAs } from '../../test/renderApp';
import { NO_FILTERS, filterIncidents, incidentsCsv, readFilters, writeFilters } from './incidentFilters';

async function asAdmin(path: string) {
  signInAs('u-teresa');
  const app = renderApp(path);
  const popup = await screen.findByRole('alertdialog');
  await app.user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
  return app;
}

const codes = (hidden = false) =>
  within(screen.getByRole('table', { name: 'Incidents', hidden }))
    .getAllByRole('link', { hidden })
    .map((a) => a.textContent);
/** After the drawer closes, the page is no longer hidden from screen readers. */
const tableBack = () => screen.findByRole('table', { name: 'Incidents' });

const incident = (n: number, over: Partial<Incident> = {}): Incident => ({
  code: `INC-2026-${String(n).padStart(4, '0')}`,
  type: 'fall',
  status: 'resolved',
  resident: { id: 'res-x', fullName: 'Ana Reyes', age: 80, fallRisk: 'low' },
  room: { id: 'r-1', name: 'Room 1', wing: null },
  camera: null,
  sentBy: null,
  confidence: null,
  snapshotUrl: null,
  clipUrl: null,
  detectedAt: '2026-11-10T02:00:00.000Z',
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedAt: null,
  resolvedBy: null,
  escalatedAt: null,
  falseAlarmReason: null,
  outcome: null,
  ...over,
});

describe('Incident filters (logic)', () => {
  const now = new Date(2026, 10, 10, 15, 0); // 10 Nov 2026, 3:00 PM local time
  const at = (d: number, h: number) => new Date(2026, 10, d, h, 0).toISOString();
  const list = [
    incident(1, { detectedAt: at(10, 9) }),
    incident(2, { detectedAt: at(4, 9) }),
    incident(3, { detectedAt: at(3, 23) }),
    incident(4, { detectedAt: at(1, 9), status: 'false_alarm' }),
  ];
  const run = (patch: Partial<typeof NO_FILTERS>) =>
    filterIncidents(list, { ...NO_FILTERS, ...patch }, now).map((i) => i.code.slice(-1));

  it('counts "Last 7 days" as today and the 6 days before, in local time', () => {
    expect(run({ date: 'today' })).toEqual(['1']);
    expect(run({})).toEqual(['1', '2']);
    expect(run({ date: '30d' })).toEqual(['1', '2', '3', '4']);
  });

  it('includes both ends of a custom range', () => {
    expect(run({ date: 'custom', from: '2026-11-03', to: '2026-11-04' })).toEqual(['2', '3']);
    expect(run({ date: 'custom', from: '', to: '2026-11-01' })).toEqual(['4']);
  });

  it('treats a resolved incident as confirmed and a false alarm as not', () => {
    expect(run({ date: 'all', classification: 'false_alarm' })).toEqual(['4']);
    expect(run({ date: 'all', classification: 'confirmed' })).toEqual(['1', '2', '3']);
  });

  it('keeps filters in the link and ignores values it does not know', () => {
    const f = { ...NO_FILTERS, search: 'room 1', statuses: ['new' as const], date: 'all' as const };
    expect(readFilters(writeFilters(f))).toEqual(f);
    expect(writeFilters(NO_FILTERS).toString()).toBe('');
    expect(readFilters(new URLSearchParams('status=new,bogus&date=yesterday&from=x'))).toEqual({
      ...NO_FILTERS,
      statuses: ['new'],
    });
  });

  it('writes a CSV that spreadsheets will not run as a formula', () => {
    const csv = incidentsCsv([
      incident(7, {
        resident: { id: 'r', fullName: '=HYPERLINK("x")', age: null, fallRisk: 'low' },
        acknowledgedAt: '2026-11-10T02:00:48.000Z',
        acknowledgedBy: { id: 'u', fullName: 'Mark Dizon' },
      }),
    ]);
    const [header, row] = csv.trim().split('\r\n');
    expect(header).toBe(
      '"ID","Type","Resident / sender","Location","Detected at","Status","Handled by","Response time"',
    );
    expect(row).toContain('"\'=HYPERLINK(""x"")"');
    expect(row).toContain('"Mark Dizon","0m 48s"');
  });
});

describe('Incident history (INC-01)', () => {
  it('lists recent incidents with who handled them and how fast', async () => {
    await asAdmin('/incidents');
    expect(await screen.findByRole('heading', { level: 1, name: 'Incidents' })).toBeInTheDocument();
    expect(await screen.findByText('Showing 1–8 of 8 incidents')).toBeInTheDocument();
    expect(codes()[0]).toBe('INC-2026-0142');
    const sos = screen.getByRole('row', { name: /^INC-2026-0141/ });
    expect(within(sos).getByText('SOS')).toBeInTheDocument();
    expect(within(sos).getByText('Mark Dizon')).toBeInTheDocument();
    expect(within(sos).getByText('0m 48s')).toBeInTheDocument();
    const fresh = screen.getByRole('row', { name: /^INC-2026-0142/ });
    expect(within(fresh).getAllByText('—')).toHaveLength(2);
  });

  it('filters by status and search, and remembers them in the link', async () => {
    const { user, router } = await asAdmin('/incidents');
    await screen.findByText('Showing 1–8 of 8 incidents');
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'False alarm' }));
    expect(codes()).toEqual(['INC-2026-0139', 'INC-2026-0136']);
    expect(router.state.location.search).toBe('?status=false_alarm');

    await user.type(screen.getByRole('textbox', { name: 'Search incidents' }), 'room 104');
    expect(codes()).toEqual(['INC-2026-0139']);
  });

  it('opens with the filters from the link', async () => {
    await asAdmin('/incidents?type=sos&date=all');
    expect(await screen.findByText('Showing 1–2 of 2 incidents')).toBeInTheDocument();
    expect(codes()).toEqual(['INC-2026-0141', 'INC-2026-0135']);
    expect(screen.getByRole('button', { name: 'More filters (1)' })).toBeInTheDocument();
  });

  it('explains when nothing matches, and clears everything', async () => {
    const { user, router } = await asAdmin('/incidents');
    await screen.findByText('Showing 1–8 of 8 incidents');
    await user.type(screen.getByRole('textbox', { name: 'Search incidents' }), 'nobody here');
    expect(screen.getByText('No incidents match your search')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    expect(screen.getByText('Showing 1–8 of 8 incidents')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?date=all');
  });

  it('pages through long histories, 25 at a time', async () => {
    server.use(
      http.get('/api/incidents', ({ request }) =>
        new URL(request.url).searchParams.get('scope') !== 'all'
          ? undefined
          : HttpResponse.json(
              Array.from({ length: 30 }, (_, n) =>
                incident(100 - n, { detectedAt: new Date(Date.now() - (n + 1) * 60_000).toISOString() }),
              ),
            ),
      ),
    );
    const { user } = await asAdmin('/incidents');
    expect(await screen.findByText('Showing 1–25 of 30 incidents')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(screen.getByText('Showing 26–30 of 30 incidents')).toBeInTheDocument();
    expect(codes()).toHaveLength(5);
  });

  it('tells caregivers the list only has their own records', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/incidents');
    const popup = await screen.findByRole('alertdialog');
    await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
    expect(
      await screen.findByText(/Records for the residents and rooms assigned to you/),
    ).toBeInTheDocument();
  });
});

describe('Advanced filters (INC-02)', () => {
  it('applies drawer filters only on "Apply", shows them as chips, and removes one', async () => {
    const { user } = await asAdmin('/incidents?date=all');
    await screen.findByText('Showing 1–8 of 8 incidents');
    await user.click(screen.getByRole('button', { name: 'More filters' }));
    const drawer = screen.getByRole('dialog', { name: 'Filters' });
    await user.click(
      within(within(drawer).getByRole('group', { name: 'Type' })).getByRole('button', { name: 'SOS' }),
    );
    await user.click(
      within(within(drawer).getByRole('group', { name: 'Classification' })).getByRole('button', {
        name: 'Confirmed incident',
      }),
    );
    expect(codes(true)).toHaveLength(8);
    await user.click(within(drawer).getByRole('button', { name: 'Apply filters' }));

    await tableBack();
    expect(codes()).toEqual(['INC-2026-0135']);
    expect(screen.getByRole('button', { name: 'More filters (2)' })).toBeInTheDocument();
    const chips = screen.getByRole('list', { name: 'Active filters' });
    const typeChip = within(chips).getByText('Type: SOS').closest('[role="listitem"]') as HTMLElement;
    await user.click(within(typeChip).getByTestId('CancelIcon'));
    expect(codes()).toEqual(['INC-2026-0140', 'INC-2026-0138', 'INC-2026-0137', 'INC-2026-0135']);
  });

  it('filters by who handled the incident', async () => {
    const { user } = await asAdmin('/incidents?date=all');
    await screen.findByText('Showing 1–8 of 8 incidents');
    await user.click(screen.getByRole('button', { name: 'More filters' }));
    const drawer = screen.getByRole('dialog', { name: 'Filters' });
    await user.click(within(drawer).getByRole('combobox', { name: 'Handled by' }));
    await user.click(screen.getByRole('option', { name: 'Mark Dizon' }));
    await user.click(within(drawer).getByRole('button', { name: 'Apply filters' }));
    await tableBack();
    expect(codes()).toContain('INC-2026-0141');
    expect(screen.getByText('Handled by Mark Dizon')).toBeInTheDocument();
    for (const row of within(screen.getByRole('table', { name: 'Incidents' }))
      .getAllByRole('row')
      .slice(1)) {
      expect(row).toHaveTextContent('Mark Dizon');
    }
  });

  it('refuses a date range that ends before it starts', async () => {
    const { user } = await asAdmin('/incidents');
    await screen.findByText(/Showing 1–8/);
    await user.click(screen.getByRole('button', { name: 'More filters' }));
    const drawer = screen.getByRole('dialog', { name: 'Filters' });
    await user.type(within(drawer).getByLabelText('From'), '2026-11-09');
    await user.type(within(drawer).getByLabelText('To'), '2026-11-02');
    expect(within(drawer).getByText('Pick a day on or after the start')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Apply filters' })).toBeDisabled();
  });
});

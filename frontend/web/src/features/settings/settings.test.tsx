import { describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/node';
import { closeAlertPopup, renderApp, signInAs } from '../../test/renderApp';

async function openSettings(path = '/settings') {
  signInAs('u-teresa');
  const app = renderApp(path);
  await closeAlertPopup(app.user);
  return app;
}

describe('Settings (SET-01 to SET-04)', () => {
  it('opens General first, and renaming the facility updates the top bar', async () => {
    const { user, router } = await openSettings();
    const form = await screen.findByRole('form', { name: 'General' });
    expect(router.state.location.pathname).toBe('/settings/general');
    const save = within(form).getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();

    const name = within(form).getByRole('textbox', { name: /Facility name/ });
    await user.clear(name);
    await user.click(save);
    expect(await within(form).findByText('Enter the facility name')).toBeInTheDocument();

    await user.type(name, 'Sunrise Home');
    await user.click(save);
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(await screen.findByText('Sunrise Home')).toBeInTheDocument(); // top bar
    expect(within(form).getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('starts detection with the same values as the server, and checks the limits', async () => {
    const { user } = await openSettings('/settings/detection');
    const form = await screen.findByRole('form', { name: 'Detection & monitoring' });
    expect(within(form).getByRole('slider', { name: /Detection confidence/ })).toHaveValue('0.4');
    const cooldown = within(form).getByRole('spinbutton', { name: 'Duplicate alert cooldown' });
    expect(cooldown).toHaveValue(60);
    expect(within(form).getByText('Pictures are kept until someone deletes them.')).toBeInTheDocument();

    await user.clear(cooldown);
    await user.type(cooldown, '5');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect(await within(form).findByText('Use at least 10 seconds')).toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: 'Discard changes' }));
    expect(cooldown).toHaveValue(60);
    await user.click(within(form).getByRole('switch', { name: 'Delete alert pictures after a while' }));
    expect(within(form).getByRole('spinbutton', { name: 'Keep pictures for' })).toHaveValue(90);
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
  });

  it('saves notification and security settings and logs the change', async () => {
    const { user, router } = await openSettings('/settings/notifications');
    const form = await screen.findByRole('form', { name: 'Notifications' });
    expect(within(form).getByRole('switch', { name: 'In the app (always on)' })).toBeDisabled();
    await user.click(
      within(form).getByRole('switch', { name: 'Tell the Admin/Head when nobody acknowledges' }),
    );
    expect(within(form).queryByRole('spinbutton', { name: 'After' })).not.toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Security' }));
    const security = await screen.findByRole('form', { name: 'Security' });
    const hours = within(security).getByRole('spinbutton', { name: 'Login lasts' });
    expect(hours).toHaveValue(8);
    await user.clear(hours);
    await user.type(hours, '13');
    await user.click(within(security).getByRole('button', { name: 'Save changes' }));
    expect(await within(security).findByText('Use at most 12 hours')).toBeInTheDocument();

    await act(() => router.navigate('/activity'));
    const log = await screen.findByRole('table', { name: 'Activity log' });
    expect(within(log).getAllByRole('row')[1]).toHaveTextContent('Settings');
  });

  it('explains when the server has no settings', async () => {
    server.use(
      http.get('/api/settings', () =>
        HttpResponse.json(
          { code: 'not_implemented', message: 'Settings is not available on the server yet.' },
          { status: 501 },
        ),
      ),
    );
    await openSettings();
    expect(await screen.findByText(/Settings can't be changed from the app yet/)).toBeInTheDocument();
    expect(screen.getByText('Demo Home for the Aged')).toBeInTheDocument();
  });

  it('is only for the Admin/Head', async () => {
    signInAs('u-joel');
    renderApp('/settings');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });
});

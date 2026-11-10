import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/node';
import { api } from '../../api/endpoints';
import { tokenStorage } from '../../auth/tokenStorage';
import { renderApp, signInAs } from '../../test/renderApp';

type Ui = ReturnType<typeof renderApp>['user'];

async function closeAlertPopup(user: Ui) {
  const popup = await screen.findByRole('alertdialog');
  await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
}

/** Opens a page as the Admin/Head, with the fall alert popup out of the way. */
async function asAdmin(path: string) {
  signInAs('u-teresa');
  const app = renderApp(path);
  await closeAlertPopup(app.user);
  return app;
}

const rowNames = () =>
  within(screen.getByRole('table', { name: 'Users' }))
    .getAllByRole('link')
    .map((a) => a.textContent);

/** Logs in through the fake API, the way the login screen does. */
async function canLogIn(username: string, password: string) {
  try {
    const res = await api.login({ username, password });
    return res.user;
  } catch {
    return null;
  }
}

describe('User list (USR-01)', () => {
  it('lists every account with role, areas and status', async () => {
    await asAdmin('/users');
    expect(await screen.findByText('5 accounts · 4 active')).toBeInTheDocument();
    expect(rowNames()).toEqual([
      'Angelica Cruz',
      'Joel Ramos',
      'Liza Fernandez',
      'Ma. Teresa Reyes',
      'Mark Dizon',
    ]);
    const joel = screen.getByRole('row', { name: /Joel Ramos/ });
    expect(within(joel).getByText('Employee')).toBeInTheDocument();
    expect(within(joel).getByText('Room 101, Room 102, Room 103')).toBeInTheDocument();
    expect(within(joel).getByText('Active')).toBeInTheDocument();
    const teresa = screen.getByRole('row', { name: /Ma. Teresa Reyes/ });
    expect(within(teresa).getByText('All areas')).toBeInTheDocument();
    const liza = screen.getByRole('row', { name: /Liza Fernandez/ });
    expect(within(liza).getByText('Deactivated')).toBeInTheDocument();
  });

  it('filters by search, role and status', async () => {
    const { user } = await asAdmin('/users');
    await screen.findByText('5 accounts · 4 active');

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Deactivated' }));
    expect(rowNames()).toEqual(['Liza Fernandez']);

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'All' }));
    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(screen.getByRole('option', { name: 'Admin/Head' }));
    expect(rowNames()).toEqual(['Ma. Teresa Reyes']);

    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(screen.getByRole('option', { name: 'All' }));
    await user.type(screen.getByRole('textbox', { name: 'Search users' }), 'mark.dizon');
    expect(rowNames()).toEqual(['Mark Dizon']);
  });

  it('is only for the Admin/Head', async () => {
    signInAs('u-joel');
    renderApp('/users');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Users' })).not.toBeInTheDocument();
  });
});

describe('Create user (USR-02, USR-03)', () => {
  it('creates a caregiver, shows the temporary password once, and that password works', async () => {
    const { user, router } = await asAdmin('/users/new');

    await user.type(await screen.findByRole('textbox', { name: 'Full name' }), 'Rosa Villanueva');
    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'Rosa.Villanueva');
    await user.click(await screen.findByRole('checkbox', { name: 'Room 104 · West Wing' }));
    await user.click(screen.getByRole('checkbox', { name: 'Garden Walkway' }));
    await user.click(screen.getAllByRole('button', { name: 'Create user' }).at(-1)!);

    const dialog = await screen.findByRole('dialog', { name: 'User created' });
    expect(within(dialog).getByLabelText('Username')).toHaveTextContent('rosa.villanueva');
    const password = within(dialog).getByLabelText('Temporary password').textContent ?? '';
    expect(password).toMatch(/^[A-Za-z0-9]{12}$/);

    const signedIn = await canLogIn('rosa.villanueva', password);
    expect(signedIn).toMatchObject({
      fullName: 'Rosa Villanueva',
      role: 'employee',
      mustChangePassword: true,
    });
    expect(signedIn?.areas.map((a) => a.name)).toEqual(['Room 104', 'Garden Walkway']);

    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Rosa Villanueva' })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/users\/u-\d+$/);
    expect(screen.getByText('Temporary password not changed yet')).toBeInTheDocument();
    expect(screen.queryByText(password)).not.toBeInTheDocument();
  });

  it('checks the form and shows server errors', async () => {
    const { user } = await asAdmin('/users/new');
    const submit = () => user.click(screen.getAllByRole('button', { name: 'Create user' }).at(-1)!);

    await submit();
    expect(await screen.findByText('Enter the full name')).toBeInTheDocument();
    expect(screen.getByText('Use at least 3 characters')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Full name' }), 'Another Joel');
    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'joel ramos');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'not-an-email');
    await submit();
    expect(
      await screen.findByText('Use only lowercase letters, numbers, dots, dashes and underscores'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address, or leave it empty')).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'Username' }));
    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'joel.ramos');
    await user.clear(screen.getByRole('textbox', { name: 'Email' }));
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('That username is already taken.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('hides area assignment for an Admin/Head', async () => {
    const { user } = await asAdmin('/users/new');
    expect(await screen.findByRole('checkbox', { name: 'Lobby' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Admin/Head' }));
    expect(screen.queryByRole('checkbox', { name: 'Lobby' })).not.toBeInTheDocument();
    expect(screen.getAllByText('The Admin/Head sees every room and area.').length).toBeGreaterThan(0);
  });
});

describe('User detail and edit (USR-04, USR-05)', () => {
  it('shows the profile and assigned rooms', async () => {
    await asAdmin('/users/u-joel');
    expect(await screen.findByRole('heading', { level: 1, name: 'Joel Ramos' })).toBeInTheDocument();
    expect(screen.getByText('Employee · joel.ramos')).toBeInTheDocument();
    expect(screen.getByText('joel.ramos@demohome.example')).toBeInTheDocument();
    const rooms = screen.getByLabelText('Assigned rooms');
    expect(within(rooms).getByText('Room 101 · East Wing')).toBeInTheDocument();
    expect(within(rooms).getAllByText(/Room/)).toHaveLength(3);
  });

  it('edits the name and rooms, and the change is used right away', async () => {
    const { user } = await asAdmin('/users/u-joel/edit');
    const name = await screen.findByRole('textbox', { name: 'Full name' });
    expect(screen.getByRole('textbox', { name: 'Username' })).toBeDisabled();
    await user.clear(name);
    await user.type(name, 'Joel B. Ramos');
    await user.click(await screen.findByRole('checkbox', { name: 'Room 103 · East Wing' }));
    await user.click(screen.getByRole('checkbox', { name: 'Lobby' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Joel B. Ramos' })).toBeInTheDocument();
    const rooms = screen.getByLabelText('Assigned rooms');
    expect(within(rooms).queryByText('Room 103 · East Wing')).not.toBeInTheDocument();
    expect(within(rooms).getByText('Lobby')).toBeInTheDocument();

    const signedIn = await canLogIn('joel.ramos', 'elderguard123');
    expect(signedIn?.fullName).toBe('Joel B. Ramos');
    expect(signedIn?.areas.map((a) => a.name)).toEqual(['Room 101', 'Room 102', 'Lobby']);
  });

  it("doesn't let the Admin/Head deactivate themselves", async () => {
    await asAdmin('/users/u-teresa');
    expect(await screen.findByText('Admin/Head · teresa.reyes · You')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeDisabled();
  });

  it("doesn't let the Admin/Head change their own role", async () => {
    await asAdmin('/users/u-teresa/edit');
    expect(await screen.findByRole('radio', { name: 'Employee' })).toBeDisabled();
    expect(screen.getByText("You can't change your own role.")).toBeInTheDocument();
  });

  it('shows "not found" for an unknown user', async () => {
    await asAdmin('/users/u-nobody');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('Deactivate, reactivate and reset password (USR-06, USR-07, USR-08)', () => {
  it('deactivates an account so it can no longer log in', async () => {
    const { user } = await asAdmin('/users/u-mark');
    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate Mark Dizon?' });
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate user' }));

    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
    expect(await canLogIn('mark.dizon', 'elderguard123')).toBeNull();

    // Mark's open session stops working too.
    tokenStorage.set('mock-token:u-mark', false);
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
  });

  it('reactivates with a new temporary password', async () => {
    const { user } = await asAdmin('/users/u-liza');
    await user.click(await screen.findByRole('button', { name: 'Reactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Reactivate Liza Fernandez?' });
    expect(within(dialog).getByRole('checkbox', { name: 'Issue a new temporary password' })).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Reactivate user' }));

    const creds = await screen.findByRole('dialog', { name: 'New temporary password' });
    const password = within(creds).getByLabelText('Temporary password').textContent ?? '';
    expect(await canLogIn('liza.fernandez', 'elderguard123')).toBeNull();
    expect(await canLogIn('liza.fernandez', password)).toMatchObject({ mustChangePassword: true });
    await user.click(within(creds).getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeEnabled();
  });

  it('reactivates with the old password when asked to', async () => {
    const { user } = await asAdmin('/users/u-liza');
    await user.click(await screen.findByRole('button', { name: 'Reactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Reactivate Liza Fernandez?' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Issue a new temporary password' }));
    await user.click(within(dialog).getByRole('button', { name: 'Reactivate user' }));

    expect(await screen.findByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await canLogIn('liza.fernandez', 'elderguard123')).toMatchObject({ mustChangePassword: false });
  });

  it('resets a password after confirming, and the old one stops working', async () => {
    const { user } = await asAdmin('/users/u-joel');
    await user.click(await screen.findByRole('button', { name: 'Reset password' }));
    const confirm = screen.getByRole('dialog', { name: "Reset Joel Ramos's password?" });
    await user.click(within(confirm).getByRole('button', { name: 'Reset password' }));

    const creds = await screen.findByRole('dialog', { name: 'New temporary password' });
    expect(within(creds).getByText('For Joel Ramos (joel.ramos).')).toBeInTheDocument();
    const password = within(creds).getByLabelText('Temporary password').textContent ?? '';
    expect(await canLogIn('joel.ramos', 'elderguard123')).toBeNull();
    expect(await canLogIn('joel.ramos', password)).toMatchObject({ mustChangePassword: true });
  });

  it('keeps the dialog open and shows why when the server refuses', async () => {
    server.use(
      http.post('/api/users/:id/deactivate', () =>
        HttpResponse.json({ code: 'conflict', message: 'Try again in a moment.' }, { status: 409 }),
      ),
    );
    const { user } = await asAdmin('/users/u-mark');
    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate Mark Dizon?' });
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate user' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Try again in a moment.');
    expect(screen.getByRole('dialog', { name: 'Deactivate Mark Dizon?' })).toBeInTheDocument();
  });

  it('refuses to demote the only active Admin/Head', async () => {
    signInAs('u-teresa');
    await expect(
      api.updateStaff('u-teresa', {
        fullName: 'Ma. Teresa Reyes',
        email: null,
        role: 'employee',
        areaIds: [],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

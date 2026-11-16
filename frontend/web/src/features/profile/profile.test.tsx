import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp, signInAs } from '../../test/renderApp';

async function closeAlertPopup(user: ReturnType<typeof renderApp>['user']) {
  const popup = await screen.findByRole('alertdialog');
  await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
}

describe('My profile (PRF-01)', () => {
  it('opens from the account menu and shows a caregiver their details, read-only', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/');
    await closeAlertPopup(user);
    await user.click(screen.getByRole('button', { name: /Joel Ramos/ }));
    await user.click(screen.getByRole('menuitem', { name: 'My profile' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'My profile' })).toBeInTheDocument();
    expect(screen.getByText('joel.ramos')).toBeInTheDocument();
    expect(screen.getByText('joel.ramos@demohome.example')).toBeInTheDocument();
    expect(screen.getByText('Employee · Caregiver')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Assigned rooms')).getByText(/Room 101/)).toBeInTheDocument();
    expect(screen.getByText(/Ask your Admin\/Head to change/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit my details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('lets the Admin/Head edit their own details in Users & access', async () => {
    signInAs('u-teresa');
    const { user, router } = renderApp('/profile');
    await closeAlertPopup(user);
    expect(screen.getByText('All rooms and areas')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Edit my details' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/users/u-teresa/edit'));
  });

  it('changes the password and comes back to the profile', async () => {
    signInAs('u-joel');
    const { user, router } = renderApp('/profile');
    await closeAlertPopup(user);
    await user.click(screen.getByRole('link', { name: 'Change password' }));
    expect(await screen.findByRole('heading', { name: 'Change your password' })).toBeInTheDocument();
    // Not forced: the page offers Cancel instead of Log out.
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Current password/), 'elderguard123');
    await user.type(screen.getByLabelText(/^New password/), 'new-secret-123');
    await user.type(screen.getByLabelText(/^Confirm new password/), 'new-secret-123');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
  });

  it('Cancel on Change password goes back to the profile', async () => {
    signInAs('u-joel');
    const { user, router } = renderApp('/profile');
    await closeAlertPopup(user);
    await user.click(screen.getByRole('link', { name: 'Change password' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
  });
});

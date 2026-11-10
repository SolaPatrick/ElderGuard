import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp, signInAs } from '../../test/renderApp';
import { db } from '../../mocks/db';

function mustChange(userId: string) {
  db.findUserById(userId)!.mustChangePassword = true;
}

describe('Change password', () => {
  it('sends someone with a temporary password to change it first, then continues', async () => {
    mustChange('u-joel');
    signInAs('u-joel');
    const { user, router } = renderApp('/incidents');

    expect(await screen.findByRole('heading', { name: 'Change your password' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/change-password');

    await user.type(screen.getByLabelText(/^Current password/), 'elderguard123');
    await user.type(screen.getByLabelText(/^New password/), 'short');
    await user.type(screen.getByLabelText(/^Confirm new password/), 'different');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('The two new passwords are different')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^New password/));
    await user.type(screen.getByLabelText(/^New password/), 'a-better-pass');
    await user.clear(screen.getByLabelText(/^Confirm new password/));
    await user.type(screen.getByLabelText(/^Confirm new password/), 'a-better-pass');
    await user.click(screen.getByRole('button', { name: 'Save password' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Incidents' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/incidents');
  });

  it('shows the server message when the current password is wrong', async () => {
    mustChange('u-joel');
    signInAs('u-joel');
    const { user } = renderApp('/');
    await screen.findByRole('heading', { name: 'Change your password' });

    await user.type(screen.getByLabelText(/^Current password/), 'not-it');
    await user.type(screen.getByLabelText(/^New password/), 'a-better-pass');
    await user.type(screen.getByLabelText(/^Confirm new password/), 'a-better-pass');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your current password is wrong.');
  });
});

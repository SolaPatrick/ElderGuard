import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { closeAlertPopup, renderApp, signInAs } from '../test/renderApp';

describe('Role-based access', () => {
  it('hides admin pages from caregivers in the sidebar', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/incidents');
    // The test window is narrow, so the sidebar sits behind the menu button.
    await user.click(await screen.findByRole('button', { name: 'Open menu' }));
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(nav).toHaveTextContent('My Residents');
    expect(nav).not.toHaveTextContent('Users & Access');
  });

  it('blocks caregivers who open an admin URL directly', async () => {
    signInAs('u-joel');
    renderApp('/settings');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });

  it('lets the Admin/Head open admin pages', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/settings');
    // The sample fall alert's popup covers the page until it is closed.
    await closeAlertPopup(user);
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('sends users back to login when their session is no longer valid', async () => {
    localStorage.setItem('elderguard.token', 'mock-token:someone-deleted');
    const { user } = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Your session has expired' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log in again' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});

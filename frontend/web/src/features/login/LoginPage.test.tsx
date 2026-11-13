import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { markAlertSetupDone } from '../alertSetup/alertPrefs';

describe('Login (AUTH-01)', () => {
  it('sends signed-out visitors to the login page', async () => {
    renderApp('/alerts');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('asks for both fields before calling the server', async () => {
    const { user } = renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter your username or email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
  });

  it('shows a clear error for a wrong password', async () => {
    const { user } = renderApp('/login');
    await user.type(await screen.findByRole('textbox', { name: /username or email/i }), 'joel.ramos');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.');
  });

  it('blocks deactivated accounts', async () => {
    const { user } = renderApp('/login');
    await user.type(await screen.findByRole('textbox', { name: /username or email/i }), 'liza.fernandez');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'elderguard123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/deactivated/i);
  });

  it('logs in and returns to the page the user asked for', async () => {
    markAlertSetupDone('u-teresa'); // the setup screen after login is tested in alertSetup.test.tsx
    const { user, router } = renderApp('/incidents');
    await user.type(await screen.findByRole('textbox', { name: /username or email/i }), 'teresa.reyes');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'elderguard123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Incidents' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/incidents');
  });
});

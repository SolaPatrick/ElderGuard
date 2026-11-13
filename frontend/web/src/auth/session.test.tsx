import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/node';
import { renderApp } from '../test/renderApp';
import { tokenStorage } from './tokenStorage';
import { tokenExpiresAt } from './sessionExpiry';

/** Signs in with a token that ends `msLeft` from now. */
function signInEndingIn(userId: string, msLeft: number) {
  localStorage.setItem('elderguard.token', `mock-token:${userId}:${Date.now() + msLeft}`);
}

async function closeAlertPopup(user: ReturnType<typeof renderApp>['user']) {
  const popup = await screen.findByRole('alertdialog');
  await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
}

describe('Login end time', () => {
  it("reads Den's JWT exp and the fake server's tokens", () => {
    const b64 = (o: object) =>
      btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    expect(tokenExpiresAt(`${b64({ alg: 'HS256' })}.${b64({ sub: '2', exp: 1_800_000_000 })}.sig`)).toBe(
      1_800_000_000_000,
    );
    expect(tokenExpiresAt('mock-token:u-joel:1800000000000')).toBe(1_800_000_000_000);
    expect(tokenExpiresAt('mock-token:u-joel')).toBeNull();
    expect(tokenExpiresAt('not a token')).toBeNull();
    expect(tokenExpiresAt(`x.${b64({ sub: '2' })}.y`)).toBeNull();
    expect(tokenExpiresAt(null)).toBeNull();
  });
});

describe('Session expired (AUTH-09)', () => {
  it('explains why, then shows the login form and returns to the page', async () => {
    localStorage.setItem('elderguard.token', `mock-token:u-joel:${Date.now() - 1000}`);
    const { user, router } = renderApp('/incidents');
    expect(await screen.findByRole('heading', { name: 'Your session has expired' })).toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Log in again' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.state).toMatchObject({ from: '/incidents' });
  });
});

describe('Server not reachable when the page opens (SYS-04)', () => {
  it('keeps the login and tries again instead of saying the session expired', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.error()));
    localStorage.setItem('elderguard.token', 'mock-token:u-joel');
    const { user } = renderApp('/');
    expect(await screen.findByRole('heading', { name: "Can't reach ElderGuard" })).toBeInTheDocument();
    expect(screen.queryByText(/session has expired/)).not.toBeInTheDocument();
    expect(tokenStorage.get()).toBe('mock-token:u-joel');

    server.resetHandlers(); // the server is back
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument(); // signed in: the alert popup shows
  });

  it('treats a server error (5xx) the same way', async () => {
    server.use(http.get('/api/auth/me', () => new HttpResponse(null, { status: 502 })));
    localStorage.setItem('elderguard.token', 'mock-token:u-joel');
    renderApp('/');
    expect(await screen.findByText(/not answering \(error 502\)/)).toBeInTheDocument();
    expect(tokenStorage.get()).toBe('mock-token:u-joel');
  });
});

describe('Session timeout warning (AUTH-10)', () => {
  it('does not show while the login has more than 5 minutes left', async () => {
    signInEndingIn('u-joel', 6 * 60_000);
    const { user } = renderApp('/');
    await closeAlertPopup(user);
    expect(screen.queryByRole('dialog', { name: 'Your session is about to expire' })).not.toBeInTheDocument();
  });

  it('counts down, and a wrong password says so', async () => {
    signInEndingIn('u-joel', 4 * 60_000 + 30_000);
    const { user } = renderApp('/');
    // A fall alert stays on top of the warning; the warning is there once it is closed.
    await closeAlertPopup(user);
    const dialog = await screen.findByRole('dialog', { name: 'Your session is about to expire' });
    expect(within(dialog).getByText(/^4:(30|29|28)$/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Password'), 'wrong-password');
    await user.click(within(dialog).getByRole('button', { name: 'Stay signed in' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Incorrect username or password.');
  });

  it('gets a new login with the password and closes', async () => {
    signInEndingIn('u-joel', 2 * 60_000);
    const { user } = renderApp('/');
    await closeAlertPopup(user);
    const dialog = await screen.findByRole('dialog', { name: 'Your session is about to expire' });
    await user.type(within(dialog).getByLabelText('Password'), 'elderguard123');
    await user.click(within(dialog).getByRole('button', { name: 'Stay signed in' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Your session is about to expire' }),
      ).not.toBeInTheDocument(),
    );
    // The new login lasts a full shift again.
    expect(tokenExpiresAt(tokenStorage.get())! - Date.now()).toBeGreaterThan(7 * 3600_000);
  });

  it('can be closed, or used to log out', async () => {
    signInEndingIn('u-joel', 2 * 60_000);
    const first = renderApp('/');
    await closeAlertPopup(first.user);
    let dialog = await screen.findByRole('dialog', { name: 'Your session is about to expire' });
    await first.user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Your session is about to expire' }),
      ).not.toBeInTheDocument(),
    );
    first.unmount();

    const second = renderApp('/');
    await closeAlertPopup(second.user);
    dialog = await screen.findByRole('dialog', { name: 'Your session is about to expire' });
    await second.user.click(within(dialog).getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
  });
});

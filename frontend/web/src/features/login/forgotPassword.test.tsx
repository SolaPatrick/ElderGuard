import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { api } from '../../api/endpoints';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { renderApp } from '../../test/renderApp';

// The fake API "emails" codes to the console.
vi.spyOn(console, 'info').mockImplementation(() => {});

async function canLogIn(username: string, password: string) {
  try {
    await api.login({ username, password });
    return true;
  } catch {
    return false;
  }
}

describe('Forgot password (AUTH-02 to AUTH-05)', () => {
  it('resets the password with the emailed code', async () => {
    const { user } = renderApp('/login');
    await user.type(await screen.findByRole('textbox', { name: 'Username or email' }), 'joel.ramos');
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(await screen.findByRole('heading', { name: 'Forgot password' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Username or email' })).toHaveValue('joel.ramos');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByRole('heading', { name: 'Enter the code' })).toBeInTheDocument();
    expect(screen.getByText(/We sent a 6-digit code to j\*\*\*@demohome\.example/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send a new code in \d+ s/ })).toBeDisabled();

    const code = db.lastResetCode('u-joel')!;
    const wrong = code === '000000' ? '111111' : '000000';
    const field = screen.getByRole('textbox', { name: '6-digit code' });
    await user.type(field, wrong);
    await user.click(screen.getByRole('button', { name: 'Verify code' }));
    expect(
      await screen.findByText("That code isn't right. Check the email and try again."),
    ).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, code);
    await user.click(screen.getByRole('button', { name: 'Verify code' }));

    expect(await screen.findByRole('heading', { name: 'Set a new password' })).toBeInTheDocument();
    const rules = screen.getByRole('list', { name: 'Password rules' });
    expect(within(rules).getByText(/At least 8 characters/)).toHaveTextContent('(not yet)');
    await user.type(screen.getByLabelText(/^New password/), 'garden-walk-42');
    await user.type(screen.getByLabelText(/^Confirm new password/), 'garden-walk-4');
    expect(within(rules).getByText(/At least 8 characters/)).toHaveTextContent('(done)');
    expect(within(rules).getByText(/Both passwords match/)).toHaveTextContent('(not yet)');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(screen.getByText('The two passwords are different')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Confirm new password/), '2');
    await user.click(screen.getByRole('button', { name: 'Save password' }));

    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument();
    expect(await canLogIn('joel.ramos', 'garden-walk-42')).toBe(true);
    expect(await canLogIn('joel.ramos', 'elderguard123')).toBe(false);
    // The code works once.
    await expect(api.verifyResetCode({ login: 'joel.ramos', code })).rejects.toMatchObject({ status: 400 });
  });

  it("doesn't say whether an account exists", async () => {
    const { user } = renderApp('/forgot-password');
    await user.type(await screen.findByRole('textbox', { name: 'Username or email' }), 'nobody.here');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(
      await screen.findByText(/If “nobody.here” has an email address, we sent a 6-digit code to it/),
    ).toBeInTheDocument();
  });

  it('expires the code after too many wrong tries', async () => {
    await api.forgotPassword({ login: 'joel.ramos' });
    const code = db.lastResetCode('u-joel')!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) {
      await expect(api.verifyResetCode({ login: 'joel.ramos', code: wrong })).rejects.toMatchObject({
        status: 400,
      });
    }
    await expect(api.verifyResetCode({ login: 'joel.ramos', code: wrong })).rejects.toMatchObject({
      status: 410,
    });
    await expect(api.verifyResetCode({ login: 'joel.ramos', code })).rejects.toMatchObject({ status: 410 });
  });

  it('points to the Admin/Head when the server has no password reset', async () => {
    server.use(
      http.post('/api/auth/forgot-password', () =>
        HttpResponse.json({ code: 'not_implemented', message: 'Not available yet.' }, { status: 501 }),
      ),
    );
    const { user } = renderApp('/forgot-password');
    await user.type(await screen.findByRole('textbox', { name: 'Username or email' }), 'joel.ramos');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(
      await screen.findByText(/Resetting a password by email isn’t available yet\. Ask your Admin\/Head/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled();
  });
});

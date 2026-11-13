import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { db } from '../../mocks/db';
import { renderApp, signInAs } from '../../test/renderApp';
import { markAlertSetupDone } from './alertPrefs';

async function logIn(user: ReturnType<typeof renderApp>['user'], username = 'teresa.reyes') {
  await user.type(await screen.findByRole('textbox', { name: /username or email/i }), username);
  await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'elderguard123');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

/** The seed data has a new alert, so its popup covers the page first. */
async function closeAlertPopup(user: ReturnType<typeof renderApp>['user']) {
  const popup = await screen.findByRole('alertdialog');
  await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
}

/** A stand-in for the browser's Notification API on a secure page. */
function fakeNotifications(initial: NotificationPermission, answer: NotificationPermission = 'granted') {
  type Shown = { title: string; options: NotificationOptions; click: () => void; closed: boolean };
  const shown: Shown[] = [];
  class FakeNotification {
    static permission: NotificationPermission = initial;
    static requestPermission = vi.fn(async () => {
      FakeNotification.permission = answer;
      return answer;
    });
    private entry: Shown;
    constructor(title: string, options: NotificationOptions) {
      this.entry = { title, options, click: () => undefined, closed: false };
      shown.push(this.entry);
    }
    addEventListener(_type: 'click', fn: () => void) {
      this.entry.click = fn;
    }
    close() {
      this.entry.closed = true;
    }
  }
  vi.stubGlobal('Notification', FakeNotification);
  vi.stubGlobal('isSecureContext', true);
  return { shown, FakeNotification };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Enable alerts and sound check (AUTH-07)', () => {
  it('shows after logging in, then goes to the page the user asked for', async () => {
    const { user, router } = renderApp('/incidents');
    await logIn(user);
    expect(await screen.findByRole('heading', { name: 'Before you start monitoring' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/setup-alerts');
    await user.click(screen.getByRole('button', { name: 'Start monitoring' }));
    await closeAlertPopup(user);
    expect(await screen.findByRole('heading', { level: 1, name: 'Incidents' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/incidents');
  });

  it('is skipped once this user has done it on this computer', async () => {
    markAlertSetupDone('u-teresa');
    const { user, router } = renderApp('/incidents');
    await logIn(user);
    expect(await screen.findByRole('heading', { level: 1, name: 'Incidents' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/incidents');
  });

  it('still shows for another user on the same computer', async () => {
    markAlertSetupDone('u-teresa');
    const { user } = renderApp('/');
    await logIn(user, 'joel.ramos');
    expect(await screen.findByRole('heading', { name: 'Before you start monitoring' })).toBeInTheDocument();
  });

  it('asks the browser for notifications from the button', async () => {
    const { FakeNotification } = fakeNotifications('default');
    signInAs('u-teresa');
    const { user } = renderApp('/setup-alerts');
    const step = await screen.findByRole('region', { name: '1. Allow browser notifications' });
    expect(within(step).getByText('Not allowed yet')).toBeInTheDocument();
    await user.click(within(step).getByRole('button', { name: 'Allow notifications' }));
    expect(FakeNotification.requestPermission).toHaveBeenCalledOnce();
    expect(await within(step).findByText('Allowed')).toBeInTheDocument();
    expect(within(step).queryByRole('button', { name: 'Allow notifications' })).not.toBeInTheDocument();
  });

  it('explains how to unblock notifications, since the page cannot ask again', async () => {
    fakeNotifications('denied');
    signInAs('u-teresa');
    renderApp('/setup-alerts');
    const step = await screen.findByRole('region', { name: '1. Allow browser notifications' });
    expect(within(step).getByText('Blocked')).toBeInTheDocument();
    expect(
      within(step).getByText(/will not see alerts when this tab is in the background/),
    ).toBeInTheDocument();
    expect(within(step).queryByRole('button')).not.toBeInTheDocument();
  });

  it('says when notifications cannot work on this connection (not https)', async () => {
    fakeNotifications('default');
    vi.stubGlobal('isSecureContext', false);
    signInAs('u-teresa');
    renderApp('/setup-alerts');
    const step = await screen.findByRole('region', { name: '1. Allow browser notifications' });
    expect(within(step).getByText('Not available')).toBeInTheDocument();
    expect(within(step).getByText(/need a secure https/)).toBeInTheDocument();
  });

  it('tells the user when the browser cannot play sound', async () => {
    vi.stubGlobal('AudioContext', undefined);
    signInAs('u-teresa');
    const { user } = renderApp('/setup-alerts');
    await user.click(await screen.findByRole('button', { name: 'Play test alarm' }));
    expect(screen.getByText(/cannot play sound/)).toBeInTheDocument();
  });
});

describe('My alert preferences (PRF-03)', () => {
  it('is in the account menu and keeps the alarm volume on this computer', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/');
    await closeAlertPopup(user);
    await user.click(await screen.findByRole('button', { name: /Joel Ramos/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Alert preferences' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'My alert preferences' }),
    ).toBeInTheDocument();

    const slider = screen.getByRole('slider', { name: 'Volume on this computer' });
    expect(slider).toHaveValue('80');
    slider.focus();
    await user.keyboard('{ArrowLeft}');
    expect(slider).toHaveValue('70');
    expect(localStorage.getItem('elderguard.alarmVolume')).toBe('70');
  });

  it('plays the test alarm at the chosen volume', async () => {
    const peaks: number[] = [];
    class FakeAudioContext {
      currentTime = 0;
      state = 'running';
      destination = {};
      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect: (n: unknown) => n, start() {}, stop() {} };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime: (v: number) => peaks.push(v),
          },
          connect: (n: unknown) => n,
        };
      }
      resume = async () => undefined;
      close = async () => undefined;
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    localStorage.setItem('elderguard.alarmVolume', '40');
    signInAs('u-joel');
    const { user } = renderApp('/profile/alerts');
    await closeAlertPopup(user);
    peaks.length = 0; // the popup's own alarm played until it was closed
    await user.click(await screen.findByRole('button', { name: 'Play test alarm' }));
    // Three beeps of two tones, each rising to the peak and back down.
    expect(peaks).toHaveLength(12);
    expect(Math.max(...peaks)).toBeCloseTo(0.125);
    expect(screen.getByText(/Didn't hear it/)).toHaveAttribute('role', 'status');
  });
});

describe('Desktop notifications for new alerts', () => {
  it('shows one when a new alert arrives while the tab is hidden, and opens it on click', async () => {
    const { shown } = fakeNotifications('granted');
    signInAs('u-teresa');
    const { router } = renderApp('/');
    await screen.findByRole('alertdialog');
    // Alerts that were there when the page opened do not notify.
    expect(shown).toHaveLength(0);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const code = db.simulateFall(db.findUserById('u-teresa')!).code;
    await waitFor(() => expect(shown).toHaveLength(1), { timeout: 15_000 });
    expect(shown[0]!.title).toBe('Possible fall detected');
    expect(shown[0]!.options.tag).toBe(code);

    const focus = vi.spyOn(window, 'focus').mockImplementation(() => undefined);
    shown[0]!.click();
    expect(focus).toHaveBeenCalled();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/alerts/${code}`));
  }, 20_000);

  it('does not notify while the tab is in front (the popup shows instead)', async () => {
    const { shown } = fakeNotifications('granted');
    signInAs('u-teresa');
    renderApp('/');
    const popup = await screen.findByRole('alertdialog');
    db.simulateFall(db.findUserById('u-teresa')!);
    await waitFor(() => expect(within(popup).getByText(/Alert 1 of 2/)).toBeInTheDocument(), {
      timeout: 15_000,
    });
    expect(shown).toHaveLength(0);
  }, 20_000);
});

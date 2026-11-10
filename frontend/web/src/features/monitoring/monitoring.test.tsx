import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { renderApp, signInAs } from '../../test/renderApp';
import { snapshotFileName } from './snapshot';

async function closeAlertPopup(user: ReturnType<typeof renderApp>['user']) {
  const popup = await screen.findByRole('alertdialog');
  await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
}

const tiles = () => within(screen.getByRole('list', { name: 'Cameras' })).getAllByRole('link');

describe('Live Monitoring grid (MON-01)', () => {
  it('shows every camera to the Admin/Head, 9 per page by default', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);

    expect(await screen.findByText('11 cameras · 9 online')).toBeInTheDocument();
    expect(tiles()).toHaveLength(9);
    expect(screen.getByText('Showing 9 of 11 cameras')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(tiles()).toHaveLength(2);
    expect(screen.getByRole('link', { name: /CAM-11 · Lobby/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '16 per page' }));
    expect(tiles()).toHaveLength(11);
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });

  it('marks the alerting, offline and paused cameras', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);
    await user.click(await screen.findByRole('button', { name: '16 per page' }));

    const cam1 = screen.getByRole('link', { name: 'CAM-01 · Room 101, live, alert active' });
    expect(within(cam1).getByText('Possible fall detected')).toBeInTheDocument();

    const cam7 = screen.getByRole('link', { name: 'CAM-07 · Hallway B, offline' });
    expect(within(cam7).getByText('OFFLINE')).toBeInTheDocument();
    expect(within(cam7).getByText(/^Last seen /)).toBeInTheDocument();

    const cam9 = screen.getByRole('link', { name: 'CAM-09 · Garden Walkway, live' });
    expect(within(cam9).getByText('Detection paused')).toBeInTheDocument();

    const cam2 = screen.getByRole('link', { name: 'CAM-02 · Room 102, live' });
    expect(within(cam2).getByText('Detection on')).toBeInTheDocument();
  });

  it('filters by area and search', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);
    await screen.findByText('Showing 9 of 11 cameras');

    await user.click(screen.getByRole('combobox', { name: 'Area' }));
    await user.click(screen.getByRole('option', { name: 'West Wing' }));
    expect(tiles().map((t) => t.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^CAM-04/),
      expect.stringMatching(/^CAM-05/),
      expect.stringMatching(/^CAM-06/),
    ]);

    await user.type(screen.getByRole('textbox', { name: 'Search cameras' }), '105');
    expect(tiles()).toHaveLength(1);
    expect(screen.getByText('Showing 1 of 1 camera')).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'Search cameras' }));
    await user.type(screen.getByRole('textbox', { name: 'Search cameras' }), 'lobby');
    expect(screen.getByText('No cameras match your search.')).toBeInTheDocument();
  });

  it('says "1 camera", not "1 cameras"', async () => {
    server.use(
      http.get('/api/cameras', () =>
        HttpResponse.json(db.listCameras(db.findUserById('u-teresa')!).filter((c) => c.code === 'CAM-01')),
      ),
    );
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);
    expect(await screen.findByText('1 camera · 1 online')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 1 camera')).toBeInTheDocument();
  });

  it('shows a caregiver only the cameras in their areas', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);

    expect(await screen.findByText('3 cameras · 3 online')).toBeInTheDocument();
    expect(tiles().map((t) => t.getAttribute('aria-label'))).toEqual([
      'CAM-01 · Room 101, live, alert active',
      'CAM-02 · Room 102, live',
      'CAM-03 · Room 103, live',
    ]);
  });

  it('remembers the chosen layout', async () => {
    signInAs('u-teresa');
    const first = renderApp('/monitoring');
    await closeAlertPopup(first.user);
    await first.user.click(await screen.findByRole('button', { name: '4 per page' }));
    expect(tiles()).toHaveLength(4);
    first.unmount();

    const second = renderApp('/monitoring');
    await closeAlertPopup(second.user);
    await screen.findByText('Showing 4 of 11 cameras');
    expect(screen.getByRole('button', { name: '4 per page' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Single camera view (MON-02)', () => {
  it('shows the camera, its residents and recent detections', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);
    await user.click(await screen.findByRole('link', { name: /^CAM-01 · Room 101/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'CAM-01 · Room 101' })).toBeInTheDocument();
    expect(screen.getByText('Live feed · CAM-01')).toBeInTheDocument();
    expect(screen.getByText('Room 101 · East Wing')).toBeInTheDocument();
    expect(screen.getByText('1080p · 15 FPS')).toBeInTheDocument();

    const residents = await screen.findByRole('list', { name: 'Residents in this room' });
    expect(within(residents).getByText('Remedios Santos')).toBeInTheDocument();
    expect(within(residents).getByText('Lourdes Aquino')).toBeInTheDocument();
    expect(within(residents).queryByText('Ernesto Villanueva')).not.toBeInTheDocument();

    const detections = await screen.findByRole('list', { name: 'Recent detections' });
    expect(within(detections).getByRole('link', { name: 'INC-2026-0142' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Open alert' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Possible fall detected/ }),
    ).toBeInTheDocument();
  });

  it('explains an offline camera', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring/CAM-07');
    // The fall alarm popup hides the page from screen readers (and from getByRole) until it is closed.
    // Without this the test only passed when the camera list happened to load before the alarm.
    await closeAlertPopup(user);
    expect(await screen.findByRole('heading', { level: 1, name: 'CAM-07 · Hallway B' })).toBeInTheDocument();
    expect(screen.getByText(/Camera is offline · last seen/)).toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('shows a 404 for a camera outside the caregiver areas', async () => {
    signInAs('u-joel');
    renderApp('/monitoring/CAM-07');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('Live video (MON-01, MON-02)', () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const LIVE_URL = '/live/cam-01.mjpg';

  /** CAM-01 gets a live stream, and the server answers picture requests with `picture`. */
  function liveCam01(
    picture: () => Response = () => new HttpResponse(JPEG, { headers: { 'Content-Type': 'image/jpeg' } }),
  ) {
    server.use(
      http.get('/api/cameras', () =>
        HttpResponse.json(
          db
            .listCameras(db.findUserById('u-teresa')!)
            .map((c) => (c.code === 'CAM-01' ? { ...c, liveUrl: LIVE_URL, liveFormat: 'mjpeg' } : c)),
        ),
      ),
      http.get('/api/cameras/:id/snapshot', picture),
    );
  }

  async function openCam01() {
    signInAs('u-teresa');
    const app = renderApp('/monitoring/CAM-01');
    await closeAlertPopup(app.user);
    await screen.findByRole('heading', { level: 1, name: 'CAM-01 · Room 101' });
    return app;
  }

  it('shows the newest picture on the tile of a camera with live video', async () => {
    liveCam01();
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring');
    await closeAlertPopup(user);
    expect(await screen.findByText('11 cameras · 9 online')).toBeInTheDocument();
    const cam1 = await screen.findByRole('link', { name: /^CAM-01 · Room 101/ });
    const picture = await within(cam1).findByTestId('camera-picture');
    expect(picture).toHaveAttribute('src', 'data:image/jpeg;base64,/9j/2Q==');
    // Cameras without live video keep the placeholder and are never asked for a picture.
    const cam2 = screen.getByRole('link', { name: /^CAM-02 · Room 102/ });
    expect(within(cam2).queryByTestId('camera-picture')).not.toBeInTheDocument();
  });

  it('plays the stream and saves a snapshot', async () => {
    liveCam01();
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:snapshot');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    try {
      const { user } = await openCam01();
      expect(screen.getByRole('img', { name: 'Live feed from CAM-01' })).toHaveAttribute('src', LIVE_URL);
      expect(screen.getByText('LIVE')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Snapshot' }));
      await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
      const link = click.mock.contexts[0] as HTMLAnchorElement;
      expect(link.download).toMatch(/^CAM-01 \d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}\.jpg$/);
      expect(link.href).toBe('blob:snapshot');
      // The picture the server sent (a Blob from Node's fetch, so not jsdom's Blob class).
      expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ size: 4, type: 'image/jpeg' }));
    } finally {
      click.mockRestore();
    }
  });

  it('says why a snapshot failed', async () => {
    liveCam01(() => HttpResponse.json({ detail: 'This camera is not running.' }, { status: 404 }));
    const { user } = await openCam01();
    await user.click(screen.getByRole('button', { name: 'Snapshot' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't save a snapshot. This camera is not running.",
    );
    // A server without pictures is not a broken stream: the video keeps playing.
    expect(screen.getByRole('img', { name: 'Live feed from CAM-01' })).toBeInTheDocument();
  });

  it('turns Snapshot off for a camera without live video', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring/CAM-01');
    await closeAlertPopup(user);
    expect(await screen.findByRole('button', { name: 'Snapshot' })).toBeDisabled();
    expect(screen.getByText('Live video is not connected for this camera yet.')).toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('notices a broken stream and reconnects', async () => {
    liveCam01();
    const { user } = await openCam01();
    fireEvent.error(screen.getByRole('img', { name: 'Live feed from CAM-01' }));
    expect(screen.getByText('The live video stopped. Trying again in a few seconds.')).toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reconnect now' }));
    expect(screen.getByRole('img', { name: 'Live feed from CAM-01' })).toBeInTheDocument();
  });

  it('counts the stream as stopped when the server stops answering', async () => {
    // The browser shows the last frame forever when an MJPEG stream breaks, so the page checks the server.
    liveCam01(() => HttpResponse.json({ detail: 'Bad gateway' }, { status: 502 }));
    await openCam01();
    expect(
      await screen.findByText('The live video stopped. Trying again in a few seconds.'),
    ).toBeInTheDocument();
  });

  it('stops the stream while the tab is hidden', async () => {
    liveCam01();
    await openCam01();
    const setVisibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    };
    try {
      setVisibility('hidden');
      expect(screen.getByText('Live video is paused while this tab is hidden.')).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Live feed from CAM-01' })).not.toBeInTheDocument();
      setVisibility('visible');
      expect(screen.getByRole('img', { name: 'Live feed from CAM-01' })).toBeInTheDocument();
    } finally {
      setVisibility('visible');
    }
  });
});

describe('snapshotFileName', () => {
  it('names the file after the camera and the local time, safe for any file system', () => {
    const at = new Date(2026, 10, 10, 9, 5, 7);
    expect(snapshotFileName('CAM-21', at)).toBe('CAM-21 2026-11-10 09-05-07.jpg');
    expect(snapshotFileName('Hall/East:1', at)).toBe('Hall-East-1 2026-11-10 09-05-07.jpg');
    expect(snapshotFileName('///', at)).toBe('--- 2026-11-10 09-05-07.jpg');
  });
});

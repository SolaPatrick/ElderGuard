import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { closeAlertPopup, renderApp, signInAs } from '../../test/renderApp';
import { boxBetween, isBigEnough, toFraction } from './zoneGeometry';

const LIVE_URL = '/live/cam-01.mjpg';

/** CAM-01 sends a live MJPEG stream, so there is a picture to draw on. */
function liveCam01() {
  server.use(
    http.get('/api/cameras', ({ request }) => {
      const token = request.headers.get('Authorization') ?? '';
      const user = db.findUserById(token.includes('u-joel') ? 'u-joel' : 'u-teresa')!;
      return HttpResponse.json(
        db
          .listCameras(user)
          .map((c) => (c.code === 'CAM-01' ? { ...c, liveUrl: LIVE_URL, liveFormat: 'mjpeg' } : c)),
      );
    }),
  );
}

async function openZones(path = '/cameras/cam-01?tab=zones') {
  signInAs('u-teresa');
  const app = renderApp(path);
  await closeAlertPopup(app.user);
  return app;
}

/** The drawing area is 400 × 200 pixels at the top-left of the window. */
async function drawingArea() {
  const area = await screen.findByTestId('zone-drawing-area');
  area.getBoundingClientRect = () => new DOMRect(0, 0, 400, 200);
  return area;
}

function drag(area: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(area, { clientX: from[0], clientY: from[1], button: 0, pointerId: 1 });
  fireEvent.pointerMove(area, {
    clientX: (from[0] + to[0]) / 2,
    clientY: (from[1] + to[1]) / 2,
    pointerId: 1,
  });
  fireEvent.pointerUp(area, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

afterEach(() => vi.restoreAllMocks());

describe('Rest zones (CAM-08)', () => {
  it('draws a zone, names it and saves it as shares of the picture', async () => {
    liveCam01();
    const { user } = await openZones();
    expect(screen.getByRole('tab', { name: 'Rest zones', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Picture from CAM-01' })).toHaveAttribute('src', LIVE_URL);
    expect(screen.getByText('No rest zones yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    // Dragged up and to the left: the zone still starts at its top-left corner.
    drag(await drawingArea(), [240, 120], [40, 20]);
    const dialog = await screen.findByRole('dialog', { name: 'Name this zone' });
    await user.click(within(dialog).getByRole('button', { name: 'Add zone' }));
    expect(within(dialog).getByText('Name the zone, e.g. Bed')).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: 'Zone name' }), 'Bed');
    await user.click(within(dialog).getByRole('button', { name: 'Add zone' }));

    const list = screen.getByRole('list', { name: 'Rest zones' });
    expect(within(list).getByText('Bed')).toBeInTheDocument();
    expect(screen.getByText('Changes not saved yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Rest zones saved for CAM-01')).toBeInTheDocument();
    expect(db.restZones('cam-01')).toEqual([
      { id: expect.any(String), name: 'Bed', x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
    ]);
    expect(screen.queryByText('Changes not saved yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('ignores a click, refuses a name that is used, and deletes a zone', async () => {
    liveCam01();
    db.saveRestZones('cam-01', [{ name: 'Bed', x: 0.1, y: 0.1, width: 0.5, height: 0.5 }]);
    const { user } = await openZones();
    const area = await drawingArea();
    expect(within(screen.getByRole('list', { name: 'Rest zones' })).getByText('Bed')).toBeInTheDocument();

    drag(area, [100, 100], [102, 101]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    drag(area, [300, 20], [380, 180]);
    const dialog = await screen.findByRole('dialog', { name: 'Name this zone' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Zone name' }), 'bed');
    await user.click(within(dialog).getByRole('button', { name: 'Add zone' }));
    expect(within(dialog).getByText('There is already a zone called bed')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Delete Bed' }));
    expect(screen.getByText('No rest zones yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Rest zones saved for CAM-01');
    expect(db.restZones('cam-01')).toEqual([]);
  });

  it("can't draw without a picture, but still lists the saved zones", async () => {
    db.saveRestZones('cam-01', [{ name: 'Sofa', x: 0, y: 0, width: 0.3, height: 0.3 }]);
    await openZones();
    expect(
      await screen.findByText(/CAM-01 isn’t sending a picture right now, so zones can’t be drawn/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('zone-drawing-area')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Sofa' })).toBeEnabled();
  });

  it('says so when the server keeps no rest zones', async () => {
    server.use(
      http.get('/api/cameras/:id/zones', () =>
        HttpResponse.json({ error: 'not_implemented', message: 'Not yet' }, { status: 501 }),
      ),
    );
    await openZones();
    expect(
      await screen.findByText(/This server can’t keep rest zones yet, so they can’t be drawn from the app\./),
    ).toBeInTheDocument();
  });

  it('has no Rest zones tab for a bathroom camera', async () => {
    const cam = db.findCamera('cam-01')!;
    const setup = db.cameraSettings(cam);
    db.saveCamera({ ...setup, place: 'bathroom' }, cam.id);
    await openZones();
    expect(await screen.findByRole('heading', { level: 1, name: /^CAM-01/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Rest zones' })).not.toBeInTheDocument();
    expect(screen.getByText('A bathroom')).toBeInTheDocument();
  });

  it('the server refuses zones for a bathroom camera and from employees', async () => {
    const zones = { zones: [{ name: 'Bed', x: 0, y: 0, width: 0.5, height: 0.5 }] };
    const put = (user: string, id: string) =>
      fetch(`/api/cameras/${id}/zones`, {
        method: 'PUT',
        headers: { Authorization: `Bearer mock-token:${user}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(zones),
      });
    expect((await put('u-joel', 'cam-01')).status).toBe(403);
    const cam = db.findCamera('cam-01')!;
    db.saveCamera({ ...db.cameraSettings(cam), place: 'bathroom' }, cam.id);
    expect((await put('u-teresa', 'cam-01')).status).toBe(409);
  });
});

describe('Rest zones on Live Monitoring', () => {
  it('draws faint outlines over the live picture, scaled to the picture', async () => {
    liveCam01();
    db.saveRestZones('cam-01', [{ name: 'Bed', x: 0.1, y: 0.2, width: 0.5, height: 0.25 }]);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(640);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(480);
    signInAs('u-joel');
    const { user } = renderApp('/monitoring/CAM-01');
    await closeAlertPopup(user);
    const outlines = await screen.findByTestId('rest-zone-outlines');
    expect(outlines).toHaveAttribute('viewBox', '0 0 640 480');
    expect(outlines).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    const rect = outlines.querySelector('rect')!;
    expect([rect.getAttribute('x'), rect.getAttribute('y')]).toEqual(['64', '96']);
    expect([rect.getAttribute('width'), rect.getAttribute('height')]).toEqual(['320', '120']);
  });

  it('draws nothing when the camera has no zones', async () => {
    liveCam01();
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(640);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(480);
    signInAs('u-teresa');
    const { user } = renderApp('/monitoring/CAM-01');
    await closeAlertPopup(user);
    await screen.findByRole('img', { name: 'Live feed from CAM-01' });
    await waitFor(() => expect(screen.queryByTestId('rest-zone-outlines')).not.toBeInTheDocument());
  });
});

describe('zoneGeometry', () => {
  const rect = new DOMRect(100, 50, 400, 200);

  it('turns pointer positions into shares of the picture, edges included', () => {
    expect(toFraction(300, 150, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(toFraction(0, 999, rect)).toEqual({ x: 0, y: 1 });
  });

  it('builds the box whichever way it was dragged, and spots slips of the mouse', () => {
    expect(boxBetween({ x: 0.6, y: 0.5 }, { x: 0.1, y: 0.25 })).toEqual({
      x: 0.1,
      y: 0.25,
      width: 0.5,
      height: 0.25,
    });
    expect(isBigEnough({ x: 0, y: 0, width: 0.01, height: 0.5 })).toBe(false);
    expect(isBigEnough({ x: 0, y: 0, width: 0.02, height: 0.02 })).toBe(true);
  });
});

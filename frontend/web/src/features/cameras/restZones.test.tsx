import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { closeAlertPopup, renderApp, signInAs } from '../../test/renderApp';
import { boxBetween, dotsFromBox, isBigEnough, nudge, toFraction } from './zoneGeometry';

/** A rectangle as the 4 dots a zone saved before shapes existed has. */
const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

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
  it('draws a zone, which becomes 6 dots, names it and saves it as shares of the picture', async () => {
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
    expect(screen.getAllByRole('button', { name: /^Dot \d of Bed$/ })).toHaveLength(6);
    expect(screen.getByText('Changes not saved yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Rest zones saved for CAM-01')).toBeInTheDocument();
    expect(db.restZones('cam-01')).toEqual([
      {
        id: expect.any(String),
        name: 'Bed',
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.35, y: 0.1 },
          { x: 0.6, y: 0.1 },
          { x: 0.6, y: 0.6 },
          { x: 0.35, y: 0.6 },
          { x: 0.1, y: 0.6 },
        ],
      },
    ]);
    expect(screen.queryByText('Changes not saved yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('ignores a click, refuses a name that is used, and deletes a zone', async () => {
    liveCam01();
    db.saveRestZones('cam-01', [{ name: 'Bed', points: rect(0.1, 0.1, 0.5, 0.5) }]);
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

  it('moves a dot by dragging and with the arrow keys, then saves the new shape', async () => {
    liveCam01();
    db.saveRestZones('cam-01', [
      { name: 'Bed', points: dotsFromBox({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }) },
    ]);
    const { user } = await openZones();
    await drawingArea();
    // the top-middle dot of a bed seen at an angle: pull it up and to the right
    const dot = screen.getByRole('button', { name: 'Dot 2 of Bed' });
    fireEvent.pointerDown(dot, { clientX: 140, clientY: 20, button: 0, pointerId: 2 });
    fireEvent.pointerMove(dot, { clientX: 160, clientY: 10, pointerId: 2 });
    fireEvent.pointerUp(dot, { clientX: 160, clientY: 10, pointerId: 2 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // moving a dot doesn't draw a new zone
    expect(screen.getByText('Changes not saved yet.')).toBeInTheDocument();
    // fine-tune the bottom-left dot with the keyboard
    screen.getByRole('button', { name: 'Dot 6 of Bed' }).focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Rest zones saved for CAM-01');
    const points = db.restZones('cam-01')[0]!.points;
    expect(points[1]).toEqual({ x: 0.4, y: 0.05 });
    expect(points[5]).toEqual({ x: 0.11, y: 0.6 });
  });

  it("won't save a shape whose lines cross", async () => {
    liveCam01();
    db.saveRestZones('cam-01', [{ name: 'Bed', points: rect(0.1, 0.1, 0.5, 0.5) }]);
    await openZones();
    await drawingArea();
    // drag the bottom-right dot above the top edge: the shape becomes a bow-tie
    const dot = screen.getByRole('button', { name: 'Dot 3 of Bed' });
    fireEvent.pointerDown(dot, { clientX: 240, clientY: 120, button: 0, pointerId: 3 });
    fireEvent.pointerMove(dot, { clientX: 240, clientY: 0, pointerId: 3 });
    fireEvent.pointerUp(dot, { clientX: 240, clientY: 0, pointerId: 3 });
    expect(screen.getByRole('alert')).toHaveTextContent("Bed: The zone's lines cross.");
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it("can't draw without a picture, but still lists the saved zones", async () => {
    db.saveRestZones('cam-01', [{ name: 'Sofa', points: rect(0, 0, 0.3, 0.3) }]);
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
    const zones = { zones: [{ name: 'Bed', points: rect(0, 0, 0.5, 0.5) }] };
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
    db.saveRestZones('cam-01', [{ name: 'Bed', points: rect(0.1, 0.2, 0.5, 0.25) }]);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(640);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(480);
    signInAs('u-joel');
    const { user } = renderApp('/monitoring/CAM-01');
    await closeAlertPopup(user);
    const outlines = await screen.findByTestId('rest-zone-outlines');
    expect(outlines).toHaveAttribute('viewBox', '0 0 640 480');
    expect(outlines).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    expect(outlines.querySelector('polygon')!.getAttribute('points')).toBe('64,96 384,96 384,216 64,216');
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

  it('turns a drawn box into 6 dots, with the extra two on the long sides', () => {
    expect(dotsFromBox({ x: 0.1, y: 0.2, width: 0.4, height: 0.2 })).toEqual([
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.2 },
      { x: 0.5, y: 0.2 },
      { x: 0.5, y: 0.4 },
      { x: 0.3, y: 0.4 },
      { x: 0.1, y: 0.4 },
    ]);
    expect(dotsFromBox({ x: 0, y: 0, width: 0.2, height: 0.6 })).toEqual([
      { x: 0, y: 0 },
      { x: 0.2, y: 0 },
      { x: 0.2, y: 0.3 },
      { x: 0.2, y: 0.6 },
      { x: 0, y: 0.6 },
      { x: 0, y: 0.3 },
    ]);
    expect(nudge({ x: 0.999, y: 0.5 }, 0.005, 0)).toEqual({ x: 1, y: 0.5 });
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

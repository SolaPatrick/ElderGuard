import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, signInAs } from '../../test/renderApp';

async function asAdmin(path: string) {
  signInAs('u-teresa');
  const app = renderApp(path);
  const popup = await screen.findByRole('alertdialog');
  await app.user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
  return app;
}

const cameraNames = () =>
  within(screen.getByRole('table', { name: 'Cameras' }))
    .getAllByRole('link')
    .map((a) => a.textContent);

type Ui = Awaited<ReturnType<typeof asAdmin>>['user'];

async function pick(user: Ui, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(screen.getByRole('option', { name: option }));
}

describe('Camera list (CAM-01)', () => {
  it('shows counts by status and every camera', async () => {
    await asAdmin('/cameras');
    expect(await screen.findByText('11 cameras')).toBeInTheDocument();
    const counts = screen.getByLabelText('Camera status counts');
    expect(within(counts).getByText('Online').nextSibling).toHaveTextContent('9');
    expect(within(counts).getByText('Offline').nextSibling).toHaveTextContent('1');
    expect(within(counts).getByText('Detection paused').nextSibling).toHaveTextContent('1');
    const cam7 = screen.getByRole('row', { name: /^CAM-07/ });
    expect(within(cam7).getByText('Offline')).toBeInTheDocument();
    expect(within(cam7).getByText('Hallway B')).toBeInTheDocument();
    const cam9 = screen.getByRole('row', { name: /^CAM-09/ });
    expect(within(cam9).getByText('Off')).toBeInTheDocument();
  });

  it('filters by status and search', async () => {
    const { user } = await asAdmin('/cameras');
    await screen.findByText('11 cameras');
    await pick(user, 'Status', 'Offline');
    expect(cameraNames()).toEqual(['CAM-07']);
    await pick(user, 'Status', 'All');
    await user.type(screen.getByRole('textbox', { name: 'Search cameras' }), 'room 10');
    expect(cameraNames()).toHaveLength(6);
  });

  it('is only for the Admin/Head', async () => {
    signInAs('u-joel');
    renderApp('/cameras');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });
});

describe('Register camera (CAM-02)', () => {
  it('tests the connection and registers the camera in a room', async () => {
    const { user, router } = await asAdmin('/cameras/new');
    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'CAM-12');
    const source = screen.getByRole('textbox', { name: 'Stream link or device number' });

    // The link of an offline camera can't be reached in the fake API.
    await user.type(source, 'rtsp://192.168.10.27:554/stream1');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText(/Could not reach this stream/)).toBeInTheDocument();

    await user.clear(source);
    await user.type(source, 'rtsp://192.168.10.32:554/stream1');
    expect(screen.getByText('The link changed since the last test.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Test again' }));
    expect(await screen.findByText('Connected · 1920 × 1080')).toBeInTheDocument();

    await pick(user, 'Room / area', 'Lobby');
    expect(screen.getByText(/CAM-11 already monitors this room/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Register camera' }).at(-1)!);

    expect(await screen.findByRole('heading', { level: 1, name: 'CAM-12 · Lobby' })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/cameras\/cam-\d+$/);
    expect(screen.getByText('rtsp://192.168.10.32:554/stream1')).toBeInTheDocument();
  });

  it('checks the form, including a name that is already used', async () => {
    const { user } = await asAdmin('/cameras/new');
    const submit = () => user.click(screen.getAllByRole('button', { name: 'Register camera' }).at(-1)!);
    await screen.findByRole('textbox', { name: 'Name' });
    await submit();
    expect(await screen.findByText('Enter a name, e.g. CAM-12')).toBeInTheDocument();
    expect(screen.getByText('Enter the stream link or device number')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'cam-01');
    await user.type(screen.getByRole('textbox', { name: 'Stream link or device number' }), '0');
    await submit();
    expect(await screen.findByText('There is already a camera called cam-01.')).toBeInTheDocument();
  });

  it('always blurs the whole picture for a bathroom camera', async () => {
    const { user } = await asAdmin('/cameras/new');
    await screen.findByRole('textbox', { name: 'Name' });
    await pick(user, 'Camera covers', 'A bathroom');
    expect(screen.getByRole('combobox', { name: 'Privacy blur' })).toHaveTextContent(
      'Blur the whole picture',
    );
    expect(screen.getByText('Bathroom cameras always blur the whole picture.')).toBeInTheDocument();
  });
});

describe('Camera detail, edit and remove (CAM-03 to CAM-07)', () => {
  it('shows the configuration', async () => {
    await asAdmin('/cameras/cam-07');
    expect(await screen.findByRole('heading', { level: 1, name: 'CAM-07 · Hallway B' })).toBeInTheDocument();
    expect(screen.getByText('rtsp://192.168.10.27:554/stream1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hallway B' })).toHaveAttribute('href', '/rooms/r-hall-b');
  });

  it('moves a camera to another room and turns detection off', async () => {
    const { user } = await asAdmin('/cameras/cam-10/edit');
    await screen.findByRole('textbox', { name: 'Name' });
    await pick(user, 'Room / area', 'Lobby');
    await user.click(screen.getByRole('switch', { name: 'Fall detection' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'CAM-10 · Lobby' })).toBeInTheDocument();
    expect(screen.getByText('Fall detection').nextSibling).toHaveTextContent('Off');
  });

  it("explains when a camera with incident history can't be removed", async () => {
    const { user } = await asAdmin('/cameras/cam-01');
    await user.click(await screen.findByRole('button', { name: 'Remove camera' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove CAM-01?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove camera' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Turn its detection off instead');
  });

  it('removes a camera without history', async () => {
    const { user, router } = await asAdmin('/cameras/cam-11');
    await user.click(await screen.findByRole('button', { name: 'Remove camera' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove CAM-11?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove camera' }));
    expect(await screen.findByText('10 cameras')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/cameras');
  });

  it('shows "not found" for an unknown camera', async () => {
    await asAdmin('/cameras/cam-99');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

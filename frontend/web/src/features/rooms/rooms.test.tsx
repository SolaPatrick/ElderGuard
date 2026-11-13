import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/node';
import { renderApp, signInAs, closeAlertPopup as closeAlertPopupShared } from '../../test/renderApp';

async function asAdmin(path: string) {
  signInAs('u-teresa');
  const app = renderApp(path);
  const popup = await screen.findByRole('alertdialog');
  await app.user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
  return app;
}

const roomNames = () =>
  within(screen.getByRole('table', { name: 'Rooms and areas' }))
    .getAllByRole('link')
    .map((a) => a.textContent);

describe('Rooms & areas list (ROOM-01)', () => {
  it('lists rooms with resident and camera counts and status', async () => {
    await asAdmin('/rooms');
    expect(await screen.findByText('Showing 12 of 12 rooms and areas')).toBeInTheDocument();
    const room101 = screen.getByRole('row', { name: /^Room 101/ });
    expect(within(room101).getByText('East Wing')).toBeInTheDocument();
    expect(within(room101).getByText('Active')).toBeInTheDocument();
    const hallB = screen.getByRole('row', { name: /^Hallway B/ });
    expect(within(hallB).getByText('Camera offline')).toBeInTheDocument();
    const activity = screen.getByRole('row', { name: /^Activity Area/ });
    expect(within(activity).getByText('No camera')).toBeInTheDocument();
    const garden = screen.getByRole('row', { name: /^Garden Walkway/ });
    expect(within(garden).getByText('Detection paused')).toBeInTheDocument();
  });

  it('filters by search and wing', async () => {
    const { user } = await asAdmin('/rooms');
    await screen.findByText('Showing 12 of 12 rooms and areas');
    await user.click(screen.getByRole('combobox', { name: 'Wing / floor' }));
    await user.click(screen.getByRole('option', { name: 'West Wing' }));
    expect(roomNames()).toEqual(['Room 104', 'Room 105', 'Room 106']);
    await user.type(screen.getByRole('textbox', { name: 'Search rooms and areas' }), '105');
    expect(roomNames()).toEqual(['Room 105']);
  });

  it('adds a room and opens it', async () => {
    const { user, router } = await asAdmin('/rooms');
    await user.click(await screen.findByRole('button', { name: 'Add room' }));
    const dialog = screen.getByRole('dialog', { name: 'Add room' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Room 107');
    await user.type(within(dialog).getByRole('combobox', { name: 'Wing / floor' }), 'West Wing');
    await user.click(within(dialog).getByRole('button', { name: 'Save room' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Room 107' })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/rooms\/r-\d+$/);
    expect(screen.getByText('No residents in this room.')).toBeInTheDocument();
  });

  it('refuses a second room with the same name in the same wing', async () => {
    const { user } = await asAdmin('/rooms');
    await user.click(await screen.findByRole('button', { name: 'Add room' }));
    const dialog = screen.getByRole('dialog', { name: 'Add room' });
    await user.click(within(dialog).getByRole('button', { name: 'Save room' }));
    expect(await within(dialog).findByText('Enter a name')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'room 101');
    await user.type(within(dialog).getByRole('combobox', { name: 'Wing / floor' }), 'east wing');
    await user.click(within(dialog).getByRole('button', { name: 'Save room' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'east wing already has a room called room 101.',
    );
  });

  it('is only for the Admin/Head', async () => {
    signInAs('u-joel');
    renderApp('/rooms');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });
});

describe('Room detail, edit and delete (ROOM-02 to ROOM-04)', () => {
  it('shows residents, cameras and incidents in the room', async () => {
    await asAdmin('/rooms/r-101');
    expect(await screen.findByRole('heading', { level: 1, name: 'Room 101' })).toBeInTheDocument();
    const residents = screen.getByRole('list', { name: 'Residents in this room' });
    expect(within(residents).getByRole('link', { name: 'Remedios Santos' })).toBeInTheDocument();
    const cameras = screen.getByRole('list', { name: 'Cameras in this room' });
    expect(within(cameras).getByRole('link', { name: 'CAM-01' })).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'INC-2026-0142 · Possible fall detected' }),
    ).toBeInTheDocument();
  });

  it('renames a room, and its camera follows', async () => {
    const { user } = await asAdmin('/rooms/r-101');
    await user.click(await screen.findByRole('button', { name: 'Edit room' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit room' });
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Room 101A');
    await user.click(within(dialog).getByRole('button', { name: 'Save room' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Room 101A' })).toBeInTheDocument();
    await closeAlertPopupShared(renderApp('/monitoring/CAM-01').user);
    expect(await screen.findByRole('heading', { level: 1, name: 'CAM-01 · Room 101A' })).toBeInTheDocument();
  });

  it('explains why a room with residents or cameras cannot be deleted', async () => {
    const { user } = await asAdmin('/rooms/r-101');
    await user.click(await screen.findByRole('button', { name: 'Delete room' }));
    const dialog = screen.getByRole('dialog', { name: "Room 101 can't be deleted yet" });
    expect(within(dialog).getByText(/residents still assigned/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'CAM-01' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Delete room' })).not.toBeInTheDocument();
  });

  it('deletes an empty room', async () => {
    const { user, router } = await asAdmin('/rooms');
    await user.click(await screen.findByRole('button', { name: 'Add room' }));
    const add = screen.getByRole('dialog', { name: 'Add room' });
    await user.type(within(add).getByRole('textbox', { name: 'Name' }), 'Storage');
    await user.click(within(add).getByRole('button', { name: 'Save room' }));
    await screen.findByRole('heading', { level: 1, name: 'Storage' });

    await user.click(screen.getByRole('button', { name: 'Delete room' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Storage?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete room' }));
    await screen.findByText('Showing 12 of 12 rooms and areas');
    expect(router.state.location.pathname).toBe('/rooms');
    expect(roomNames()).not.toContain('Storage');
  });

  it('shows the server reason when it refuses, and keeps the dialog open', async () => {
    server.use(
      http.delete('/api/rooms/:id', () =>
        HttpResponse.json(
          {
            code: 'room_in_use',
            message: "This room has 2 incident(s) in its history, so it can't be deleted.",
          },
          { status: 409 },
        ),
      ),
    );
    const { user } = await asAdmin('/rooms/r-activity');
    await user.click(await screen.findByRole('button', { name: 'Delete room' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Activity Area?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete room' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('2 incident(s) in its history');
  });

  it('shows "not found" for an unknown room', async () => {
    await asAdmin('/rooms/r-nowhere');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

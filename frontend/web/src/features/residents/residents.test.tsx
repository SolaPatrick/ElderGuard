import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, signInAs } from '../../test/renderApp';

async function closeAlertPopup(user: ReturnType<typeof renderApp>['user']) {
  const popup = await screen.findByRole('alertdialog');
  await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
}

const rowNames = () =>
  within(screen.getByRole('table', { name: 'Residents' }))
    .getAllByRole('link')
    .map((a) => a.textContent);

describe('Resident list (RES-01)', () => {
  it('shows the Admin/Head every resident in a table', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/residents');
    await closeAlertPopup(user);

    expect(await screen.findByText('8 residents in the facility')).toBeInTheDocument();
    expect(rowNames()).toHaveLength(8);
    const remedios = screen.getByRole('row', { name: /Remedios Santos/ });
    expect(within(remedios).getByText('High risk')).toBeInTheDocument();
    expect(within(remedios).getByText('Joel Ramos')).toBeInTheDocument();
    expect(within(remedios).getByText('Alert active')).toBeInTheDocument();
    const benjamin = screen.getByRole('row', { name: /Benjamin Torres/ });
    expect(within(benjamin).getByText('—')).toBeInTheDocument();
  });

  it('filters by search, room and fall risk', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/residents');
    await closeAlertPopup(user);
    await screen.findByText('Showing 8 of 8 residents');

    await user.click(screen.getByRole('combobox', { name: 'Fall risk' }));
    await user.click(screen.getByRole('option', { name: 'High risk' }));
    expect(rowNames()).toEqual(['Remedios Santos', 'Corazon Mendoza', 'Felicidad Bautista']);

    await user.click(screen.getByRole('combobox', { name: 'Room / area' }));
    await user.click(screen.getByRole('option', { name: 'Room 105' }));
    expect(rowNames()).toEqual(['Felicidad Bautista']);

    await user.type(screen.getByRole('textbox', { name: 'Search residents' }), 'santos');
    expect(screen.getByText('No residents match your search.')).toBeInTheDocument();
  });

  it('searches by caregiver name too', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/residents');
    await closeAlertPopup(user);
    await user.type(await screen.findByRole('textbox', { name: 'Search residents' }), 'angelica');
    expect(rowNames()).toEqual(['Felicidad Bautista', 'Antonio Navarro']);
  });

  it('shows a caregiver only their residents, as cards', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/residents');
    await closeAlertPopup(user);

    expect(await screen.findByRole('heading', { level: 1, name: 'My Residents' })).toBeInTheDocument();
    expect(screen.getByText('4 residents assigned to you')).toBeInTheDocument();
    const cards = within(screen.getByRole('list', { name: 'Residents' })).getAllByRole('link');
    expect(cards.map((c) => within(c).getByText(/^[A-Z][a-z]+ [A-Z][a-z]+$/).textContent)).toEqual([
      'Remedios Santos',
      'Lourdes Aquino',
      'Ernesto Villanueva',
      'Corazon Mendoza',
    ]);
    expect(screen.queryByText('Rodolfo Garcia')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Table' }));
    expect(rowNames()).toHaveLength(4);
  });
});

describe('Resident profile (RES-03)', () => {
  it('shows details, incidents, camera, caregivers and emergency contact', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/residents');
    await closeAlertPopup(user);
    await user.click(await screen.findByRole('link', { name: 'Remedios Santos' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Remedios Santos' })).toBeInTheDocument();
    expect(screen.getByText('84 · Female · Room 101 · East Wing')).toBeInTheDocument();
    expect(screen.getAllByText('Walker')).not.toHaveLength(0);
    expect(screen.getByText(/Needs help standing up at night/)).toBeInTheDocument();
    expect(screen.getByText(/^12 Mar \d{4} \(84\)$/)).toBeInTheDocument();

    const recent = await screen.findByRole('list', { name: 'Recent incidents' });
    expect(
      within(recent).getByRole('link', { name: 'INC-2026-0142 · Possible fall detected' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /^CAM-01 · Room 101/ })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Assigned caregivers' })).getByText('Joel Ramos'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Call Maricel Santos' })).toHaveAttribute(
      'href',
      'tel:09185550172',
    );
  });

  it('switches between tabs', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/residents/res-corazon');
    await closeAlertPopup(user);
    await screen.findByRole('heading', { level: 1, name: 'Corazon Mendoza' });

    await user.click(screen.getByRole('tab', { name: 'Emergency Contacts' }));
    const contacts = screen.getByRole('list', { name: 'Emergency contacts' });
    expect(within(contacts).getAllByRole('listitem')).toHaveLength(2);

    await user.click(screen.getByRole('tab', { name: 'Incident History' }));
    expect(screen.getByText('No incidents recorded.')).toBeInTheDocument();
  });

  it('shows a 404 for a resident outside the caregiver areas', async () => {
    signInAs('u-joel');
    renderApp('/residents/res-rodolfo');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, signInAs } from '../../test/renderApp';
import { basicResidentFormSchema, residentFormSchema, type ResidentDetail } from '@elderguard/shared';
import { ageFrom, formValues } from './residentEditing';

async function asAdmin(path: string) {
  signInAs('u-teresa');
  const app = renderApp(path);
  const popup = await screen.findByRole('alertdialog');
  await app.user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
  return app;
}

type Ui = Awaited<ReturnType<typeof asAdmin>>['user'];

async function pick(user: Ui, label: string, option: string | RegExp) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

const textbox = (name: string) => screen.getByRole('textbox', { name });

describe('ageFrom', () => {
  it('counts whole years, before and on the birthday', () => {
    expect(ageFrom('1946-02-14', new Date(2026, 1, 13))).toBe(79);
    expect(ageFrom('1946-02-14', new Date(2026, 1, 14))).toBe(80);
    expect(ageFrom('1946-02', new Date(2026, 1, 14))).toBeNull();
  });
});

describe('Form values of an existing resident', () => {
  const base: ResidentDetail = {
    id: '4',
    fullName: 'Benjamin Torres',
    age: 80,
    fallRisk: 'low',
    room: { id: '1', name: 'Room 201', wing: 'North Wing' },
    caregivers: [],
    hasActiveAlert: false,
    lastIncidentAt: null,
    sex: null,
    birthDate: null,
    mobilityAid: null,
    careNotes: null,
    isArchived: false,
    // How the FastAPI backend's one free-text contact arrives: no phone number.
    emergencyContacts: [
      { id: '4-contact', fullName: 'Carlo Torres (son) 0917 555 0134', relationship: null, phone: '' },
    ],
  };

  it('can be saved unchanged on a basic server, keeping the free-text contact', () => {
    expect(basicResidentFormSchema.parse(formValues(base))).toEqual({
      fullName: 'Benjamin Torres',
      sex: null,
      birthDate: null,
      age: 80,
      roomId: '1',
      fallRisk: 'low',
      mobilityAid: null,
      careNotes: null,
      emergencyContacts: [{ fullName: 'Carlo Torres (son) 0917 555 0134', relationship: null, phone: '' }],
      caregiverIds: [],
    });
  });

  it('can be saved unchanged with every detail', () => {
    const full: ResidentDetail = {
      ...base,
      sex: 'male',
      birthDate: '1946-02-14',
      emergencyContacts: [{ id: 'c1', fullName: 'Carlo Torres', relationship: null, phone: '0917 555 0134' }],
    };
    expect(residentFormSchema.parse(formValues(full))).toMatchObject({
      sex: 'male',
      birthDate: '1946-02-14',
      age: null,
      emergencyContacts: [{ fullName: 'Carlo Torres', relationship: null, phone: '0917 555 0134' }],
    });
  });
});

describe('Add resident (RES-02)', () => {
  it('adds a resident with a contact and a caregiver, then opens the profile', async () => {
    const { user, router } = await asAdmin('/residents');
    await user.click(await screen.findByRole('link', { name: 'Add resident' }));

    await user.type(await screen.findByRole('textbox', { name: 'Full name' }), 'Benjamin Cruz');
    await pick(user, 'Sex', 'Male');
    await user.type(screen.getByLabelText(/^Birth date/), '1946-02-14');
    expect(screen.getByText(`Age ${ageFrom('1946-02-14')}`)).toBeInTheDocument();
    await pick(user, 'Room', 'Room 104 · West Wing');
    await user.click(screen.getByRole('button', { name: 'Add contact' }));
    const contact = screen.getByRole('group', { name: 'Contact 1' });
    await user.type(within(contact).getByRole('textbox', { name: 'Name' }), 'Carlo Cruz');
    await user.type(within(contact).getByRole('textbox', { name: 'Relationship' }), 'Son');
    await user.type(within(contact).getByRole('textbox', { name: 'Phone' }), '0917 555 0134');
    await user.type(textbox('Mobility aid'), 'Cane');
    await pick(user, 'Fall-risk level', 'Low risk');
    await user.click(screen.getByRole('combobox', { name: 'Assigned caregivers' }));
    await user.click(await screen.findByRole('option', { name: /^Mark Dizon/ }));
    expect(screen.queryByRole('option', { name: /Liza Fernandez/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save resident' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Benjamin Cruz' })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/residents\/res-\d+$/);
    expect(screen.getByText(/Male · Room 104 · West Wing/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Assigned caregivers' })).toHaveTextContent('Mark Dizon');
    expect(screen.getByRole('list', { name: 'Emergency contacts' })).toHaveTextContent('Son · 0917 555 0134');
  });

  it('lists every problem before saving', async () => {
    const { user } = await asAdmin('/residents/new');
    await screen.findByRole('textbox', { name: 'Full name' });
    await user.click(screen.getByRole('button', { name: 'Add contact' }));
    await user.type(
      within(screen.getByRole('group', { name: 'Contact 1' })).getByRole('textbox', { name: 'Phone' }),
      '0917 12',
    );
    await user.click(screen.getByRole('button', { name: 'Save resident' }));

    expect(await screen.findByText('Fix 6 fields before saving.')).toBeInTheDocument();
    expect(screen.getByText('Enter the full name')).toBeInTheDocument();
    expect(screen.getByText('Choose the sex')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid birth date')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Room' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter the contact name')).toBeInTheDocument();
    expect(screen.getByText(/Enter an 11-digit mobile number/)).toBeInTheDocument();
  });

  it('is only for the Admin/Head', async () => {
    signInAs('u-joel');
    renderApp('/residents/new');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });
});

describe('Edit resident (RES-04)', () => {
  it('warns before leaving with unsaved changes, then saves', async () => {
    const { user, router } = await asAdmin('/residents/res-remedios');
    await user.click(await screen.findByRole('link', { name: 'Edit resident' }));
    const notes = await screen.findByRole('textbox', { name: 'Notes' });
    expect(textbox('Full name')).toHaveValue('Remedios Santos');
    await user.clear(notes);
    await user.type(notes, 'Uses the call bell at night.');
    await pick(user, 'Fall-risk level', 'Moderate risk');

    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    const warning = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(warning).toHaveTextContent('You changed 2 fields for Remedios Santos');
    await user.click(within(warning).getByRole('button', { name: 'Keep editing' }));
    expect(router.state.location.pathname).toBe('/residents/res-remedios/edit');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Remedios Santos' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/residents/res-remedios');
    expect(screen.getByText('Uses the call bell at night.')).toBeInTheDocument();
    expect(screen.getByText('Fall-risk level').nextSibling).toHaveTextContent('Moderate');
  });

  it('leaves without asking when nothing changed', async () => {
    const { user, router } = await asAdmin('/residents/res-remedios/edit');
    await screen.findByRole('textbox', { name: 'Full name' });
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Remedios Santos' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/residents/res-remedios');
  });
});

describe('Transfer room and caregivers (RES-05, RES-06)', () => {
  it('moves a resident to another room', async () => {
    const { user } = await asAdmin('/residents/res-remedios');
    await user.click(await screen.findByRole('button', { name: 'Transfer room' }));
    const dialog = screen.getByRole('dialog', { name: 'Transfer room' });
    expect(within(dialog).getByText('Room 101 · East Wing · 2 residents')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Transfer' }));
    expect(within(dialog).getByText('Choose the new room')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: /^Room 102 · East Wing/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Transfer' }));

    expect(await screen.findByText(/84 · Female · Room 102 · East Wing/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('assigns caregivers from the active employees', async () => {
    const { user } = await asAdmin('/residents/res-remedios');
    await user.click(await screen.findByRole('button', { name: 'Assign caregivers' }));
    const dialog = screen.getByRole('dialog', { name: 'Assign caregivers' });
    expect(
      within(dialog).getByText('Deactivated accounts (Liza Fernandez) are not listed.'),
    ).toBeInTheDocument();
    expect(await within(dialog).findByRole('checkbox', { name: /Joel Ramos/ })).toBeChecked();
    await user.type(within(dialog).getByRole('textbox', { name: 'Search employees' }), 'mark');
    await user.click(within(dialog).getByRole('checkbox', { name: /Mark Dizon/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save caregivers' }));

    expect(await screen.findByText('Mark Dizon')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Assigned caregivers' })).toHaveTextContent('Joel Ramos');
  });
});

describe('Archive and restore (RES-07)', () => {
  it('needs a note for "Other", archives, and restores from the archived list', async () => {
    const { user } = await asAdmin('/residents/res-antonio');
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = screen.getByRole('dialog', { name: 'Archive Antonio Navarro?' });
    await user.click(within(dialog).getByRole('radio', { name: 'Other' }));
    await user.click(within(dialog).getByRole('button', { name: 'Archive resident' }));
    expect(await within(dialog).findByText('Explain the reason')).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: /Note/ }), 'Moved to a hospital.');
    await user.click(within(dialog).getByRole('button', { name: 'Archive resident' }));

    expect(await screen.findByText(/Antonio Navarro is archived/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit resident' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Residents' }));
    expect(await screen.findByText('7 residents in the facility')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Archived' }));
    expect(await screen.findByText('1 archived resident')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Antonio Navarro' }));

    await user.click(await screen.findByRole('button', { name: 'Restore resident' }));
    const restore = screen.getByRole('dialog', { name: 'Restore Antonio Navarro?' });
    await user.click(within(restore).getByRole('button', { name: 'Restore resident' }));
    expect(await screen.findByRole('link', { name: 'Edit resident' })).toBeInTheDocument();
    expect(screen.queryByText(/is archived/)).not.toBeInTheDocument();
  });

  it('shows caregivers no editing buttons', async () => {
    signInAs('u-joel');
    const { user } = renderApp('/residents/res-remedios');
    const popup = await screen.findByRole('alertdialog');
    await user.click(within(popup).getByRole('button', { name: 'Close alert popup' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Remedios Santos' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit resident' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
  });
});

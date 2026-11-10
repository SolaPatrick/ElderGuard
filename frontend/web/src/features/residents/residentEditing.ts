import type { ResidentDetail, ResidentForm, ResidentRequest } from '@elderguard/shared';

export const SEX_LABEL = { female: 'Female', male: 'Male' } as const;

export const EMPTY_RESIDENT: ResidentForm = {
  fullName: '',
  roomId: '',
  fallRisk: 'moderate',
  careNotes: '',
  mobilityAid: '',
  emergencyContacts: [],
  caregiverIds: [],
  sex: '',
  birthDate: '',
  age: '',
  emergencyContact: '',
};

/** The form filled in with a resident's current details (RES-04). */
export function formValues(r: ResidentDetail): ResidentForm {
  return {
    fullName: r.fullName,
    roomId: r.room?.id ?? '',
    fallRisk: r.fallRisk,
    careNotes: r.careNotes ?? '',
    mobilityAid: r.mobilityAid ?? '',
    emergencyContacts: r.emergencyContacts.map((c) => ({
      fullName: c.fullName,
      relationship: c.relationship ?? '',
      phone: c.phone,
    })),
    caregiverIds: r.caregivers.map((c) => c.id),
    sex: r.sex ?? '',
    birthDate: r.birthDate ?? '',
    age: r.age === null ? '' : String(r.age),
    // A server without residentDetails keeps one free-text contact, shown as the contact's name.
    emergencyContact: r.emergencyContacts[0]?.fullName ?? '',
  };
}

/**
 * The resident as it is now, as an update request, so a dialog can change one thing
 * (the room, the caregivers) and save the rest unchanged.
 */
export function currentRequest(r: ResidentDetail): ResidentRequest {
  return {
    fullName: r.fullName,
    sex: r.sex,
    birthDate: r.birthDate,
    // With a birth date the server works the age out itself.
    age: r.birthDate === null ? r.age : null,
    roomId: r.room?.id ?? null,
    fallRisk: r.fallRisk,
    mobilityAid: r.mobilityAid,
    careNotes: r.careNotes,
    emergencyContacts: r.emergencyContacts.map(({ fullName, relationship, phone }) => ({
      fullName,
      relationship,
      phone,
    })),
    caregiverIds: r.caregivers.map((c) => c.id),
  };
}

/** Whole years from a YYYY-MM-DD birth date to today, or null while the date is incomplete. */
export function ageFrom(birthDate: string, today = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const had = today.getMonth() + 1 > mo || (today.getMonth() + 1 === mo && today.getDate() >= d);
  const age = today.getFullYear() - y - (had ? 0 : 1);
  return age >= 0 && age <= 130 ? age : null;
}

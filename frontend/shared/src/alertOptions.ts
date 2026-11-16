/** Choices shown in the classify and resolve dialogs. */
export const FALSE_ALARM_REASONS = [
  'Resident sat or lay down on purpose',
  'Object dropped on the floor',
  'Staff or visitor in view',
  'Camera glare or shadow',
  'Other',
] as const;

export const OUTCOMES = [
  'Assisted, no injury',
  'Assisted, minor injury',
  'Sent to hospital',
  'Family notified',
  'Assistance given',
] as const;

import type { IncidentStatus } from './schemas';

/** PRF-04 / M-31 Help: the same words on the web and the phone. */
export const HELP_STEPS = [
  {
    title: 'Possible fall detected',
    body: 'A camera sees a possible fall and the alarm sounds on every signed-in screen, with the room and camera.',
  },
  { title: 'Acknowledge', body: 'Tell the team you are responding. The alarm stops for everyone.' },
  { title: 'Go to the resident', body: 'Open the live camera, or go to the room in person.' },
  { title: 'Classify', body: 'Mark it as a confirmed incident, or as a false alarm with a reason.' },
  { title: 'Resolve', body: 'Choose the outcome and write a short summary of what you did.' },
] as const;

export const STATUS_MEANING: Record<IncidentStatus, string> = {
  new: 'Nobody has acknowledged it yet',
  acknowledged: 'Someone is responding',
  confirmed: 'A real fall or emergency',
  false_alarm: 'No fall happened',
  resolved: 'Closed with an outcome',
};

export const HELP_LIMITATIONS =
  'ElderGuard is an assistive tool. It does not replace rounds and in-person checks. A camera can miss a fall it cannot see clearly (outside its view, blocked, or in poor light), and it can raise false alarms. Always respond to a resident who calls for help, whatever the screen shows.';

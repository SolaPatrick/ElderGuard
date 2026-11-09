import { describe, expect, it } from 'vitest';
import {
  describeAreas,
  formatElapsed,
  formatShortDuration,
  incidentPersonName,
  incidentTitle,
  initials,
  secondsBetween,
} from '../format';

describe('formatElapsed', () => {
  it.each([
    [0, '0:00'],
    [42, '0:42'],
    [192, '3:12'],
    [3725, '1:02:05'],
    [-5, '0:00'],
    [Number.NaN, '0:00'],
  ])('%s seconds -> %s', (input, expected) => {
    expect(formatElapsed(input)).toBe(expected);
  });
});

describe('formatShortDuration', () => {
  it('formats minutes and seconds like the dashboard', () => {
    expect(formatShortDuration(84)).toBe('1m 24s');
    expect(formatShortDuration(48)).toBe('0m 48s');
  });
  it('shows a dash when there is no data', () => {
    expect(formatShortDuration(null)).toBe('—');
  });
  it('switches to hours for long durations', () => {
    expect(formatShortDuration(3 * 3600 + 5 * 60)).toBe('3h 5m');
  });
});

describe('secondsBetween', () => {
  it('never returns a negative number (clock skew)', () => {
    expect(secondsBetween('2026-10-19T14:41:00Z', Date.parse('2026-10-19T14:40:00Z'))).toBe(0);
  });
  it('returns 0 for invalid dates', () => {
    expect(secondsBetween('not a date', new Date())).toBe(0);
  });
  it('counts whole seconds', () => {
    expect(secondsBetween('2026-10-19T14:41:00Z', Date.parse('2026-10-19T14:44:12.900Z'))).toBe(192);
  });
});

describe('initials', () => {
  it.each([
    ['Joel Ramos', 'JR'],
    ['Ma. Teresa Reyes', 'TR'],
    ['Mark Dizon', 'MD'],
    ['Cher', 'C'],
    ['', '?'],
  ])('%s -> %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('incident copy', () => {
  it('never uses diagnostic wording for falls', () => {
    expect(incidentTitle({ type: 'fall' })).toBe('Possible fall detected');
  });
  it('names the sender for SOS and the resident for falls', () => {
    const sentBy = { id: 'u1', fullName: 'Angelica Cruz' };
    const resident = { id: 'r1', fullName: 'Remedios Santos', age: 84, fallRisk: 'high' as const };
    expect(incidentPersonName({ type: 'sos', sentBy, resident })).toBe('Angelica Cruz');
    expect(incidentPersonName({ type: 'fall', sentBy: null, resident })).toBe('Remedios Santos');
    expect(incidentPersonName({ type: 'fall', sentBy: null, resident: null })).toBe('Unknown resident');
  });
});

describe('describeAreas', () => {
  const room = (name: string, wing: string | null = null) => ({ name, wing });
  it('matches the caregiver dashboard subtitle in the design', () => {
    expect(
      describeAreas([
        room('Room 101', 'East Wing'),
        room('Room 102', 'East Wing'),
        room('Room 103', 'East Wing'),
      ]),
    ).toBe('East Wing · Rooms 101–103');
  });
  it('lists non-room areas and breaks room ranges', () => {
    expect(describeAreas([room('Dining Hall'), room('Room 105'), room('Room 101'), room('Room 102')])).toBe(
      'Rooms 101–102, 105, Dining Hall',
    );
  });
  it('handles a single room and no assignment', () => {
    expect(describeAreas([room('Room 104', 'West Wing')])).toBe('West Wing · Room 104');
    expect(describeAreas([])).toBe('No areas assigned');
  });
});

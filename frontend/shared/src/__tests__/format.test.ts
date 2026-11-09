import { describe, expect, it } from 'vitest';
import {
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

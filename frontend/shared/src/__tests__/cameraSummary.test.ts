import { describe, expect, it } from 'vitest';
import type { Camera } from '../schemas';
import { cameraNeedsAttention, cameraSummary } from '../cameraSummary';

const cams = (...statuses: Camera['status'][]) => statuses.map((status) => ({ status }) as Camera);

describe('cameraSummary', () => {
  it('counts paused cameras apart from broken ones', () => {
    expect(cameraSummary(cams('online', 'paused'))).toBe('1 of 2 cameras online · 1 paused · none offline');
  });

  it('says how many need attention', () => {
    expect(cameraSummary(cams('online', 'offline', 'error', 'connecting'))).toBe(
      '1 of 4 cameras online · 1 connecting · 2 need attention',
    );
    expect(cams('offline', 'error', 'paused', 'online').map(cameraNeedsAttention)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('handles one camera and none', () => {
    expect(cameraSummary(cams('online'))).toBe('1 of 1 camera online · none offline');
    expect(cameraSummary([])).toBe('0 of 0 cameras online · none offline');
  });
});

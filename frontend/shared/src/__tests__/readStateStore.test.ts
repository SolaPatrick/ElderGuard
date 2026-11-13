import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReadState, markRead, setReadState, subscribeReadState } from '../notifications';

/** A small in-memory localStorage (these tests run in Node). */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe('shared notification read state', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('returns the same object until it changes, and tells listeners', () => {
    const first = getReadState('u1');
    expect(getReadState('u1')).toBe(first);
    const listener = vi.fn();
    const stop = subscribeReadState(listener);
    const next = markRead(first, 'x', true);
    setReadState('u1', next);
    expect(listener).toHaveBeenCalledOnce();
    expect(getReadState('u1')).toBe(next);
    stop();
  });

  it('keeps the starting point instead of moving it on every load', () => {
    const first = getReadState('u2');
    expect(JSON.parse(localStorage.getItem('eg.notifications.u2')!)).toEqual(first);
  });

  it('starts over when the stored state is removed (e.g. another user, cleared storage)', () => {
    const before = getReadState('u3');
    setReadState('u3', markRead(before, 'x', true));
    localStorage.clear();
    expect(getReadState('u3').read).toEqual([]);
  });
});

import { useSyncExternalStore } from 'react';

/**
 * M-29 settings kept on this phone only (no server stores them): light or dark look, how loud the
 * alarm is, and whether alerts vibrate. The phone's localStorage is kept with expo-sqlite.
 */
export type Appearance = 'system' | 'light' | 'dark';
export type AlarmVolume = 'medium' | 'high' | 'max';
export type Vibrate = 'on' | 'off';

export interface Prefs {
  appearance: Appearance;
  alarmVolume: AlarmVolume;
  vibrate: Vibrate;
}

const KEY = 'elderguard.phonePrefs';
export const DEFAULT_PREFS: Prefs = { appearance: 'system', alarmVolume: 'max', vibrate: 'on' };

/** The player volume, 0 to 1, for each alarm volume choice. */
export const ALARM_VOLUME_LEVEL: Record<AlarmVolume, number> = { medium: 0.5, high: 0.75, max: 1 };

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

function read(): Prefs {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      appearance: pick(v.appearance, ['system', 'light', 'dark'], DEFAULT_PREFS.appearance),
      alarmVolume: pick(v.alarmVolume, ['medium', 'high', 'max'], DEFAULT_PREFS.alarmVolume),
      vibrate: pick(v.vibrate, ['on', 'off'], DEFAULT_PREFS.vibrate),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// useSyncExternalStore needs the same object until something changes.
let current: Prefs | null = null;
const listeners = new Set<() => void>();

export function getPrefs(): Prefs {
  current ??= read();
  return current;
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  current = { ...getPrefs(), [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not saved; the choice lasts until the app closes.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getPrefs, () => DEFAULT_PREFS);
}

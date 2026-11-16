import { useSyncExternalStore } from 'react';

/**
 * Alert preferences kept on this computer only (no server stores them yet):
 * the alarm volume, and whether the alert setup screen was done after logging in.
 */
const VOLUME_KEY = 'elderguard.alarmVolume';
const SETUP_KEY = 'elderguard.alertSetupDone';
export const DEFAULT_VOLUME = 80;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Alarm volume on this computer, 0 to 100. */
export function getAlarmVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return DEFAULT_VOLUME;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function setAlarmVolume(volume: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.min(100, Math.max(0, Math.round(volume)))));
  } catch {
    // Not saved; the alarm keeps the old volume.
  }
  emit();
}

export function useAlarmVolume(): number {
  return useSyncExternalStore(subscribe, getAlarmVolume, () => DEFAULT_VOLUME);
}

function setupUsers(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SETUP_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** True once this user has finished the alert setup screen on this computer. */
export function isAlertSetupDone(userId: string): boolean {
  return setupUsers().includes(userId);
}

export function markAlertSetupDone(userId: string) {
  if (isAlertSetupDone(userId)) return;
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify([...setupUsers(), userId]));
  } catch {
    // Not saved; the setup screen shows again after the next login.
  }
}

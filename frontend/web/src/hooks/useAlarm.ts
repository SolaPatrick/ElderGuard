import { useEffect } from 'react';
import { useAlarmVolume } from '../features/alertSetup/alertPrefs';

/** Loudest point of one tone at 100% volume. 80% (the default) gives the original 0.25. */
const PEAK_AT_FULL = 0.3125;

function createContext(): AudioContext | null {
  const AudioCtx = window.AudioContext as typeof AudioContext | undefined;
  if (!AudioCtx) return null;
  try {
    return new AudioCtx();
  } catch {
    return null;
  }
}

/** One two-tone beep (880 Hz then 660 Hz, half a second) at a volume from 0 to 100. */
function beep(ctx: AudioContext, volume: number, at = ctx.currentTime) {
  if (volume <= 0) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  const peak = (PEAK_AT_FULL * volume) / 100;
  [880, 660].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at + i * 0.25);
    gain.gain.exponentialRampToValueAtTime(peak, at + i * 0.25 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + i * 0.25 + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at + i * 0.25);
    osc.stop(at + i * 0.25 + 0.24);
  });
}

/**
 * Plays a repeating two-tone alarm while `active` is true, at the volume set for this computer.
 * Browsers only allow sound after the user has clicked something on the page
 * (logging in counts). If sound is blocked or unsupported, it fails silently and
 * the visual alert still shows.
 */
export function useAlarm(active: boolean, intervalMs = 2000) {
  const volume = useAlarmVolume();
  useEffect(() => {
    if (!active) return;
    const ctx = createContext();
    if (!ctx) return;
    beep(ctx, volume);
    const id = window.setInterval(() => beep(ctx, volume), intervalMs);
    return () => {
      window.clearInterval(id);
      void ctx.close().catch(() => undefined);
    };
  }, [active, intervalMs, volume]);
}

/**
 * Plays the alarm three times (about 2.5 seconds) so the user can check their speakers.
 * Returns false when this browser cannot play sound at all.
 */
export function playTestAlarm(volume: number): boolean {
  const ctx = createContext();
  if (!ctx) return false;
  [0, 1, 2].forEach((n) => beep(ctx, volume, ctx.currentTime + n));
  window.setTimeout(() => void ctx.close().catch(() => undefined), 3500);
  return true;
}

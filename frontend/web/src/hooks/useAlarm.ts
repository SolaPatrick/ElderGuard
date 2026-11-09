import { useEffect } from 'react';

/**
 * Plays a repeating two-tone alarm while `active` is true.
 * Browsers only allow sound after the user has clicked something on the page
 * (logging in counts). If sound is blocked or unsupported, it fails silently and
 * the visual alert still shows.
 */
export function useAlarm(active: boolean, intervalMs = 2000) {
  useEffect(() => {
    if (!active) return;
    const AudioCtx = window.AudioContext as typeof AudioContext | undefined;
    if (!AudioCtx) return;
    let ctx: AudioContext;
    try {
      ctx = new AudioCtx();
    } catch {
      return;
    }

    const beep = () => {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      const start = ctx.currentTime;
      [880, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start + i * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.25, start + i * 0.25 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.25 + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start + i * 0.25);
        osc.stop(start + i * 0.25 + 0.24);
      });
    };

    beep();
    const id = window.setInterval(beep, intervalMs);
    return () => {
      window.clearInterval(id);
      void ctx.close().catch(() => undefined);
    };
  }, [active, intervalMs]);
}

import { useEffect } from 'react';
import { Vibration } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// The same two-tone beep as the web app, repeating every 2 seconds.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ALARM_SOUND = require('../../assets/sounds/alarm.wav') as number;

/** Vibrate for 0.8 s, pause 1.2 s, and repeat. */
const VIBRATION_PATTERN = [0, 800, 1200];

/**
 * M-14: sound and vibration while an alert is waiting. Plays even when the phone's ringer is
 * on silent. If sound fails, the full-screen alert and vibration still work.
 */
export function useAlarm(active: boolean) {
  useEffect(() => {
    if (!active) return;
    Vibration.vibrate(VIBRATION_PATTERN, true);
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    try {
      player = createAudioPlayer(ALARM_SOUND);
      player.loop = true;
      void setAudioModeAsync({ playsInSilentMode: true })
        .catch(() => undefined)
        .then(() => player?.play());
    } catch {
      // No sound is better than no alert.
    }
    return () => {
      Vibration.cancel();
      try {
        player?.remove();
      } catch {
        // Already released.
      }
      player = null;
    };
  }, [active]);
}

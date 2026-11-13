/**
 * Where Den's FastAPI backend is, ending in /api. A phone cannot reach "localhost" on your
 * computer, so set EXPO_PUBLIC_API_URL in mobile/.env.local to your computer's address on the
 * same Wi-Fi, e.g. http://192.168.1.20:8000/api. See mobile/README.md.
 */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(
  /\/+$/,
  '',
);

/** How often to check for new alerts (ms), the same as the web app. */
export const ALERT_POLL_MS = 5_000;

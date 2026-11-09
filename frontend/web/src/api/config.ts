/** Base URL of the backend API, e.g. "/api" or "https://api.elderguard.example". No trailing slash. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

/** The fake API is on unless VITE_USE_MOCKS is set to "false". */
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';

/** How often to check for new alerts (ms). Replace with a WebSocket once the backend has one. */
export const ALERT_POLL_MS = 5_000;

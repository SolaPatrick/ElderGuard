/**
 * The backend calls, shared by the web app and the mobile app.
 * Each app calls configureApi once at start-up with its base URL and token storage.
 */
export { ApiError, apiBlob, apiConfig, apiRequest, configureApi, onUnauthorized } from './client';
export type { ApiConfig } from './client';
export { contractApi } from './contract';
export { alertCode, alertIdFromCode, fastApi, isoUtc } from './fastapi';

import { configureApi, fastApi } from '@elderguard/shared/api';
import { tokenStore } from './auth/tokenStore';
import { API_BASE_URL } from './config';

configureApi({ baseUrl: API_BASE_URL, getToken: tokenStore.get });

/**
 * Every screen calls Den's FastAPI backend through this object: the same translation layer
 * (shared/src/api/fastapi.ts) and tests the web app uses. The phone has no fake server.
 */
export const api = fastApi;
export { ApiError, onUnauthorized } from '@elderguard/shared/api';

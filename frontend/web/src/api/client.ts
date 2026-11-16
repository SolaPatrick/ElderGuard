import { configureApi } from '@elderguard/shared/api';
import { tokenStorage } from '../auth/tokenStorage';
import { API_BASE_URL } from './config';

// The request code lives in shared/src/api so the mobile app uses the same calls.
configureApi({ baseUrl: API_BASE_URL, getToken: () => tokenStorage.get() });

export { ApiError, apiBlob, apiRequest, onUnauthorized } from '@elderguard/shared/api';

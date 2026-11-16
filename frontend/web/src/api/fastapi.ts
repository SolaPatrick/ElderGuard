import './client';

// The FastAPI translation layer lives in shared/src/api so the mobile app uses it too.
export { alertCode, alertIdFromCode, fastApi, isoUtc } from '@elderguard/shared/api';

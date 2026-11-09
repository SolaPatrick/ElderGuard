import { apiRequest } from '../api/client';
import { incidentDetailSchema } from '@elderguard/shared';

/** Fake API only: makes a camera "detect" a fall so you can demo the alert flow. */
export const simulateFall = () => apiRequest('/dev/simulate-fall', incidentDetailSchema, { method: 'POST' });

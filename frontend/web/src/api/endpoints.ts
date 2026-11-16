import { contractApi } from '@elderguard/shared/api';
import './client';
import { BACKEND } from './config';
import { fastApi } from './fastapi';

/**
 * What the connected server can do. The FastAPI backend has no area assignments yet
 * (frontend/docs/backend-gaps.md), so the screens hide that part instead of dropping input.
 */
export const serverFeatures = {
  areaAssignment: BACKEND !== 'fastapi',
  /**
   * Sex, birth date, mobility aid, several emergency contacts with phone numbers, caregivers
   * and an archive reason. Without them the resident form asks for an age and one free-text
   * contact, which is all the FastAPI backend keeps.
   */
  residentDetails: BACKEND !== 'fastapi',
};

/**
 * Every screen calls the backend through this object. With VITE_BACKEND=fastapi it talks to
 * the FastAPI server in backend/ through a translation layer (see fastapi.ts).
 */
export const api: typeof contractApi = BACKEND === 'fastapi' ? fastApi : contractApi;

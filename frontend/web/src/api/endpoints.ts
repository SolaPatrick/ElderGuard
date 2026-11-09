/**
 * Every backend call the app makes, in one place.
 * The paths and payloads are documented in frontend/docs/api-contract.md.
 */
import {
  activityEntrySchema,
  cameraSchema,
  dashboardSummarySchema,
  incidentDetailSchema,
  incidentSchema,
  loginResponseSchema,
  residentDetailSchema,
  residentSchema,
  userSchema,
  type AddNoteRequest,
  type ChangePasswordRequest,
  type ClassifyRequest,
  type LoginRequest,
  type ResolveRequest,
} from '@elderguard/shared';
import { z } from 'zod';
import { apiRequest } from './client';
import { BACKEND } from './config';
import { fastApi } from './fastapi';

const ok = z.object({ ok: z.literal(true) });
const enc = encodeURIComponent;

/** The backend described in frontend/docs/api-contract.md (also what the fake API follows). */
const contractApi = {
  login: (body: LoginRequest) =>
    apiRequest('/auth/login', loginResponseSchema, { method: 'POST', body, skipAuthRedirect: true }),
  me: (signal?: AbortSignal) => apiRequest('/auth/me', userSchema, signal ? { signal } : {}),
  logout: () => apiRequest('/auth/logout', ok, { method: 'POST', skipAuthRedirect: true }),
  changePassword: (body: ChangePasswordRequest) =>
    apiRequest('/auth/change-password', loginResponseSchema, { method: 'POST', body }),

  dashboardSummary: () => apiRequest('/dashboard/summary', dashboardSummarySchema),
  activity: (limit: number) => apiRequest(`/activity?limit=${limit}`, z.array(activityEntrySchema)),
  cameras: () => apiRequest('/cameras', z.array(cameraSchema)),
  residents: () => apiRequest('/residents', z.array(residentSchema)),
  resident: (id: string) => apiRequest(`/residents/${enc(id)}`, residentDetailSchema),

  activeIncidents: () => apiRequest('/incidents?scope=active', z.array(incidentSchema)),
  incidents: (limit = 50) => apiRequest(`/incidents?scope=all&limit=${limit}`, z.array(incidentSchema)),
  incident: (code: string) => apiRequest(`/incidents/${enc(code)}`, incidentDetailSchema),

  acknowledge: (code: string) =>
    apiRequest(`/incidents/${enc(code)}/acknowledge`, incidentDetailSchema, { method: 'POST' }),
  classify: (code: string, body: ClassifyRequest) =>
    apiRequest(`/incidents/${enc(code)}/classify`, incidentDetailSchema, { method: 'POST', body }),
  resolve: (code: string, body: ResolveRequest) =>
    apiRequest(`/incidents/${enc(code)}/resolve`, incidentDetailSchema, { method: 'POST', body }),
  addNote: (code: string, body: AddNoteRequest) =>
    apiRequest(`/incidents/${enc(code)}/notes`, incidentDetailSchema, { method: 'POST', body }),
};

/**
 * Every screen calls the backend through this object. With VITE_BACKEND=fastapi it talks to
 * the FastAPI server in backend/ through a translation layer (see fastapi.ts).
 */
export const api: typeof contractApi = BACKEND === 'fastapi' ? fastApi : contractApi;

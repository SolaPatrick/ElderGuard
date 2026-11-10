/**
 * Every backend call the app makes, in one place.
 * The paths and payloads are documented in frontend/docs/api-contract.md.
 */
import {
  activityEntrySchema,
  cameraSchema,
  cameraSettingsSchema,
  cameraTestResultSchema,
  dashboardSummarySchema,
  incidentDetailSchema,
  incidentSchema,
  loginResponseSchema,
  residentDetailSchema,
  residentSchema,
  roomRefSchema,
  staffMemberSchema,
  staffWithPasswordSchema,
  userSchema,
  type AddNoteRequest,
  type ChangePasswordRequest,
  type ClassifyRequest,
  type CreateStaffRequest,
  type RoomRequest,
  type ResidentRequest,
  type ArchiveRequest,
  type CameraRequest,
  type UpdateStaffRequest,
  type LoginRequest,
  type ResolveRequest,
  type SosRequest,
  type CancelSosRequest,
} from '@elderguard/shared';
import { z } from 'zod';
import { apiBlob, apiRequest } from './client';
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
  /** The camera's newest picture as a JPEG. 404 when the camera has no picture yet. */
  cameraPicture: (id: string, signal?: AbortSignal) =>
    apiBlob(`/cameras/${enc(id)}/snapshot`, signal ? { signal } : {}),
  /** Current residents, or (archived = true, Admin/Head only) former ones. */
  residents: (archived = false) =>
    apiRequest(archived ? '/residents?archived=true' : '/residents', z.array(residentSchema)),
  rooms: () => apiRequest('/rooms', z.array(roomRefSchema)),
  resident: (id: string) => apiRequest(`/residents/${enc(id)}`, residentDetailSchema),

  activeIncidents: () => apiRequest('/incidents?scope=active', z.array(incidentSchema)),
  incidents: (limit = 50) => apiRequest(`/incidents?scope=all&limit=${limit}`, z.array(incidentSchema)),
  incident: (code: string) => apiRequest(`/incidents/${enc(code)}`, incidentDetailSchema),
  sendSos: (body: SosRequest) => apiRequest('/incidents/sos', incidentDetailSchema, { method: 'POST', body }),
  /** SOS-03. Only the sender or the Admin/Head, while the SOS is open. */
  cancelSos: (code: string, body: CancelSosRequest) =>
    apiRequest(`/incidents/${enc(code)}/cancel-sos`, incidentDetailSchema, { method: 'POST', body }),

  acknowledge: (code: string) =>
    apiRequest(`/incidents/${enc(code)}/acknowledge`, incidentDetailSchema, { method: 'POST' }),
  classify: (code: string, body: ClassifyRequest) =>
    apiRequest(`/incidents/${enc(code)}/classify`, incidentDetailSchema, { method: 'POST', body }),
  resolve: (code: string, body: ResolveRequest) =>
    apiRequest(`/incidents/${enc(code)}/resolve`, incidentDetailSchema, { method: 'POST', body }),
  addNote: (code: string, body: AddNoteRequest) =>
    apiRequest(`/incidents/${enc(code)}/notes`, incidentDetailSchema, { method: 'POST', body }),

  // Cameras & Devices (Admin/Head only)
  cameraSettings: (id: string) => apiRequest(`/cameras/${enc(id)}/settings`, cameraSettingsSchema),
  createCamera: (body: CameraRequest) =>
    apiRequest('/cameras', cameraSettingsSchema, { method: 'POST', body }),
  updateCamera: (id: string, body: CameraRequest) =>
    apiRequest(`/cameras/${enc(id)}`, cameraSettingsSchema, { method: 'PATCH', body }),
  deleteCamera: async (id: string) => {
    await apiRequest(`/cameras/${enc(id)}`, z.null(), { method: 'DELETE' });
  },
  testCameraSource: (source: string) =>
    apiRequest('/cameras/test', cameraTestResultSchema, { method: 'POST', body: { source } }),

  // Rooms & Areas (Admin/Head only)
  createRoom: (body: RoomRequest) => apiRequest('/rooms', roomRefSchema, { method: 'POST', body }),
  updateRoom: (id: string, body: RoomRequest) =>
    apiRequest(`/rooms/${enc(id)}`, roomRefSchema, { method: 'PATCH', body }),
  deleteRoom: async (id: string) => {
    await apiRequest(`/rooms/${enc(id)}`, z.null(), { method: 'DELETE' });
  },

  // Resident editing (Admin/Head only)
  createResident: (body: ResidentRequest) =>
    apiRequest('/residents', residentDetailSchema, { method: 'POST', body }),
  updateResident: (id: string, body: ResidentRequest) =>
    apiRequest(`/residents/${enc(id)}`, residentDetailSchema, { method: 'PATCH', body }),
  /** body is null on a server without residentDetails, which keeps no reason. */
  archiveResident: (id: string, body: ArchiveRequest | null) =>
    apiRequest(`/residents/${enc(id)}/archive`, residentDetailSchema, {
      method: 'POST',
      ...(body !== null && { body }),
    }),
  restoreResident: (id: string) =>
    apiRequest(`/residents/${enc(id)}/restore`, residentDetailSchema, { method: 'POST' }),

  // Users & Access (Admin/Head only)
  staff: () => apiRequest('/users', z.array(staffMemberSchema)),
  staffMember: (id: string) => apiRequest(`/users/${enc(id)}`, staffMemberSchema),
  createStaff: (body: CreateStaffRequest) =>
    apiRequest('/users', staffWithPasswordSchema, { method: 'POST', body }),
  updateStaff: (id: string, body: UpdateStaffRequest) =>
    apiRequest(`/users/${enc(id)}`, staffMemberSchema, { method: 'PATCH', body }),
  deactivateStaff: (id: string) =>
    apiRequest(`/users/${enc(id)}/deactivate`, staffMemberSchema, { method: 'POST' }),
  reactivateStaff: (id: string) =>
    apiRequest(`/users/${enc(id)}/reactivate`, staffMemberSchema, { method: 'POST' }),
  resetStaffPassword: (id: string) =>
    apiRequest(`/users/${enc(id)}/reset-password`, staffWithPasswordSchema, { method: 'POST' }),
};

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

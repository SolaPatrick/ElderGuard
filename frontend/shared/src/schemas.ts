/**
 * API contract between the ElderGuard frontend and backend.
 *
 * Every response from the backend is checked against these schemas at runtime
 * (see web/src/api/client.ts). If the backend sends something different, the app
 * shows a clear "unexpected response" error instead of crashing somewhere random.
 *
 * Field names follow the ERD (elderguard-erd.md) but in camelCase, and the API
 * returns "views" that already include display names (resident name, room name)
 * so the UI does not need extra requests. See frontend/docs/api-contract.md.
 */
import { z } from 'zod';

const isoDateTime = z.iso.datetime({ offset: true });

export const roleSchema = z.enum(['admin', 'employee']);
export type Role = z.infer<typeof roleSchema>;

export const roomRefSchema = z.object({ id: z.string(), name: z.string(), wing: z.string().nullable() });
export type RoomRef = z.infer<typeof roomRefSchema>;

export const userSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  username: z.string(),
  /** Optional: staff can log in with their username. */
  email: z.email().nullable(),
  role: roleSchema,
  /** Job title shown under the name, e.g. "Admin/Head" or "Caregiver". */
  title: z.string(),
  mustChangePassword: z.boolean(),
  /**
   * Rooms and areas a caregiver is assigned to monitor. Caregivers only see
   * alerts, cameras and residents in these areas. Empty for the Admin/Head (sees everything).
   */
  areas: z.array(roomRefSchema),
});
export type User = z.infer<typeof userSchema>;

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username or email'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  token: z.string().min(1),
  user: userSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** AUTH: the form on the change-password page. */
export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'The two new passwords are different',
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'Choose a password different from the current one',
    path: ['newPassword'],
  });
export type ChangePasswordForm = z.infer<typeof changePasswordFormSchema>;
export type ChangePasswordRequest = Pick<ChangePasswordForm, 'currentPassword' | 'newPassword'>;

export const incidentTypeSchema = z.enum(['fall', 'sos']);
export type IncidentType = z.infer<typeof incidentTypeSchema>;

/**
 * new -> acknowledged -> confirmed -> resolved
 *                     \-> false_alarm (closed)
 */
export const incidentStatusSchema = z.enum(['new', 'acknowledged', 'confirmed', 'false_alarm', 'resolved']);
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

/** Statuses where the incident is still an open alert that needs a person. */
export const ACTIVE_STATUSES: readonly IncidentStatus[] = ['new', 'acknowledged', 'confirmed'];
export const isActiveStatus = (s: IncidentStatus) => ACTIVE_STATUSES.includes(s);

export const fallRiskSchema = z.enum(['low', 'moderate', 'high']);
export type FallRisk = z.infer<typeof fallRiskSchema>;

const personRefSchema = z.object({ id: z.string(), fullName: z.string() });

export const incidentSchema = z.object({
  /** Human-readable ID, e.g. INC-2026-0142. Used in URLs. */
  code: z.string(),
  type: incidentTypeSchema,
  status: incidentStatusSchema,
  resident: personRefSchema.extend({ age: z.number().int().nullable(), fallRisk: fallRiskSchema }).nullable(),
  room: roomRefSchema,
  camera: z.object({ id: z.string(), code: z.string() }).nullable(),
  /** For SOS: the staff member who pressed SOS. */
  sentBy: personRefSchema.nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  snapshotUrl: z.string().nullable(),
  clipUrl: z.string().nullable(),
  detectedAt: isoDateTime,
  acknowledgedAt: isoDateTime.nullable(),
  acknowledgedBy: personRefSchema.nullable(),
  resolvedAt: isoDateTime.nullable(),
  resolvedBy: personRefSchema.nullable(),
  escalatedAt: isoDateTime.nullable(),
  falseAlarmReason: z.string().nullable(),
  outcome: z.string().nullable(),
});
export type Incident = z.infer<typeof incidentSchema>;

export const incidentEventActionSchema = z.enum([
  'detected',
  'acknowledged',
  'classified',
  'resolved',
  'escalated',
]);
export type IncidentEventAction = z.infer<typeof incidentEventActionSchema>;

export const incidentEventSchema = z.object({
  id: z.string(),
  action: incidentEventActionSchema,
  occurredAt: isoDateTime,
  user: personRefSchema.nullable(),
  detail: z.string().nullable(),
});
export type IncidentEvent = z.infer<typeof incidentEventSchema>;

export const responseNoteSchema = z.object({
  id: z.string(),
  body: z.string(),
  author: personRefSchema,
  createdAt: isoDateTime,
});
export type ResponseNote = z.infer<typeof responseNoteSchema>;

export const incidentDetailSchema = incidentSchema.extend({
  events: z.array(incidentEventSchema),
  notes: z.array(responseNoteSchema),
});
export type IncidentDetail = z.infer<typeof incidentDetailSchema>;

export const classifyRequestSchema = z
  .object({
    classification: z.enum(['confirmed', 'false_alarm']),
    falseAlarmReason: z.string().trim().optional(),
  })
  .refine((v) => v.classification !== 'false_alarm' || (v.falseAlarmReason ?? '').length > 0, {
    message: 'Choose why this is a false alarm',
    path: ['falseAlarmReason'],
  });
export type ClassifyRequest = z.infer<typeof classifyRequestSchema>;

/** SOS-01: a staff member asks every on-duty colleague for help. */
export const sosRequestSchema = z.object({
  roomId: z.string().min(1, 'Choose where you need help'),
  residentId: z.string().optional(),
  note: z.string().trim().max(500, 'Keep the note under 500 characters').optional(),
});
export type SosRequest = z.infer<typeof sosRequestSchema>;

export const resolveRequestSchema = z.object({
  outcome: z.string().trim().min(1, 'Choose an outcome'),
  responseSummary: z.string().trim().max(1000).optional(),
});
export type ResolveRequest = z.infer<typeof resolveRequestSchema>;

export const addNoteRequestSchema = z.object({
  body: z.string().trim().min(1, 'Write a note first').max(1000, 'Keep notes under 1000 characters'),
});
export type AddNoteRequest = z.infer<typeof addNoteRequestSchema>;

export const cameraStatusSchema = z.enum(['online', 'offline', 'error', 'paused', 'connecting']);
export type CameraStatus = z.infer<typeof cameraStatusSchema>;

export const cameraSchema = z.object({
  id: z.string(),
  code: z.string(),
  roomId: z.string().nullable(),
  roomName: z.string().nullable(),
  roomWing: z.string().nullable(),
  /** e.g. "1080p · 15 FPS" */
  resolutionFps: z.string().nullable(),
  /**
   * Browser-playable live stream (e.g. an MP4/HLS/WebRTC gateway URL from the backend).
   * Null until the backend provides one; the UI then shows a placeholder.
   */
  liveUrl: z.string().nullable(),
  /** How to show liveUrl: "mjpeg" in an <img> tag, "video" in a <video> tag. Null when there is no liveUrl. */
  liveFormat: z.enum(['mjpeg', 'video']).nullable(),
  status: cameraStatusSchema,
  detectionEnabled: z.boolean(),
  lastSeenAt: isoDateTime.nullable(),
});
export type Camera = z.infer<typeof cameraSchema>;

export const residentSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  age: z.number().int().nullable(),
  fallRisk: fallRiskSchema,
  room: roomRefSchema.nullable(),
  caregivers: z.array(personRefSchema),
  /** True while the resident is involved in an open alert. */
  hasActiveAlert: z.boolean(),
  /** When the resident's latest incident was detected (only incidents the caller may see). */
  lastIncidentAt: isoDateTime.nullable(),
});
export type Resident = z.infer<typeof residentSchema>;

export const sexSchema = z.enum(['female', 'male']);
export type Sex = z.infer<typeof sexSchema>;

export const emergencyContactSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  relationship: z.string().nullable(),
  phone: z.string(),
});
export type EmergencyContact = z.infer<typeof emergencyContactSchema>;

/** One resident's profile (RES-03). */
export const residentDetailSchema = residentSchema.extend({
  sex: sexSchema.nullable(),
  birthDate: z.iso.date().nullable(),
  /** e.g. "Walker", "Wheelchair". Null when none. */
  mobilityAid: z.string().nullable(),
  careNotes: z.string().nullable(),
  emergencyContacts: z.array(emergencyContactSchema),
});
export type ResidentDetail = z.infer<typeof residentDetailSchema>;

export const dashboardSummarySchema = z.object({
  facilityName: z.string(),
  activeAlerts: z.object({ total: z.number().int(), new: z.number().int(), acknowledged: z.number().int() }),
  incidentsToday: z.object({
    total: z.number().int(),
    confirmed: z.number().int(),
    falseAlarms: z.number().int(),
  }),
  cameras: z.object({
    online: z.number().int(),
    total: z.number().int(),
    offline: z.number().int(),
    paused: z.number().int(),
    error: z.number().int(),
  }),
  residentsMonitored: z.number().int(),
  /** 0..1 over the last 7 days. Null when there were no alerts. */
  falseAlarmRate7d: z.number().min(0).max(1).nullable(),
  /** Average seconds from detection to acknowledgement. Null when nothing was acknowledged. */
  avgAckSeconds: z.number().nonnegative().nullable(),
  /** Falls per day for the last 7 days, oldest first. */
  fallsThisWeek: z.array(z.object({ date: z.iso.date(), count: z.number().int() })),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const activityEntrySchema = z.object({
  id: z.string(),
  user: personRefSchema,
  summary: z.string(),
  createdAt: isoDateTime,
});
export type ActivityEntry = z.infer<typeof activityEntrySchema>;

// ---------- rooms and areas (ROOM, Admin/Head only) ----------

/** ROOM-02 Add / edit room. Two wings may each have a "Room 101", but one wing can't have it twice. */
export const roomFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80, 'Use at most 80 characters'),
  wing: z
    .string()
    .trim()
    .max(80, 'Use at most 80 characters')
    .transform((v) => (v === '' ? null : v)),
});
export type RoomForm = z.input<typeof roomFormSchema>;

/** What POST /rooms and PATCH /rooms/{id} receive. */
export const roomRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  wing: z.string().trim().min(1).max(80).nullable(),
});
export type RoomRequest = z.infer<typeof roomRequestSchema>;

// ---------- camera setup (CAM, Admin/Head only) ----------

export const cameraPlaceSchema = z.enum(['room', 'bathroom']);
export type CameraPlace = z.infer<typeof cameraPlaceSchema>;
/** "person" blurs people, "whole" blurs the whole picture. Bathrooms always use "whole". */
export const privacyBlurSchema = z.enum(['off', 'person', 'whole']);
export type PrivacyBlur = z.infer<typeof privacyBlurSchema>;

/** A camera's setup as the Admin/Head edits it. `source` can hold a password, so only admins get it. */
export const cameraSettingsSchema = z.object({
  id: z.string(),
  code: z.string(),
  /** An rtsp:// or http(s):// stream link, or a device number such as "0" for a USB camera. */
  source: z.string(),
  roomId: z.string().nullable(),
  place: cameraPlaceSchema,
  privacyBlur: privacyBlurSchema,
  detectionEnabled: z.boolean(),
});
export type CameraSettings = z.infer<typeof cameraSettingsSchema>;

/** CAM-02 Register camera and CAM-04 Edit camera. */
export const cameraFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'Enter a name, e.g. CAM-12')
      .max(40, 'Use at most 40 characters')
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
        'Use letters, numbers, dots, dashes and underscores (no spaces)',
      ),
    source: z.string().trim().min(1, 'Enter the stream link or device number').max(500),
    roomId: z.string().transform((v) => (v === '' ? null : v)),
    place: cameraPlaceSchema,
    privacyBlur: privacyBlurSchema,
    detectionEnabled: z.boolean(),
  })
  // A bathroom camera always blurs the whole picture (same rule as the backend).
  .transform((v) => (v.place === 'bathroom' ? { ...v, privacyBlur: 'whole' as const } : v));
export type CameraForm = z.input<typeof cameraFormSchema>;

/** What POST /cameras and PATCH /cameras/{id} receive. */
export const cameraRequestSchema = z.object({
  code: z.string().trim().min(1).max(40),
  source: z.string().trim().min(1).max(500),
  roomId: z.string().nullable(),
  place: cameraPlaceSchema,
  privacyBlur: privacyBlurSchema,
  detectionEnabled: z.boolean(),
});
export type CameraRequest = z.infer<typeof cameraRequestSchema>;

/** POST /cameras/test: one picture was read from the source. */
export const cameraTestResultSchema = z.object({ width: z.number().int(), height: z.number().int() });
export type CameraTestResult = z.infer<typeof cameraTestResultSchema>;

// ---------- staff accounts (USR, Admin/Head only) ----------

/** A staff account as the Users & Access screens show it. */
export const staffMemberSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  username: z.string(),
  /** Optional: staff can log in with their username. */
  email: z.email().nullable(),
  role: roleSchema,
  /** "Admin/Head" or "Caregiver". */
  title: z.string(),
  isActive: z.boolean(),
  /** True until the person replaces their temporary password. */
  mustChangePassword: z.boolean(),
  /** Rooms and areas a caregiver monitors. Always empty for the Admin/Head (sees everything). */
  areas: z.array(roomRefSchema),
  /** Null when the person has never logged in (or the server does not record it). */
  lastLoginAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});
export type StaffMember = z.infer<typeof staffMemberSchema>;

/** Returned once, when an account is created or its password is reset (USR-03, USR-08). */
export const staffWithPasswordSchema = z.object({
  user: staffMemberSchema,
  temporaryPassword: z.string().min(1),
});
export type StaffWithPassword = z.infer<typeof staffWithPasswordSchema>;

/** Usernames are what people type to log in, so keep them simple. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

const staffFields = {
  fullName: z.string().trim().min(1, 'Enter the full name').max(120, 'Use at most 120 characters'),
  email: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || z.email().safeParse(v).success,
      'Enter a valid email address, or leave it empty',
    )
    .transform((v) => (v === '' ? null : v.toLowerCase())),
  role: roleSchema,
  /** Ignored for the Admin/Head. */
  areaIds: z.array(z.string()),
};

/** USR-02 Create user form. */
export const createStaffFormSchema = z.object({
  ...staffFields,
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Use at least 3 characters')
    .max(40, 'Use at most 40 characters')
    .regex(USERNAME_PATTERN, 'Use only lowercase letters, numbers, dots, dashes and underscores'),
});
export type CreateStaffForm = z.input<typeof createStaffFormSchema>;

/** USR-05 Edit user form. The username can't be changed. */
export const updateStaffFormSchema = z.object(staffFields);
export type UpdateStaffForm = z.input<typeof updateStaffFormSchema>;

/** What POST /users and PATCH /users/{id} receive (the forms above produce exactly this). */
const staffRequestFields = {
  fullName: z.string().trim().min(1).max(120),
  email: z.email().nullable(),
  role: roleSchema,
  areaIds: z.array(z.string()),
};
export const createStaffRequestSchema = z.object({
  ...staffRequestFields,
  username: z.string().min(3).max(40).regex(USERNAME_PATTERN),
});
export type CreateStaffRequest = z.infer<typeof createStaffRequestSchema>;
export const updateStaffRequestSchema = z.object(staffRequestFields);
export type UpdateStaffRequest = z.infer<typeof updateStaffRequestSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

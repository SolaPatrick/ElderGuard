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

export const userSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  username: z.string(),
  email: z.email(),
  role: roleSchema,
  /** Job title shown under the name, e.g. "Admin/Head" or "Caregiver". */
  title: z.string(),
  mustChangePassword: z.boolean(),
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
  room: z.object({ id: z.string(), name: z.string(), wing: z.string().nullable() }),
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
  roomName: z.string().nullable(),
  status: cameraStatusSchema,
  detectionEnabled: z.boolean(),
  lastSeenAt: isoDateTime.nullable(),
});
export type Camera = z.infer<typeof cameraSchema>;

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

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

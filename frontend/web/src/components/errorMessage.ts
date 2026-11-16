import { ApiError } from '../api/client';

/** A message that is safe and useful to show to staff. */
export function errorMessage(error: unknown): string {
  if (isMaintenance(error)) return MAINTENANCE_MESSAGE;
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Try again.';
}

/** HTTP 503: the server (or the proxy in front of it) says it is down for maintenance. */
export function isMaintenance(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503;
}

export const MAINTENANCE_MESSAGE =
  'ElderGuard is under maintenance and will be back shortly. Do in-person rounds until it is back.';

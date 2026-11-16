import { ApiError } from './api';

/** A message that is safe and useful to show to staff. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Try again.';
}

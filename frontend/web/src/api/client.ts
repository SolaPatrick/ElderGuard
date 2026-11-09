import { apiErrorSchema } from '@elderguard/shared';
import type { z } from 'zod';
import { API_BASE_URL } from './config';
import { tokenStorage } from '../auth/tokenStorage';

/** Any failed API call. `status` 0 means the server could not be reached. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Called when the backend says the session is no longer valid (HTTP 401). */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the "session expired" handling, e.g. for the login request itself. */
  skipAuthRedirect?: boolean;
}

/**
 * Calls the backend and validates the JSON response with a zod schema.
 * Throws ApiError for network errors, HTTP errors and unexpected response shapes.
 */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.infer<S>> {
  const { method = 'GET', body, signal, skipAuthRedirect = false } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tokenStorage.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? null : JSON.stringify(body),
      signal: signal ?? null,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'Cannot reach the ElderGuard server. Check your connection.');
  }

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !skipAuthRedirect) unauthorizedListeners.forEach((l) => l());
    const parsed = apiErrorSchema.safeParse(json);
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.code : `http_${response.status}`,
      parsed.success ? parsed.data.message : `Request failed (${response.status}).`,
    );
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    // Shows exactly which field the backend sent differently. Very useful when wiring the real backend.
    console.error(`[api] Unexpected response from ${method} ${path}`, result.error.issues, json);
    throw new ApiError(response.status, 'invalid_response', 'The server sent an unexpected response.');
  }
  return result.data;
}

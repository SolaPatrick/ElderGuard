import type { z } from 'zod';
import { apiErrorSchema } from '../schemas';

/**
 * Where the backend is and how to read the login token. The web app and the mobile app each
 * call configureApi once at start-up; everything else in this folder works the same on both.
 */
export interface ApiConfig {
  /** e.g. "/api" (web, behind the dev proxy) or "http://192.168.1.20:8000/api" (phone). No trailing slash. */
  baseUrl: string;
  getToken: () => string | null;
}

let config: ApiConfig = { baseUrl: '/api', getToken: () => null };

export function configureApi(next: ApiConfig): void {
  config = { ...next, baseUrl: next.baseUrl.replace(/\/+$/, '') };
}

export function apiConfig(): Readonly<ApiConfig> {
  return config;
}

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

/**
 * FastAPI-style errors: { "detail": "Alert not found." } or, for invalid input,
 * { "detail": [{ "msg": "Field required", ... }] }.
 */
function detailMessage(json: unknown): string | null {
  if (typeof json !== 'object' || json === null || !('detail' in json)) return null;
  const { detail } = json;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const first: unknown = detail[0];
    if (typeof first === 'object' && first !== null && 'msg' in first && typeof first.msg === 'string') {
      return first.msg.replace(/^Value error, /, '');
    }
  }
  return null;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send as an HTML form (application/x-www-form-urlencoded) instead of JSON. */
  form?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip the "session expired" handling, e.g. for the login request itself. */
  skipAuthRedirect?: boolean;
}

/** Sends the request with the login token. Throws ApiError for network and HTTP errors. */
async function send(path: string, options: RequestOptions, accept: string): Promise<Response> {
  const { method = 'GET', body, form, signal, skipAuthRedirect = false } = options;
  const headers: Record<string, string> = { Accept: accept };
  const token = config.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (form !== undefined) headers['Content-Type'] = 'application/x-www-form-urlencoded';

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body:
        form !== undefined
          ? new URLSearchParams(form).toString()
          : body === undefined
            ? null
            : JSON.stringify(body),
      signal: signal ?? null,
    });
  } catch (err) {
    // Check the name only: React Native has no global DOMException.
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'Cannot reach the ElderGuard server. Check your connection.');
  }

  if (!response.ok) {
    const json = parseJson(await response.text());
    if (response.status === 401 && !skipAuthRedirect) unauthorizedListeners.forEach((l) => l());
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) throw new ApiError(response.status, parsed.data.code, parsed.data.message);
    throw new ApiError(
      response.status,
      `http_${response.status}`,
      detailMessage(json) ?? `Request failed (${response.status}).`,
    );
  }
  return response;
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Downloads a file, such as a camera picture, with the login token. */
export async function apiBlob(path: string, options: Pick<RequestOptions, 'signal'> = {}): Promise<Blob> {
  const response = await send(path, options, '*/*');
  return response.blob();
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
  const { method = 'GET' } = options;
  const response = await send(path, options, 'application/json');
  const json = parseJson(await response.text());

  const result = schema.safeParse(json);
  if (!result.success) {
    // Shows exactly which field the backend sent differently. Very useful when wiring the real backend.
    console.error(`[api] Unexpected response from ${method} ${path}`, result.error.issues, json);
    throw new ApiError(response.status, 'invalid_response', 'The server sent an unexpected response.');
  }
  return result.data;
}

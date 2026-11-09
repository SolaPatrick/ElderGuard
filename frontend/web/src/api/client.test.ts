import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { server } from '../mocks/node';
import { ApiError, apiRequest, onUnauthorized } from './client';

describe('apiRequest', () => {
  it('returns validated data', async () => {
    server.use(http.get('/api/thing', () => HttpResponse.json({ name: 'CAM-01' })));
    await expect(apiRequest('/thing', z.object({ name: z.string() }))).resolves.toEqual({ name: 'CAM-01' });
  });

  it('rejects responses that do not match the contract instead of passing bad data to the UI', async () => {
    server.use(http.get('/api/thing', () => HttpResponse.json({ name: 42 })));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(apiRequest('/thing', z.object({ name: z.string() }))).rejects.toMatchObject({
      code: 'invalid_response',
    });
    spy.mockRestore();
  });

  it('uses the server error message when there is one', async () => {
    server.use(
      http.get('/api/thing', () =>
        HttpResponse.json({ code: 'not_found', message: 'Nope' }, { status: 404 }),
      ),
    );
    const err = await apiRequest('/thing', z.unknown()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: 'not_found', message: 'Nope' });
  });

  it('turns network failures into a friendly error', async () => {
    server.use(http.get('/api/thing', () => HttpResponse.error()));
    await expect(apiRequest('/thing', z.unknown())).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    });
  });

  it('reports 401 so the app can end the session', async () => {
    server.use(
      http.get('/api/thing', () =>
        HttpResponse.json({ code: 'unauthorized', message: 'x' }, { status: 401 }),
      ),
    );
    const listener = vi.fn();
    const stop = onUnauthorized(listener);
    await apiRequest('/thing', z.unknown()).catch(() => undefined);
    stop();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

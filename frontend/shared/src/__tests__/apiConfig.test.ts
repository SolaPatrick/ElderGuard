import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiRequest, configureApi } from '../api';

afterEach(() => {
  vi.unstubAllGlobals();
  configureApi({ baseUrl: '/api', getToken: () => null });
});

describe('configureApi (shared by web and mobile)', () => {
  it('sends requests to the configured server with the current token', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    let token: string | null = 'first';
    configureApi({ baseUrl: 'http://192.168.1.20:8000/api/', getToken: () => token });

    await apiRequest('/auth/me', z.object({ ok: z.boolean() }));
    token = 'second';
    await apiRequest('/auth/me', z.object({ ok: z.boolean() }));

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const auth = (n: number) => (calls[n]![1].headers as Record<string, string>).Authorization;
    expect(calls[0]![0]).toBe('http://192.168.1.20:8000/api/auth/me');
    expect(auth(0)).toBe('Bearer first');
    expect(auth(1)).toBe('Bearer second');
  });

  it('sends form logins as url-encoded text', async () => {
    const fetchMock = vi.fn(async () => new Response('null', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/auth/login', z.null(), {
      method: 'POST',
      form: { username: 'joel', password: 'a b&c' },
    });
    const init = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0]?.[1];
    expect(init?.body).toBe('username=joel&password=a+b%26c');
  });

  it('reports an unreachable server as status 0, and passes cancellations through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Network request failed'))),
    );
    await expect(apiRequest('/auth/me', z.null())).rejects.toMatchObject({ status: 0 });

    const abort = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(abort)),
    );
    const err: unknown = await apiRequest('/auth/me', z.null()).catch((e: unknown) => e);
    expect(err).toBe(abort);
    expect(err).not.toBeInstanceOf(ApiError);
  });
});

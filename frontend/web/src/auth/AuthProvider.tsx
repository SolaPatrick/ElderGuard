import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, User } from '@elderguard/shared';
import { AuthContext, type AuthState } from './authContext';
import { api } from '../api/endpoints';
import { ApiError, onUnauthorized } from '../api/client';
import { tokenExpiresAt } from './sessionExpiry';
import { tokenStorage } from './tokenStorage';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    tokenStorage.get() ? { status: 'loading', user: null } : { status: 'anonymous', user: null },
  );

  // Restore the session on page load.
  useEffect(() => {
    if (state.status !== 'loading') return;
    const controller = new AbortController();
    api
      .me(controller.signal)
      .then((user) => setState({ status: 'authenticated', user }))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Only the server saying "not valid" ends the session. A server that is down or
        // unreachable must not log anyone out: they would stop getting alerts once it is back.
        if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
          const message =
            err.status === 0 ? err.message : `The ElderGuard server is not answering (error ${err.status}).`;
          setState({ status: 'unreachable', user: null, message, maintenance: err.status === 503 });
          return;
        }
        tokenStorage.clear();
        setState({ status: 'anonymous', user: null, reason: 'expired' });
      });
    return () => controller.abort();
  }, [state.status]);

  // Any 401 from the API ends the session.
  useEffect(
    () =>
      onUnauthorized(() => {
        tokenStorage.clear();
        queryClient.clear();
        setState({ status: 'anonymous', user: null, reason: 'expired' });
      }),
    [queryClient],
  );

  const login = useCallback(async (credentials: LoginRequest, remember: boolean) => {
    const { token, user } = await api.login(credentials);
    tokenStorage.set(token, remember);
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Logging out locally matters more than telling the server.
    }
    tokenStorage.clear();
    queryClient.clear();
    setState({ status: 'anonymous', user: null, reason: 'logged_out' });
  }, [queryClient]);

  const replaceSession = useCallback((token: string, user: User) => {
    tokenStorage.replace(token);
    setState({ status: 'authenticated', user });
  }, []);

  const updateCurrentUser = useCallback((user: User) => {
    setState((s) =>
      s.status === 'authenticated' && s.user.id === user.id ? { status: 'authenticated', user } : s,
    );
  }, []);

  const retry = useCallback(() => {
    setState((s) => (s.status === 'unreachable' ? { status: 'loading', user: null } : s));
  }, []);

  // Read again whenever the session changes (login, password change).
  const expiresAt = useMemo(
    () => (state.status === 'authenticated' ? tokenExpiresAt(tokenStorage.get()) : null),
    [state],
  );

  const value = useMemo(
    () => ({ state, login, logout, replaceSession, updateCurrentUser, retry, expiresAt }),
    [state, login, logout, replaceSession, updateCurrentUser, retry, expiresAt],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

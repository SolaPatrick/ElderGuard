import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, User } from '@elderguard/shared';
import { AuthContext, type AuthState } from './authContext';
import { api } from '../api/endpoints';
import { onUnauthorized } from '../api/client';
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
        if (err instanceof DOMException && err.name === 'AbortError') return;
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

  const value = useMemo(
    () => ({ state, login, logout, replaceSession }),
    [state, login, logout, replaceSession],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

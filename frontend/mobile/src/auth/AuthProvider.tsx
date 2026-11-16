import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, User } from '@elderguard/shared';
import { AuthContext, type AuthState } from './authContext';
import { ApiError, api, onUnauthorized } from '../api';
import { tokenStore } from './tokenStore';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // Restore the saved session when the app starts.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const token = await tokenStore.load();
      if (!token) return { status: 'anonymous' } as const;
      try {
        return { status: 'authenticated', user: await api.me() } as const;
      } catch (err) {
        // No signal is not a reason to sign someone out: they would stop getting alerts.
        if (err instanceof ApiError && err.status === 0) {
          return { status: 'unreachable', message: err.message } as const;
        }
        await tokenStore.clear();
        return { status: 'anonymous', reason: 'expired' } as const;
      }
    };
    void restore().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Any 401 from the API ends the session (M-34).
  useEffect(
    () =>
      onUnauthorized(() => {
        void tokenStore.clear();
        queryClient.clear();
        setState({ status: 'anonymous', reason: 'expired' });
      }),
    [queryClient],
  );

  const login = useCallback(async (credentials: LoginRequest) => {
    const { token, user } = await api.login(credentials);
    await tokenStore.set(token);
    setState({ status: 'authenticated', user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Signing out on the phone matters more than telling the server.
    }
    await tokenStore.clear();
    queryClient.clear();
    setState({ status: 'anonymous', reason: 'logged_out' });
  }, [queryClient]);

  const replaceSession = useCallback(async (token: string, user: User) => {
    await tokenStore.set(token);
    setState({ status: 'authenticated', user });
  }, []);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({ state, login, logout, replaceSession, retry }),
    [state, login, logout, replaceSession, retry],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

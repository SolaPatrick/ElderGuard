import { createContext, use } from 'react';
import type { LoginRequest, User } from '@elderguard/shared';

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null; reason?: 'expired' | 'logged_out' }
  | { status: 'authenticated'; user: User };

export interface AuthContextValue {
  state: AuthState;
  login: (credentials: LoginRequest, remember: boolean) => Promise<User>;
  logout: () => Promise<void>;
  /** After a password change the server issues a new token for the same user. */
  replaceSession: (token: string, user: User) => void;
  /** After an Admin/Head edits their own account, so the name and title update everywhere. */
  updateCurrentUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The signed-in user. Only call inside routes wrapped by <RequireAuth>. */
export function useCurrentUser(): User {
  const { state } = useAuth();
  if (state.status !== 'authenticated') throw new Error('useCurrentUser called without a signed-in user');
  return state.user;
}

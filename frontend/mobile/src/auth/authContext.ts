import { createContext, use } from 'react';
import type { LoginRequest, User } from '@elderguard/shared';

/** Why the user is on the login screen. "expired" shows M-34's notice. */
export type SignedOutReason = 'expired' | 'logged_out';

export type AuthState =
  | { status: 'loading' }
  /** A token is saved but the server could not be reached to check it. */
  | { status: 'unreachable'; message: string }
  | { status: 'anonymous'; reason?: SignedOutReason }
  | { status: 'authenticated'; user: User };

export interface AuthValue {
  state: AuthState;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** After a password change the server sends a new token and the updated user. */
  replaceSession: (token: string, user: User) => Promise<void>;
  /** Try the saved session again after "unreachable". */
  retry: () => void;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** The signed-in user. Only for screens behind the sign-in guard. */
export function useCurrentUser(): User {
  const { state } = useAuth();
  if (state.status !== 'authenticated') throw new Error('No signed-in user');
  return state.user;
}

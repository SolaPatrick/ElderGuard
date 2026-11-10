const KEY = 'elderguard.token';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback; // storage can be blocked (private mode, strict settings)
  }
}

/**
 * "Remember me" keeps the token in localStorage (survives closing the browser);
 * otherwise sessionStorage (cleared when the tab closes).
 */
export const tokenStorage = {
  get(): string | null {
    return safe(() => sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY), null);
  },
  set(token: string, remember: boolean): void {
    safe(() => {
      this.clear();
      (remember ? localStorage : sessionStorage).setItem(KEY, token);
    }, undefined);
  },
  /** Swaps the token (e.g. after a password change) and keeps the "remember me" choice. */
  replace(token: string): void {
    const remembered = safe(() => localStorage.getItem(KEY) !== null, false);
    this.set(token, remembered);
  },
  clear(): void {
    safe(() => {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
    }, undefined);
  },
};

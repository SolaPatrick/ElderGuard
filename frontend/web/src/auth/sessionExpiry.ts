/**
 * When a login token stops working, in milliseconds since 1970, or null when unknown.
 *
 * Den's backend sends a JWT whose payload has `exp` (seconds). The fake server's tokens
 * look like `mock-token:<userId>` or `mock-token:<userId>:<expiresAtMs>`.
 * Only the time is read here; the server still decides whether a token is valid.
 */
export function tokenExpiresAt(token: string | null): number | null {
  if (!token) return null;
  if (token.startsWith('mock-token:')) {
    const ms = Number(token.split(':')[2]);
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  }
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(
      payload
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(payload.length / 4) * 4, '='),
    );
    const exp: unknown = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Auth.js cookie names.
 *
 * Kept in a dependency-free module so `src/proxy.ts` (which must stay light and
 * cannot import the database layer) and `src/lib/auth/config.ts` derive the
 * cookie name from exactly one place. `getToken()` uses the same rule: the
 * `__Secure-` prefix is applied when the configured URL is HTTPS or when the
 * deployment reports Vercel.
 */

export const ADMIN_SESSION_COOKIE = "next-auth.session-token";
export const ADMIN_SECURE_SESSION_COOKIE = "__Secure-next-auth.session-token";

export function isSecureCookieContext(): boolean {
  const url = process.env.NEXTAUTH_URL;

  return Boolean(process.env.VERCEL) || (typeof url === "string" && url.startsWith("https://"));
}

export function sessionCookieName(): string {
  return isSecureCookieContext() ? ADMIN_SECURE_SESSION_COOKIE : ADMIN_SESSION_COOKIE;
}

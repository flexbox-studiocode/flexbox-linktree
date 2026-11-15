import "server-only";

import { findAdminById } from "@/features/auth/repositories/admin-user";
import type { AdminSession } from "@/features/auth/types/admin";

/**
 * Server-side authorization.
 *
 * Rule: authentication is *not* authorization. A valid, signed session cookie
 * only proves that someone presented correct credentials at some point. Every
 * protected read and every mutation therefore re-reads the administrator row and
 * re-checks:
 *
 *   1. the account still exists,
 *   2. `status === "ACTIVE"` (SUSPENDED/DISABLED/INVITED are rejected),
 *   3. `role === "SUPER_ADMIN"` for privileged operations,
 *   4. `authVersion` equals the value embedded in the session token, so a
 *      password change or an explicit revocation invalidates old tokens.
 *
 * `src/proxy.ts` performs the same shape of check but only as an early redirect
 * for a better user experience. It is not a security boundary: server actions
 * are POSTs to their own page route, so a matcher can silently miss them.
 */

export class AuthorizationError extends Error {
  readonly reason: "unauthenticated" | "unauthorized" | "inactive";

  constructor(reason: "unauthenticated" | "unauthorized" | "inactive") {
    super(`Authorization failed: ${reason}`);
    this.name = "AuthorizationError";
    this.reason = reason;
  }
}

/** Shape of the token claims this module trusts. Everything else is ignored. */
export type SessionClaims = {
  sub?: string | null;
  av?: number | null;
};

export type AuthorizedAdmin = AdminSession & { authVersion: number };

/** Converts an identity row into the browser-safe session DTO. */
export function toAdminSession(identity: {
  id: string;
  email: string;
  fullName: string;
  role: "SUPER_ADMIN";
}): AdminSession {
  return {
    id: identity.id,
    email: identity.email,
    name: identity.fullName,
    role: "SUPER_ADMIN",
    isSuperAdmin: true,
  };
}

/**
 * Resolves the claims into an authorized administrator.
 *
 * Returns `null` for every negative outcome; callers decide whether to redirect
 * or to return a 401/403. Nothing about the account exists for a caller that is
 * not fully authorized.
 */
export async function resolveAuthorizedAdmin(
  claims: SessionClaims | null | undefined,
): Promise<AuthorizedAdmin | null> {
  const adminId = claims?.sub;

  if (!adminId || typeof adminId !== "string") {
    return null;
  }

  if (typeof claims?.av !== "number") {
    return null;
  }

  const identity = await findAdminById(adminId);

  if (!identity) {
    return null;
  }

  if (identity.status !== "ACTIVE") {
    return null;
  }

  // Session generation mismatch means the token predates a revocation.
  if (identity.authVersion !== claims.av) {
    return null;
  }

  if (identity.role !== "SUPER_ADMIN") {
    return null;
  }

  return { ...toAdminSession(identity), authVersion: identity.authVersion };
}

/** True when the claims identify an ACTIVE SUPER_ADMIN of the current session generation. */
export async function assertAdminActive(claims: SessionClaims | null | undefined): Promise<boolean> {
  return (await resolveAuthorizedAdmin(claims)) !== null;
}

/** Throws `AuthorizationError` unless the claims identify an ACTIVE SUPER_ADMIN. */
export async function assertSuperAdmin(claims: SessionClaims | null | undefined): Promise<AuthorizedAdmin> {
  const admin = await resolveAuthorizedAdmin(claims);

  if (!admin) {
    throw new AuthorizationError("unauthorized");
  }

  return admin;
}

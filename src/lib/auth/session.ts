import "server-only";

import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  AuthorizationError,
  resolveAuthorizedAdmin,
  type AuthorizedAdmin,
  type SessionClaims,
} from "@/features/auth/services/authorization";
import { authOptions } from "@/lib/auth/config";
import { sessionCookieName } from "@/lib/auth/cookies";

/**
 * Request-scoped accessors used by server components, server actions, and route
 * handlers.
 *
 * `readSessionClaims()` reads and verifies the signed JWT *without* trusting its
 * contents: the returned claims are only an identifier plus a revocation
 * counter, and `resolveAuthorizedAdmin()` re-derives rights from the database.
 *
 * `getCurrentAdmin()` is memoised per request with React `cache()` so a page that
 * renders several guarded components performs one authorization read.
 */

/** Reads and verifies the Auth.js JWT for the current request. */
export async function readSessionClaims(): Promise<SessionClaims | null> {
  const secret = authOptions.secret;

  if (!secret) {
    return null;
  }

  const raw = (await cookies()).get(sessionCookieName())?.value;

  if (!raw) {
    return null;
  }

  const token = await decode({ token: raw, secret });

  if (!token) {
    return null;
  }

  return { sub: typeof token.sub === "string" ? token.sub : null, av: typeof token.av === "number" ? token.av : null };
}

/** Current authorized administrator, or `null` when not authenticated/authorized. */
export const getCurrentAdmin = cache(async (): Promise<AuthorizedAdmin | null> => {
  const claims = await readSessionClaims();

  return resolveAuthorizedAdmin(claims);
});

/**
 * Same as `getCurrentAdmin()` but redirects to the login page when the caller is
 * not an authorized administrator. Use it in server components and layouts.
 */
export async function requireAdmin(): Promise<AuthorizedAdmin> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  return admin;
}

/**
 * Privileged variant for actions that only a SUPER_ADMIN may perform. The
 * application currently has a single role, but privileged mutations must still
 * state their requirement explicitly so a future role can never inherit it by
 * accident.
 */
export async function requireSuperAdmin(): Promise<AuthorizedAdmin> {
  const admin = await requireAdmin();

  if (!admin.isSuperAdmin) {
    redirect("/admin");
  }

  return admin;
}

/**
 * Variant for server actions and route handlers: never redirects, throws
 * `AuthorizationError` instead so the caller can map it to a 401/403 response.
 */
export async function requireAdminAction(): Promise<AuthorizedAdmin> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    throw new AuthorizationError("unauthorized");
  }

  return admin;
}

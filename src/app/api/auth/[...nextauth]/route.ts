import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth/config";

/**
 * Auth.js route handler.
 *
 * Only the Credentials provider is registered, so the only usable endpoints are
 * `/api/auth/csrf`, `/api/auth/callback/admin-credentials`, `/api/auth/session`,
 * `/api/auth/signout`, and `/api/auth/providers`.
 *
 * Protections that do not come from this file:
 *   - The credentials callback requires a CSRF token issued by
 *     `/api/auth/csrf`, and the session cookie is `sameSite=lax`, so a
 *     cross-site form post cannot ride an existing session.
 *   - Authenticating here grants nothing by itself. Authorization is enforced
 *     again in `requireAdmin()`/`requireSuperAdmin()` for every protected read
 *     and mutation, and in `src/proxy.ts` only as an early redirect.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

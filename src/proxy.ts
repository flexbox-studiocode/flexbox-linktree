import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { sessionCookieName } from "@/lib/auth/cookies";

/**
 * Optimistic admin gateway.
 *
 * Next.js runs this file at the network boundary, before the request reaches a
 * route. It is deliberately NOT an authorization boundary:
 *
 *   - `getToken()` only proves that a JWT is correctly signed; it does not read
 *     the administrator row, so it cannot know whether the account is still
 *     ACTIVE or whether `authVersion` matches. That check is repeated in
 *     `requireAdmin()`/`requireSuperAdmin()` (which read the database) for
 *     every protected read and mutation.
 *   - Server Actions are POSTs to their own page route. A matcher that excludes
 *     a path also skips the Action on that path, so a matcher can silently miss
 *     them. This file exists only to redirect an unauthenticated visitor to the
 *     login page before a page render; it is never the sole protection.
 *
 * It runs in the Node.js runtime (Next.js 16 default) and imports nothing from
 * the database layer, keeping it light enough for an edge/CDN deployment.
 */

/**
 * Admin paths that must render for unauthenticated visitors.
 *
 * Kept as an explicit allowlist rather than a prefix check so a new protected
 * page is private by default: forgetting to add it here makes it redirect to the
 * login page instead of becoming public.
 */
const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
]);

function buildLoginRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL("/admin/login", request.url);

  if (request.nextUrl.pathname !== "/admin/login") {
    const target = sanitizeCallbackUrl(`${request.nextUrl.pathname}${request.nextUrl.search}`);

    if (target !== "/admin") {
      loginUrl.searchParams.set("callbackUrl", target);
    }
  }

  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest): Promise<Response> {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

  // No secret configured: nothing can be verified, so the admin area must not
  // render. Refuse closed rather than serving unauthenticated content.
  if (!secret) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const token = await getToken({
    req: request,
    secret,
    cookieName: sessionCookieName(),
    secureCookie: sessionCookieName().startsWith("__Secure"),
  });

  const isPublicAdminPage = PUBLIC_ADMIN_PATHS.has(request.nextUrl.pathname);
  const isAuthApi = request.nextUrl.pathname.startsWith("/api/auth/");

  const authenticated =
    token !== null &&
    typeof token.sub === "string" &&
    typeof token.av === "number" &&
    token.role === "SUPER_ADMIN";

  if (!authenticated) {
    if (isPublicAdminPage || isAuthApi) {
      return NextResponse.next();
    }

    return buildLoginRedirect(request);
  }

  // Signed-in administrators do not need the sign-in or recovery screens.
  if (isPublicAdminPage) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/auth/:path*"],
};

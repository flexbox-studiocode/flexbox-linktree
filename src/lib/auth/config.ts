import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { findAdminById } from "@/features/auth/repositories/admin-user";
import { GENERIC_LOGIN_ERROR } from "@/features/auth/schemas/login";
import { authenticateAdmin } from "@/features/auth/services/authenticate-admin";
import { isSecureCookieContext, sessionCookieName } from "@/lib/auth/cookies";
import { resolveSourceIdentifier } from "@/lib/security/client-source";

/**
 * Auth.js (v4) configuration for the administrator area.
 *
 * Design notes
 *
 * - Credentials provider + JWT strategy: the application never stores sessions
 *   in a database table. The JWT is a signed *authentication* artifact only; it
 *   carries `sub`, `role`, and `av` (the account's `authVersion`). Every
 *   protected server operation re-reads the account and compares `av`, so a
 *   suspended account, a password change, or a demotion invalidates existing
 *   tokens immediately (see `src/features/auth/services/authorization.ts`).
 * - `session.maxAge` is 8 hours. There is no remember-me option and no sliding
 *   expiry: an operator re-authenticates once per working day.
 * - The session object returned to the browser is rebuilt from a fresh database
 *   read in the `session` callback, so stale JWT claims are never trusted by the
 *   UI either.
 * - Error messages are collapsed into a single generic string to prevent account
 *   enumeration from the login form.
 */

/** Session lifetime in seconds (8 hours), documented in `.docs/AUTH_SECURITY.md`. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const authCookieConfig = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: isSecureCookieContext(),
};

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    // Explicit: the token does not refresh on every request, so a stolen cookie
    // cannot be extended indefinitely by continued use.
    updateAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: sessionCookieName(),
      options: authCookieConfig,
    },
    callbackUrl: {
      name: "next-auth.callback-url",
      options: { ...authCookieConfig, httpOnly: true },
    },
    csrfToken: {
      name: isSecureCookieContext() ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: { ...authCookieConfig, httpOnly: true },
    },
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  providers: [
    CredentialsProvider({
      id: "admin-credentials",
      name: "Administrator",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials.password) {
          // Same message for every failure: no enumeration signal.
          return null;
        }

        const requestHeaders = request?.headers;

        const admin = await authenticateAdmin({
          email: credentials.email,
          password: credentials.password,
          sourceIdentifier: requestHeaders ? resolveSourceIdentifier(new Headers(requestHeaders)) : null,
        });

        if (!admin) {
          return null;
        }

        const identity = await findAdminById(admin.id);

        if (!identity) {
          return null;
        }

        const user = {
          id: identity.id,
          email: identity.email,
          name: identity.fullName,
          role: identity.role as "SUPER_ADMIN",
          authVersion: identity.authVersion,
        };

        return user;
      },
    }),
  ],
  callbacks: {
    /**
     * Keeps the token minimal. Only `sub`, `role`, and `av` are added: the role
     * and the session generation are the two claims the authorization layer
     * must compare against the database.
     */
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.av = user.authVersion;
      }

      return token;
    },
    /**
     * Rebuilds the session DTO from the database rather than from JWT claims, so
     * a name change or a status change is reflected immediately and no
     * server-only field (hash, `authVersion`) leaks to the browser.
     */
    async session({ session, token }) {
      const adminId = token.sub;

      if (!adminId) {
        return session;
      }

      const identity = await findAdminById(adminId);

      if (!identity || identity.status !== "ACTIVE" || identity.authVersion !== token.av) {
        // Returning an empty-ish session marks the caller unauthenticated; the
        // authorization layer also re-checks independently.
        return { ...session, user: undefined, expires: session.expires };
      }

      return {
        ...session,
        user: {
          id: identity.id,
          email: identity.email,
          name: identity.fullName,
          role: identity.role,
          isSuperAdmin: identity.role === "SUPER_ADMIN",
        },
      };
    },
  },
  debug: false,
};

/** Re-exported for the login form so the message cannot drift from the service. */
export const LOGIN_FAILURE_MESSAGE = GENERIC_LOGIN_ERROR;

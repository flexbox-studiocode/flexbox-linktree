import type { DefaultSession } from "next-auth";

/**
 * Type augmentation for the administrator session.
 *
 * The JWT carries only `sub`, `role`, and `av`. `authVersion` is intentionally
 * absent from `Session` — it is a server-side revocation counter and must never
 * reach the browser.
 */
declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      email: string;
      name: string;
      role: "SUPER_ADMIN";
      isSuperAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: "SUPER_ADMIN";
    authVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "SUPER_ADMIN";
    /** Session generation copied from `AdminUser.authVersion` at sign-in. */
    av?: number;
  }
}

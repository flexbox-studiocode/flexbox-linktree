/**
 * Client-safe authentication copy.
 *
 * This module must stay dependency-free: both Server Components and Client
 * Components import it, so it cannot reference `server-only`, Prisma, or Zod.
 */

/** The single message shown for every rejected sign-in attempt. */
export const GENERIC_LOGIN_ERROR =
  "Email atau password tidak valid. Periksa kembali kredensial Anda.";
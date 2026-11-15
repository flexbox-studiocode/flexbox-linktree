import { z } from "zod";

import { adminEmailSchema } from "@/features/auth/schemas/identity";

/**
 * Login form contract.
 *
 * The schema validates shape only. Whether the account exists, is active, or
 * has the right role is decided on the server, and every failure is reported
 * with the same generic message so the login form cannot be used to enumerate
 * administrator accounts.
 */
export const loginSchema = z.object({
  email: adminEmailSchema,
  password: z
    .string("Password is required.")
    .min(1, "Password is required.")
    .max(256, "Password is too long."),
  callbackUrl: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** The single message shown for every rejected sign-in attempt. */
export const GENERIC_LOGIN_ERROR =
  "Email atau password tidak valid. Periksa kembali kredensial Anda.";

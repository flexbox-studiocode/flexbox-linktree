import { z } from "zod";

import { GENERIC_LOGIN_ERROR } from "@/features/auth/messages";

/**
 * Login form contract.
 *
 * The schema validates shape only. Whether the account exists, is active, or
 * has the right role is decided on the server, and every failure is reported
 * with the same generic message so the login form cannot be used to enumerate
 * administrator accounts.
 */
export const loginSchema = z.object({
  email: z
    .string("Email is required.")
    .trim()
    .min(1, "Email is required.")
    .max(254, "Email is too long."),
  password: z
    .string("Password is required.")
    .min(1, "Password is required.")
    .max(256, "Password is too long."),
  callbackUrl: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Re-exported from the client-safe module so server and client copy cannot drift. */
export { GENERIC_LOGIN_ERROR };
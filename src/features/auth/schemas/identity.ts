import "server-only";

import { z } from "zod";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/security/password-policy";

/**
 * Email normalization shared by authentication and provisioning.
 *
 * Auth.js does not enforce a particular normalization for the Credentials
 * provider, so the application must canonicalize input before lookup.
 * Zod 4 `z.email()` validates the shape; we then `trim()` and lower-case.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const adminEmailSchema = z
  .string("Email is required.")
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email is too long.");

export const adminPasswordSchema = z
  .string("Password is required.")
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`);

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(160, "Name is too long.");

/** Parses a candidate email into its normalized form. */
export function parseEmail(value: unknown): string {
  const result = adminEmailSchema.safeParse(value);

  if (!result.success) {
    throw new TypeError(result.error.issues.map((issue) => issue.message).join(" "));
  }

  return normalizeEmail(result.data);
}

/** Parses a plain-text password for provisioning/change forms. */
export function parsePassword(value: unknown): string {
  const result = adminPasswordSchema.safeParse(value);

  if (!result.success) {
    throw new TypeError(result.error.issues.map((issue) => issue.message).join(" "));
  }

  return result.data;
}

/** Parses a full name for provisioning. */
export function parseFullName(value: unknown): string {
  const result = fullNameSchema.safeParse(value);

  if (!result.success) {
    throw new TypeError(result.error.issues.map((issue) => issue.message).join(" "));
  }

  return result.data;
}

import "server-only";

import { findByNormalizedEmail, findAdminById, replaceAdminPassword } from "@/features/auth/repositories/admin-user";
import {
  consumeResetToken,
  createPasswordResetToken,
  findUsableResetToken,
  invalidateResetTokensForAdmin,
} from "@/features/auth/repositories/password-reset-token";
import { parseEmail } from "@/features/auth/schemas/identity";
import { recordSecurityEvent } from "@/features/auth/services/security-event";
import { checkSourceAllowed, recordSourceAttempt, sourceBucketKey } from "@/features/auth/services/rate-limit";
import { getAdminMailer, isAdminMailDisabled } from "@/lib/mail/admin-mailer";
import { checkPasswordPolicy, hashPassword } from "@/lib/security/password";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/security/tokens";

/**
 * Administrator password recovery.
 *
 * The request endpoint is intentionally non-enumerating: it returns the same
 * result whether or not the address belongs to an account, and a token is only
 * created for an ACTIVE account. Tokens are single-use and short-lived, only
 * their SHA-256 hash is stored, and issuing a new token invalidates older ones.
 *
 * Delivery goes through `src/lib/mail/admin-mailer.ts`. Until a real provider is
 * approved, that transport writes to `.local-storage/mail/` and refuses to run
 * in production, so a recovery link can never be silently discarded there.
 */

/** Reset links expire after 60 minutes, matching the documented policy. */
export const RESET_TOKEN_TTL_MINUTES = 60;

export const RESET_LINK_PATH = "/admin/reset-password";

export const INVALID_RESET_MESSAGE =
  "Tautan pengaturan ulang tidak valid, sudah digunakan, atau sudah kedaluwarsa.";

export type ResetRequestInput = {
  email: unknown;
  sourceIdentifier?: string | null;
  now?: Date;
};

export type ResetRequestOutcome =
  | { status: "accepted" }
  | { status: "disabled" }
  | { status: "throttled"; retryAfterSeconds: number };

/** Builds the absolute reset link. `NEXTAUTH_URL` is required for a usable URL. */
function buildResetLink(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "";

  return `${base.replace(/\/+$/, "")}${RESET_LINK_PATH}?token=${encodeURIComponent(token)}`;
}

export async function requestPasswordReset(
  input: ResetRequestInput,
  sourceBucketHash: string | null,
): Promise<ResetRequestOutcome> {
  const now = input.now ?? new Date();

  const allowed = await checkSourceAllowed({ sourceBucketKey: sourceBucketHash, now });

  if (!allowed.allowed) {
    return { status: "throttled", retryAfterSeconds: allowed.retryAfterSeconds };
  }

  await recordSourceAttempt({ sourceBucketKey: sourceBucketHash, now });

  // Keep recovery non-enumerating while making the disabled capability
  // explicit to the caller. No token or account lookup is performed.
  if (isAdminMailDisabled()) {
    return { status: "disabled" };
  }

  // Malformed input is treated exactly like an unknown address.
  let normalizedEmail: string | null = null;

  try {
    normalizedEmail = parseEmail(input.email);
  } catch {
    normalizedEmail = null;
  }

  if (!normalizedEmail) {
    return { status: "accepted" };
  }

  const admin = await findByNormalizedEmail(normalizedEmail);

  if (!admin || admin.status !== "ACTIVE") {
    // No token, no mail, but the same response. A security event lets an
    // operator distinguish the case without exposing it to the caller.
    await recordSecurityEvent({
      eventType: "PASSWORD_RESET_REQUESTED",
      adminUserId: admin?.id ?? null,
      targetType: "admin_user",
      targetId: admin?.id ?? null,
      metadata: { accountEmail: normalizedEmail, reason: "no_eligible_account" },
    });

    return { status: "accepted" };
  }

  // Older links for the same account stop working as soon as a new one is sent.
  await invalidateResetTokensForAdmin(admin.id, now);

  const token = generateOpaqueToken();
  const created = await createPasswordResetToken({
    adminUserId: admin.id,
    tokenHash: hashOpaqueToken(token),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1_000),
  });

  await recordSecurityEvent({
    eventType: "PASSWORD_RESET_REQUESTED",
    adminUserId: admin.id,
    targetType: "password_reset_token",
    targetId: created.id,
    metadata: { accountEmail: normalizedEmail },
  });

  try {
    const mailer = getAdminMailer();

    await mailer.send({
      to: admin.email,
      subject: "Reset your Flexbox Studio admin password",
      kind: "password_reset",
      body: [
        `Hello ${admin.fullName},`,
        "",
        "A password reset was requested for your administrator account.",
        `This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes and can be used once:`,
        "",
        buildResetLink(token),
        "",
        "If you did not request this, ignore this message. Your password is unchanged.",
      ].join("\n"),
    });
  } catch (error) {
    // Never reveal delivery problems to the caller, and never log the token.
    const detail = error instanceof Error ? error.name : "UnknownError";

    console.error(`[auth] password reset mail delivery failed (${detail})`);
  }

  return { status: "accepted" };
}

/** Derives the SOURCE bucket key for a recovery request from the client address. */
export function resetSourceBucket(sourceIdentifier: string | null): string | null {
  return sourceBucketKey({ sourceIdentifier }, process.env.RATE_LIMIT_SECRET);
}

export type ResetCompletionResult = { adminUserId: string; normalizedEmail: string };

/**
 * Applies a new password for a valid reset token.
 *
 * Order matters: the password is validated and hashed before the token is
 * claimed, and the claim is an atomic `UPDATE ... WHERE used_at IS NULL`, so a
 * replayed or concurrent submission cannot apply twice.
 */
export async function completePasswordReset(input: {
  token: unknown;
  newPassword: unknown;
  now?: Date;
}): Promise<ResetCompletionResult> {
  const now = input.now ?? new Date();

  if (typeof input.token !== "string" || input.token.trim().length === 0) {
    throw new ResetError("invalid_token", INVALID_RESET_MESSAGE);
  }

  const policyError = checkPasswordPolicy(input.newPassword);

  if (policyError) {
    throw new ResetError("invalid_password", policyError);
  }

  const password = input.newPassword as string;
  const tokenRow = await findUsableResetToken(hashOpaqueToken(input.token.trim()), now);

  if (!tokenRow) {
    throw new ResetError("invalid_token", INVALID_RESET_MESSAGE);
  }

  const admin = await findAdminById(tokenRow.adminUserId);

  if (!admin || admin.status !== "ACTIVE") {
    throw new ResetError("invalid_token", INVALID_RESET_MESSAGE);
  }

  const passwordHash = await hashPassword(password);

  if (!(await consumeResetToken({ tokenId: tokenRow.id, now }))) {
    throw new ResetError("invalid_token", INVALID_RESET_MESSAGE);
  }

  const updated = await replaceAdminPassword({ adminUserId: admin.id, passwordHash });

  await invalidateResetTokensForAdmin(admin.id, now);
  await recordSecurityEvent({
    eventType: "PASSWORD_RESET_COMPLETED",
    adminUserId: admin.id,
    targetType: "password_reset_token",
    targetId: tokenRow.id,
    metadata: { accountEmail: admin.normalizedEmail, authVersion: updated.authVersion },
  });

  return { adminUserId: admin.id, normalizedEmail: admin.normalizedEmail };
}

export type ResetErrorCode = "invalid_token" | "invalid_password";

export class ResetError extends Error {
  readonly code: ResetErrorCode;

  constructor(code: ResetErrorCode, message: string) {
    super(message);
    this.name = "ResetError";
    this.code = code;
  }
}

/** Convenience wrapper for callers that only have a raw address. */
export function normalizeResetEmail(email: unknown): string | null {
  try {
    return parseEmail(email);
  } catch {
    return null;
  }
}

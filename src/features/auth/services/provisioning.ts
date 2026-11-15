import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  activateAdminWithPassword,
  countActiveAdmins,
  countAdmins,
  createInvitedAdmin,
  findByNormalizedEmail,
} from "@/features/auth/repositories/admin-user";
import {
  claimInvitation,
  countPendingInvitationsForEmail,
  createInvitation,
  findPendingInvitationByTokenHash,
  revokeInvitation,
} from "@/features/auth/repositories/admin-invitation";
import { parseEmail, parseFullName, parsePassword } from "@/features/auth/schemas/identity";
import { recordSecurityEvent } from "@/features/auth/services/security-event";
import { checkPasswordPolicy, hashPassword } from "@/lib/security/password";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/security/tokens";

/**
 * Internal administrator provisioning.
 *
 * There is no public registration path. An account can only appear through one
 * of two controlled procedures:
 *
 *   1. `bootstrapFirstSuperAdmin()` — a CLI-only path that also requires
 *      `ADMIN_BOOTSTRAP_ENABLED=true`. It refuses to run once any administrator
 *      account exists, so it can never be used to re-open access later.
 *   2. `createInvitationForAdmin()` + `acceptInvitation()` — an active Super
 *      Admin issues a single-use, expiring invitation for an approved email.
 *
 * Invitation tokens are 256-bit random values. Only their SHA-256 hash is
 * stored; the raw token is returned once to the caller and is never logged.
 */

export type ProvisioningErrorCode =
  | "invalid_email"
  | "invalid_name"
  | "invalid_password"
  | "existing_account"
  | "invalid_or_expired_invitation"
  | "bootstrap_disabled"
  | "store_failure";

export class ProvisioningError extends Error {
  readonly code: ProvisioningErrorCode;

  constructor(code: ProvisioningErrorCode, message: string) {
    super(message);
    this.name = "ProvisioningError";
    this.code = code;
  }
}

/** Default invitation lifetime in hours, documented in `.docs/AUTH_SECURITY.md`. */
export const INVITATION_TTL_HOURS = 72;

export const INVALID_INVITATION_MESSAGE =
  "Undangan tidak valid, sudah digunakan, atau sudah kedaluwarsa.";

/** Maps a schema `TypeError` onto a provisioning error with a stable code. */
function parseOrThrow<T>(parse: () => T, code: ProvisioningErrorCode): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ProvisioningError(code, error.message);
    }

    throw error;
  }
}

export type BootstrapInput = {
  email: string;
  fullName: string;
  password: string;
};

export type BootstrapResult = {
  adminId: string;
  email: string;
  normalizedEmail: string;
  fullName: string;
};

/**
 * Creates the very first `ACTIVE` `SUPER_ADMIN` account.
 *
 * Guards, in order:
 *   - `ADMIN_BOOTSTRAP_ENABLED` must be exactly `"true"` (one-time gate).
 *   - No administrator row may exist yet. This is re-checked inside the same
 *     transaction that performs the insert, so two concurrent invocations
 *     cannot both create a first administrator.
 *   - Email and password are validated with the shared schemas.
 *
 * Never call this from an HTTP route. It is exposed only through
 * `src/features/auth/cli/bootstrap.ts`.
 */
export async function bootstrapFirstSuperAdmin(input: BootstrapInput): Promise<BootstrapResult> {
  if (process.env.ADMIN_BOOTSTRAP_ENABLED !== "true") {
    throw new ProvisioningError(
      "bootstrap_disabled",
      "Bootstrap is disabled. Set ADMIN_BOOTSTRAP_ENABLED=true for this single command only.",
    );
  }

  const normalizedEmail = parseOrThrow(() => parseEmail(input.email), "invalid_email");
  const fullName = parseOrThrow(() => parseFullName(input.fullName), "invalid_name");
  const password = parseOrThrow(() => parsePassword(input.password), "invalid_password");

  const passwordHash = await hashPassword(password);

  const created = await prisma.$transaction(async (tx) => {
    const insideCount = await tx.adminUser.count();

    if (insideCount > 0) {
      throw new ProvisioningError(
        "existing_account",
        "An administrator account already exists. Use the invitation workflow instead of bootstrap.",
      );
    }

    return tx.adminUser.create({
      data: {
        email: input.email.trim(),
        normalizedEmail,
        fullName,
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
        authVersion: 1,
      },
      select: { id: true, normalizedEmail: true },
    });
  });

  await recordSecurityEvent({
    eventType: "ACCOUNT_BOOTSTRAPPED",
    adminUserId: created.id,
    targetType: "admin_user",
    targetId: created.id,
    metadata: { accountEmail: created.normalizedEmail, nextStatus: "ACTIVE" },
  });

  return {
    adminId: created.id,
    email: input.email.trim(),
    normalizedEmail: created.normalizedEmail,
    fullName,
  };
}

export type CreateInvitationResult = {
  invitationId: string;
  /** Raw token. Returned exactly once; never persisted or logged. */
  token: string;
  expiresAt: Date;
  normalizedEmail: string;
  adminUserId: string;
};

/**
 * Issues a single-use invitation for an approved Flexbox member.
 *
 * The administrator record is created in the INVITED state immediately, so the
 * allowlist row exists before any credential does. Re-inviting an account that
 * is still INVITED issues a fresh token and revokes older pending tokens, which
 * bounds the number of live invitation links.
 */
export async function createInvitationForAdmin(input: {
  email: string;
  fullName: string;
  createdByAdminId?: string | null;
  now?: Date;
}): Promise<CreateInvitationResult> {
  const now = input.now ?? new Date();
  const normalizedEmail = parseOrThrow(() => parseEmail(input.email), "invalid_email");
  const fullName = parseOrThrow(() => parseFullName(input.fullName), "invalid_name");

  const existing = await findByNormalizedEmail(normalizedEmail);

  if (existing && existing.status !== "INVITED") {
    throw new ProvisioningError(
      "existing_account",
      "An account with this email already exists. Change its status instead of inviting it again.",
    );
  }

  const adminUser = existing
    ? await prisma.adminUser.update({
        where: { id: existing.id },
        data: { fullName, email: input.email.trim() },
        select: { id: true },
      })
    : await createInvitedAdmin({
        email: input.email.trim(),
        normalizedEmail,
        fullName,
        role: "SUPER_ADMIN",
      });

  // A new invitation supersedes older pending links for the same address.
  const pending = await countPendingInvitationsForEmail(normalizedEmail);

  if (pending > 0) {
    await prisma.adminInvitation.updateMany({
      where: { normalizedEmail, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  const token = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_HOURS * 60 * 60 * 1_000);

  const invitation = await createInvitation({
    email: input.email.trim(),
    normalizedEmail,
    tokenHash,
    role: "SUPER_ADMIN",
    expiresAt,
    createdByAdminId: input.createdByAdminId ?? null,
  });

  await recordSecurityEvent({
    eventType: "INVITATION_CREATED",
    adminUserId: input.createdByAdminId ?? null,
    targetType: "admin_invitation",
    targetId: invitation.id,
    metadata: {
      accountEmail: normalizedEmail,
      invitationId: invitation.id,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return {
    invitationId: invitation.id,
    token,
    expiresAt,
    normalizedEmail,
    adminUserId: adminUser.id,
  };
}

/**
 * Accepts an invitation and activates the account.
 *
 * Failure modes are deliberately indistinguishable to the caller so a guessed
 * token cannot reveal whether an invitation exists, was already used, was
 * revoked, or has expired.
 */
export async function acceptInvitation(input: {
  token: string;
  password: string;
  fullName?: string;
  now?: Date;
}): Promise<{ adminUserId: string; normalizedEmail: string }> {
  const now = input.now ?? new Date();

  if (typeof input.token !== "string" || input.token.trim().length === 0) {
    throw new ProvisioningError("invalid_or_expired_invitation", INVALID_INVITATION_MESSAGE);
  }

  const policyError = checkPasswordPolicy(input.password);

  if (policyError) {
    throw new ProvisioningError("invalid_password", policyError);
  }

  const password = input.password;
  const tokenHash = hashOpaqueToken(input.token.trim());
  const invitation = await findPendingInvitationByTokenHash(tokenHash);

  if (!invitation || invitation.expiresAt.getTime() <= now.getTime()) {
    throw new ProvisioningError("invalid_or_expired_invitation", INVALID_INVITATION_MESSAGE);
  }

  const adminUser = await findByNormalizedEmail(invitation.normalizedEmail);

  if (!adminUser || adminUser.status !== "INVITED") {
    throw new ProvisioningError("invalid_or_expired_invitation", INVALID_INVITATION_MESSAGE);
  }

  const passwordHash = await hashPassword(password);

  // Claim first so a replayed token cannot activate a second time.
  const claimed = await claimInvitation({
    invitationId: invitation.id,
    acceptedByAdminId: adminUser.id,
    now,
  });

  if (!claimed) {
    throw new ProvisioningError("invalid_or_expired_invitation", INVALID_INVITATION_MESSAGE);
  }

  const activated = await activateAdminWithPassword({
    adminUserId: adminUser.id,
    passwordHash,
    fullName: input.fullName
      ? parseOrThrow(() => parseFullName(input.fullName), "invalid_name")
      : undefined,
  });

  await recordSecurityEvent({
    eventType: "INVITATION_ACCEPTED",
    adminUserId: activated.id,
    targetType: "admin_invitation",
    targetId: invitation.id,
    metadata: { accountEmail: activated.normalizedEmail, invitationId: invitation.id },
  });

  await recordSecurityEvent({
    eventType: "ACCOUNT_ACTIVATED",
    adminUserId: activated.id,
    targetType: "admin_user",
    targetId: activated.id,
    metadata: {
      accountEmail: activated.normalizedEmail,
      previousStatus: "INVITED",
      nextStatus: "ACTIVE",
      authVersion: activated.authVersion,
    },
  });

  return { adminUserId: activated.id, normalizedEmail: activated.normalizedEmail };
}

/** Revokes a pending invitation by id. Used by the CLI and, later, the CMS. */
export async function revokeInvitationById(params: {
  invitationId: string;
  actorAdminId?: string | null;
}): Promise<boolean> {
  const revoked = await revokeInvitation({ invitationId: params.invitationId });

  if (revoked) {
    await recordSecurityEvent({
      eventType: "INVITATION_REVOKED",
      adminUserId: params.actorAdminId ?? null,
      targetType: "admin_invitation",
      targetId: params.invitationId,
      metadata: { invitationId: params.invitationId },
    });
  }

  return revoked;
}

/** True when bootstrap is permitted. Used by the CLI to explain itself. */
export async function canBootstrap(): Promise<{ enabled: boolean; administrators: number }> {
  const administrators = await countAdmins();

  return {
    enabled: process.env.ADMIN_BOOTSTRAP_ENABLED === "true" && administrators === 0,
    administrators,
  };
}

export { countActiveAdmins };

/** Type-only re-export so callers can annotate transaction callbacks. */
export type TransactionClient = Prisma.TransactionClient;
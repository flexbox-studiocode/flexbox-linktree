import "server-only";

import {
  ADMIN_IDENTITY_SELECT,
  findAdminById,
  findAdminWithPasswordHash,
  findAdminWithPasswordHashById,
  replaceAdminPassword,
  revokeAdminSessions,
} from "@/features/auth/repositories/admin-user";
import { invalidateResetTokensForAdmin } from "@/features/auth/repositories/password-reset-token";
import { recordSecurityEvent } from "@/features/auth/services/security-event";
import { prisma } from "@/lib/prisma/client";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/security/password";
import type { Prisma } from "@/generated/prisma/client";
import type { AdminAccountStatus } from "@/generated/prisma/enums";

/**
 * Account security lifecycle.
 *
 * Two invariants hold for every state change:
 *
 * 1. Every credential-affecting change increments `authVersion`, which
 *    invalidates outstanding JWTs (see `resolveAuthorizedAdmin`).
 * 2. The acting administrator is identified explicitly, so the audit trail
 *    names who suspended, disabled, or re-enabled an account.
 *
 * Suspension and disablement differ only in intent — both deny access
 * immediately — but they are recorded distinctly because the operator's
 * expectation differs (temporary vs. final).
 */

export type LifecycleErrorCode =
  | "not_found"
  | "invalid_current_password"
  | "invalid_password"
  | "same_password"
  | "invalid_transition";

export class LifecycleError extends Error {
  readonly code: LifecycleErrorCode;

  constructor(code: LifecycleErrorCode, message: string) {
    super(message);
    this.name = "LifecycleError";
    this.code = code;
  }
}

/** Statuses that deny access. Kept together so a new status cannot be missed. */
export const DENYING_STATUSES: readonly AdminAccountStatus[] = ["INVITED", "SUSPENDED", "DISABLED"];

export function deniesAccess(status: AdminAccountStatus): boolean {
  return DENYING_STATUSES.includes(status);
}

/**
 * Changes the administrator's own password.
 *
 * The current password must be re-presented: a session alone is not enough to
 * rotate a credential. On success every other session is revoked (the
 * `authVersion` bump) and outstanding reset links are invalidated.
 */
export async function changeOwnPassword(params: {
  adminUserId: string;
  currentPassword: string;
  newPassword: string;
  now?: Date;
}): Promise<{ authVersion: number }> {
  const admin = await findAdminWithPasswordHashById(params.adminUserId);

  if (!admin) {
    throw new LifecycleError("not_found", "Administrator account not found.");
  }

  if (!(await verifyPassword(admin.passwordHash, params.currentPassword))) {
    await recordSecurityEvent({
      eventType: "LOGIN_FAILED",
      adminUserId: admin.id,
      targetType: "admin_user",
      targetId: admin.id,
      metadata: { accountEmail: admin.normalizedEmail, reason: "password_change_rejected" },
    });

    throw new LifecycleError("invalid_current_password", "The current password is not correct.");
  }

  const policyError = checkPasswordPolicy(params.newPassword);

  if (policyError) {
    throw new LifecycleError("invalid_password", policyError);
  }

  if (await verifyPassword(admin.passwordHash, params.newPassword)) {
    throw new LifecycleError("same_password", "Choose a password you have not used before.");
  }

  const updated = await replaceAdminPassword({
    adminUserId: admin.id,
    passwordHash: await hashPassword(params.newPassword),
  });

  await invalidateResetTokensForAdmin(admin.id, params.now ?? new Date());
  await recordSecurityEvent({
    eventType: "PASSWORD_CHANGED",
    adminUserId: admin.id,
    targetType: "admin_user",
    targetId: admin.id,
    metadata: { accountEmail: admin.normalizedEmail, authVersion: updated.authVersion },
  });

  return { authVersion: updated.authVersion };
}

/** Explicitly revokes every session for an account without changing its status. */
export async function revokeAdminSessionsForIdentity(params: {
  adminUserId: string;
  actorAdminId?: string | null;
}): Promise<{ authVersion: number } | null> {
  const existing = await findAdminById(params.adminUserId);

  if (!existing) {
    return null;
  }

  const updated = await revokeAdminSessions(params.adminUserId);

  await recordSecurityEvent({
    eventType: "SESSION_REVOKED",
    adminUserId: params.actorAdminId ?? existing.id,
    targetType: "admin_user",
    targetId: existing.id,
    metadata: { accountEmail: existing.normalizedEmail, authVersion: updated.authVersion },
  });

  return { authVersion: updated.authVersion };
}

export type StatusTransitionResult = {
  previousStatus: AdminAccountStatus;
  nextStatus: AdminAccountStatus;
  authVersion: number;
};

/**
 * Optional guard executed inside the same transaction as the status write.
 *
 * Phase 5 uses it to prevent the last active Super Admin from being suspended or
 * disabled. Running the check and the update in one transaction (with a row
 * lock on the account) makes the decision atomic, so two concurrent requests
 * cannot both observe "two active owners" and then both demote one.
 */
export type StatusGuard<Tx> = (tx: Tx) => Promise<void>;

async function applyStatusChange(params: {
  adminUserId: string;
  nextStatus: AdminAccountStatus;
  actorAdminId?: string | null;
  eventType: "ACCOUNT_SUSPENDED" | "ACCOUNT_DISABLED" | "ACCOUNT_ACTIVATED";
  guard?: StatusGuard<Prisma.TransactionClient>;
}): Promise<StatusTransitionResult> {
  const existing = await findAdminById(params.adminUserId);

  if (!existing) {
    throw new LifecycleError("not_found", "Administrator account not found.");
  }

  if (existing.status === params.nextStatus) {
    throw new LifecycleError(
      "invalid_transition",
      `The account is already ${params.nextStatus}.`,
    );
  }

  // Activating a record that never had a password would create an unusable
  // ACTIVE account, which the database CHECK also forbids.
  if (params.nextStatus === "ACTIVE") {
    const withPassword = await findAdminWithPasswordHash(existing.normalizedEmail);

    if (!withPassword?.passwordHash) {
      throw new LifecycleError(
        "invalid_transition",
        "An account without a password cannot be activated. Use an invitation instead.",
      );
    }
  }

  const updated = await applyStatusWrite({
    adminUserId: existing.id,
    nextStatus: params.nextStatus,
    guard: params.guard,
  });

  await recordSecurityEvent({
    eventType: params.eventType,
    adminUserId: params.actorAdminId ?? existing.id,
    targetType: "admin_user",
    targetId: existing.id,
    metadata: {
      accountEmail: existing.normalizedEmail,
      previousStatus: existing.status,
      nextStatus: params.nextStatus,
      authVersion: updated.authVersion,
    },
  });

  return {
    previousStatus: existing.status,
    nextStatus: params.nextStatus,
    authVersion: updated.authVersion,
  };
}

/**
 * Applies the status and the `authVersion` increment inside one transaction.
 * The row is locked first so a concurrent request cannot change the same
 * account between the caller's guard and the write.
 */
async function applyStatusWrite(params: {
  adminUserId: string;
  nextStatus: AdminAccountStatus;
  guard?: StatusGuard<Prisma.TransactionClient>;
}) {
  return prisma.$transaction(async (tx) => {
    // `SELECT ... FOR UPDATE` serialises concurrent transitions on this row.
    await tx.$queryRaw`SELECT id FROM admin_users WHERE id = ${params.adminUserId}::uuid FOR UPDATE`;

    if (params.guard) {
      await params.guard(tx);
    }

    return tx.adminUser.update({
      where: { id: params.adminUserId },
      data: {
        status: params.nextStatus,
        authVersion: { increment: 1 },
        ...(params.nextStatus === "ACTIVE" ? { failedLoginCount: 0, lockedUntil: null } : {}),
      },
      select: ADMIN_IDENTITY_SELECT,
    });
  });
}

export async function suspendAdmin(params: {
  adminUserId: string;
  actorAdminId?: string | null;
  guard?: StatusGuard<Prisma.TransactionClient>;
}): Promise<StatusTransitionResult> {
  return applyStatusChange({ ...params, nextStatus: "SUSPENDED", eventType: "ACCOUNT_SUSPENDED" });
}

export async function disableAdmin(params: {
  adminUserId: string;
  actorAdminId?: string | null;
  guard?: StatusGuard<Prisma.TransactionClient>;
}): Promise<StatusTransitionResult> {
  return applyStatusChange({ ...params, nextStatus: "DISABLED", eventType: "ACCOUNT_DISABLED" });
}

export async function reactivateAdmin(params: {
  adminUserId: string;
  actorAdminId?: string | null;
  guard?: StatusGuard<Prisma.TransactionClient>;
}): Promise<StatusTransitionResult> {
  return applyStatusChange({ ...params, nextStatus: "ACTIVE", eventType: "ACCOUNT_ACTIVATED" });
}

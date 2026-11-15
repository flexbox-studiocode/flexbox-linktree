import "server-only";

import {
  disableAdmin,
  LifecycleError,
  reactivateAdmin,
  suspendAdmin,
  type StatusGuard,
} from "@/features/auth/services/account-lifecycle";
import {
  createInvitationForAdmin,
  ProvisioningError,
  revokeInvitationById,
} from "@/features/auth/services/provisioning";
import { recordSecurityEvent } from "@/features/auth/services/security-event";
import type { AdminAccountStatus, AdminRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { getAdminMailer } from "@/lib/mail/admin-mailer";
import { deriveAccountBucket } from "@/lib/security/tokens";

/**
 * Administrator management for the CMS.
 *
 * This module reuses the Phase 4 provisioning and lifecycle services instead of
 * re-implementing accounts, invitations, or session revocation. Its own
 * responsibility is the CMS-level policy:
 *
 *  - the acting administrator cannot suspend, disable, or permanently delete
 *    their own account;
 *  - the last ACTIVE SUPER_ADMIN cannot be suspended, disabled, or deleted;
 *  - only an ACTIVE SUPER_ADMIN may delete another administrator;
 *  - invitation tokens are handed back exactly once for private delivery.
 */

export type AdminManagementErrorCode =
  | "not_found"
  | "self_lockout"
  | "last_active_admin"
  | "forbidden"
  | "invalid_input"
  | "existing_account"
  | "store_failure";

export class AdminManagementError extends Error {
  readonly code: AdminManagementErrorCode;

  constructor(code: AdminManagementErrorCode, message: string) {
    super(message);
    this.name = "AdminManagementError";
    this.code = code;
  }
}

export type AdminActor = { adminId: string; actorEmail: string };

export type InvitationState = "none" | "pending" | "accepted" | "revoked" | "expired";

/** Derives a single display state from the latest invitation row. */
export function deriveInvitationState(
  invitation: { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null } | null,
  now: Date = new Date(),
): InvitationState {
  if (!invitation) {
    return "none";
  }

  if (invitation.acceptedAt) {
    return "accepted";
  }

  if (invitation.revokedAt) {
    return "revoked";
  }

  return invitation.expiresAt.getTime() <= now.getTime() ? "expired" : "pending";
}

export type InvitationDelivery = {
  delivered: boolean;
  /** True when the local file transport was the only option (never production). */
  developmentOnly: boolean;
};

function buildInvitationBody(params: { fullName: string; email: string; token: string; expiresAt: Date }): string {
  return [
    `Hello ${params.fullName},`,
    "",
    "You have been invited to administer the Flexbox Studio digital hub.",
    `This invitation expires at ${params.expiresAt.toISOString()} and can be used once.`,
    "",
    "Activate the account from the project terminal with:",
    "",
    `  pnpm admin:accept-invite --email="${params.email}"`,
    "",
    "and provide the activation token when asked:",
    "",
    `  ${params.token}`,
    "",
    "If you were not expecting this invitation, ignore this message.",
  ].join("\n");
}

/**
 * Issues an invitation and attempts delivery through the configured mail
 * transport. Delivery never fails the operation: the token is returned to the
 * caller regardless so a Super Admin can hand it over privately.
 */
export async function inviteAdministrator(input: {
  actor: AdminActor;
  email: string;
  fullName: string;
}): Promise<{
  invitationId: string;
  token: string;
  expiresAt: Date;
  normalizedEmail: string;
  delivery: InvitationDelivery;
}> {
  let result;

  try {
    result = await createInvitationForAdmin({
      email: input.email,
      fullName: input.fullName,
      createdByAdminId: input.actor.adminId,
    });
  } catch (error) {
    if (error instanceof ProvisioningError) {
      throw new AdminManagementError(
        error.code === "existing_account" ? "existing_account" : "invalid_input",
        error.message,
      );
    }

    throw error;
  }

  let delivery: InvitationDelivery = { delivered: false, developmentOnly: false };

  try {
    const mailer = getAdminMailer();

    const outcome = await mailer.send({
      to: result.normalizedEmail,
      subject: "Flexbox Studio administrator invitation",
      kind: "invitation",
      body: buildInvitationBody({
        fullName: input.fullName,
        email: result.normalizedEmail,
        token: result.token,
        expiresAt: result.expiresAt,
      }),
    });

    delivery = { delivered: outcome.delivered, developmentOnly: mailer.name === "file" };
  } catch {
    delivery = { delivered: false, developmentOnly: process.env.NODE_ENV !== "production" };
  }

  return {
    invitationId: result.invitationId,
    token: result.token,
    expiresAt: result.expiresAt,
    normalizedEmail: result.normalizedEmail,
    delivery,
  };
}

export async function revokeAdministratorInvitation(input: {
  actor: AdminActor;
  invitationId: string;
}): Promise<boolean> {
  return revokeInvitationById({
    invitationId: input.invitationId,
    actorAdminId: input.actor.adminId,
  });
}

/** Reactivates a suspended or disabled account (never a self-transition). */
export async function changeAdministratorStatus(input: {
  actor: AdminActor;
  adminUserId: string;
  nextStatus: AdminAccountStatus;
}): Promise<{ previousStatus: AdminAccountStatus; nextStatus: AdminAccountStatus; authVersion: number }> {
  const guard: StatusGuard<Prisma.TransactionClient> = async (tx) => {
    const target = await tx.adminUser.findUnique({
      where: { id: input.adminUserId },
      select: { id: true, status: true, role: true },
    });

    if (!target) {
      throw new AdminManagementError("not_found", "Akun administrator tidak ditemukan.");
    }

    if (input.nextStatus !== "ACTIVE") {
      if (target.id === input.actor.adminId) {
        throw new AdminManagementError(
          "self_lockout",
          "Anda tidak dapat menonaktifkan akun Anda sendiri.",
        );
      }

      if (target.status === "ACTIVE" && target.role === "SUPER_ADMIN") {
        const activeOwners = await tx.adminUser.count({
          where: { status: "ACTIVE", role: "SUPER_ADMIN" },
        });

        if (activeOwners <= 1) {
          throw new AdminManagementError(
            "last_active_admin",
            "Ini adalah Super Admin aktif terakhir dan tidak dapat dinonaktifkan.",
          );
        }
      }
    }
  };

  const params = { adminUserId: input.adminUserId, actorAdminId: input.actor.adminId, guard };

  try {
    if (input.nextStatus === "SUSPENDED") {
      return await suspendAdmin(params);
    }

    if (input.nextStatus === "DISABLED") {
      return await disableAdmin(params);
    }

    if (input.nextStatus === "ACTIVE") {
      return await reactivateAdmin(params);
    }

    throw new AdminManagementError("invalid_input", "Status akun tidak didukung.");
  } catch (error) {
    if (error instanceof AdminManagementError) {
      throw error;
    }

    if (error instanceof LifecycleError) {
      if (error.code === "not_found") {
        throw new AdminManagementError("not_found", "Akun administrator tidak ditemukan.");
      }

      if (error.code === "invalid_transition") {
        throw new AdminManagementError("invalid_input", "Perubahan status tidak diizinkan.");
      }
    }

    // Map remaining lifecycle failures to a stable message without leaking
    // internals.
    throw new AdminManagementError("invalid_input", "Perubahan status gagal.");
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DeletedAdministrator = {
  adminUserId: string;
  accountEmail: string;
  role: AdminRole;
  previousStatus: AdminAccountStatus;
  revokedInvitations: number;
  removedResetTokens: number;
  removedBuckets: number;
};

type LockedAdminRow = {
  id: string;
  email: string;
  normalized_email: string;
  role: AdminRole;
  status: AdminAccountStatus;
};

/**
 * Permanently removes an administrator account.
 *
 * This is the only destructive administrator operation, so the policy is
 * enforced inside one transaction that locks the affected rows:
 *
 *  - the caller must be an ACTIVE SUPER_ADMIN (re-checked here, not only in the
 *    Server Action);
 *  - nobody may delete their own account;
 *  - the last ACTIVE SUPER_ADMIN may not be deleted;
 *  - pending invitations for the address, outstanding reset tokens, and the
 *    account throttle bucket are revoked so no credential can outlive the row;
 *  - the audit event keeps the deleted account id and address, because the
 *    security trail outlives the account (`onDelete: SetNull`).
 *
 * `SELECT ... FOR UPDATE` on the active owner set is ordered by id so two
 * concurrent deletions serialise instead of both observing "two owners" and
 * deleting the last one.
 */
export async function deleteAdministrator(input: {
  actor: AdminActor;
  adminUserId: string;
  /** Typed confirmation; must equal the target's normalized address. */
  confirmation: string;
}): Promise<DeletedAdministrator> {
  if (!UUID_PATTERN.test(input.adminUserId)) {
    throw new AdminManagementError("not_found", "Akun administrator tidak ditemukan.");
  }

  if (input.adminUserId === input.actor.adminId) {
    throw new AdminManagementError("self_lockout", "Anda tidak dapat menghapus akun Anda sendiri.");
  }

  const now = new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    const actor = await tx.adminUser.findUnique({
      where: { id: input.actor.adminId },
      select: { id: true, role: true, status: true },
    });

    if (!actor || actor.role !== "SUPER_ADMIN" || actor.status !== "ACTIVE") {
      throw new AdminManagementError(
        "forbidden",
        "Hanya Super Admin aktif yang dapat menghapus administrator.",
      );
    }

    // Serialise on the active owner set first, in a stable order, so concurrent
    // deletions and status changes cannot both pass the last-owner check.
    await tx.$queryRaw`
      SELECT id FROM admin_users
      WHERE status = 'ACTIVE' AND role = 'SUPER_ADMIN'
      ORDER BY id
      FOR UPDATE
    `;

    const rows = await tx.$queryRaw<LockedAdminRow[]>`
      SELECT id, email, normalized_email, role, status
      FROM admin_users
      WHERE id = ${input.adminUserId}::uuid
      FOR UPDATE
    `;

    const target = rows[0];

    if (!target) {
      throw new AdminManagementError("not_found", "Akun administrator tidak ditemukan.");
    }

    if (target.id === input.actor.adminId) {
      throw new AdminManagementError("self_lockout", "Anda tidak dapat menghapus akun Anda sendiri.");
    }

    // The typed confirmation is re-checked against the row so a stale or
    // tampered form can never delete a different account.
    if (input.confirmation.trim().toLowerCase() !== target.normalized_email) {
      throw new AdminManagementError(
        "invalid_input",
        "Ketik alamat surel akun yang akan dihapus untuk mengonfirmasi.",
      );
    }

    if (target.status === "ACTIVE" && target.role === "SUPER_ADMIN") {
      const activeOwners = await tx.adminUser.count({
        where: { status: "ACTIVE", role: "SUPER_ADMIN" },
      });

      if (activeOwners <= 1) {
        throw new AdminManagementError(
          "last_active_admin",
          "Ini adalah Super Admin aktif terakhir dan tidak dapat dihapus.",
        );
      }
    }

    // Invitations are addressed by email rather than by a foreign key, so a
    // pending token would keep working after the account row disappears.
    const revokedInvitations = await tx.adminInvitation.updateMany({
      where: {
        normalizedEmail: target.normalized_email,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    const removedResetTokens = await tx.passwordResetToken.deleteMany({
      where: { adminUserId: target.id },
    });

    // The ACCOUNT throttle bucket is keyed by the hashed address, so it is not
    // removed by the cascade and must be cleared explicitly.
    const removedBuckets = await tx.adminRateLimit.deleteMany({
      where: { scope: "ACCOUNT", keyHash: deriveAccountBucket(target.normalized_email) },
    });

    await tx.adminUser.delete({ where: { id: target.id } });

    return {
      adminUserId: target.id,
      accountEmail: target.email,
      role: target.role,
      previousStatus: target.status,
      revokedInvitations: revokedInvitations.count,
      removedResetTokens: removedResetTokens.count,
      removedBuckets: removedBuckets.count,
    } satisfies DeletedAdministrator;
  });

  // Recorded after the commit: the deleted row would null the actor foreign key
  // if the event were written inside the same transaction.
  await recordSecurityEvent({
    eventType: "ADMIN_ACCOUNT_DELETED",
    adminUserId: input.actor.adminId,
    targetType: "admin_user",
    targetId: outcome.adminUserId,
    metadata: {
      actorEmail: input.actor.actorEmail,
      accountEmail: outcome.accountEmail,
      accountRole: outcome.role,
      previousStatus: outcome.previousStatus,
      removedInvitations: outcome.revokedInvitations,
      removedResetTokens: outcome.removedResetTokens,
      removedBuckets: outcome.removedBuckets,
    },
  });

  return outcome;
}

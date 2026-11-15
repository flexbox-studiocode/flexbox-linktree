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
import type { AdminAccountStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { getAdminMailer } from "@/lib/mail/admin-mailer";

/**
 * Administrator management for the CMS.
 *
 * This module reuses the Phase 4 provisioning and lifecycle services instead of
 * re-implementing accounts, invitations, or session revocation. Its own
 * responsibility is the CMS-level policy:
 *
 *  - the acting administrator cannot suspend or disable their own account;
 *  - the last ACTIVE SUPER_ADMIN cannot be suspended or disabled;
 *  - invitation tokens are handed back exactly once for private delivery.
 */

export type AdminManagementErrorCode =
  | "not_found"
  | "self_lockout"
  | "last_active_admin"
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

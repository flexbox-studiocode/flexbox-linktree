import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { AdminRole } from "@/generated/prisma/enums";

/**
 * Invitation persistence.
 *
 * Every lookup the acceptance flow performs is scoped to a single-use state:
 * `tokenHash` (unique) plus `acceptedAt: null` and `revokedAt: null`. Two
 * concurrent acceptances then cannot both succeed, because only one
 * `UPDATE ... WHERE accepted_at IS NULL` can affect a row.
 */

export type CreateInvitationInput = {
  email: string;
  normalizedEmail: string;
  tokenHash: string;
  role?: AdminRole;
  expiresAt: Date;
  createdByAdminId?: string | null;
};

export async function createInvitation(input: CreateInvitationInput) {
  return prisma.adminInvitation.create({
    data: {
      email: input.email,
      normalizedEmail: input.normalizedEmail,
      tokenHash: input.tokenHash,
      role: input.role ?? "SUPER_ADMIN",
      expiresAt: input.expiresAt,
      createdByAdminId: input.createdByAdminId ?? null,
    },
    select: {
      id: true,
      email: true,
      normalizedEmail: true,
      expiresAt: true,
      role: true,
      createdAt: true,
    },
  });
}

/** Finds a pending invitation by token hash, ignoring expired/used/revoked rows. */
export async function findPendingInvitationByTokenHash(tokenHash: string) {
  return prisma.adminInvitation.findFirst({
    where: { tokenHash, acceptedAt: null, revokedAt: null },
    select: {
      id: true,
      email: true,
      normalizedEmail: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      createdByAdminId: true,
    },
  });
}

/**
 * Atomically claims an invitation for one acceptance.
 *
 * Returns `null` when the row was already accepted, revoked, or expired, which
 * makes a replayed token fail safely instead of creating a second account.
 */
export async function claimInvitation(params: {
  invitationId: string;
  acceptedByAdminId: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();

  const claimed = await prisma.adminInvitation.updateMany({
    where: {
      id: params.invitationId,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: { acceptedAt: now, acceptedByAdminId: params.acceptedByAdminId },
  });

  return claimed.count === 1;
}

/** Revokes a pending invitation. Replayed tokens then fail permanently. */
export async function revokeInvitation(params: {
  invitationId: string;
  now?: Date;
}): Promise<boolean> {
  const revoked = await prisma.adminInvitation.updateMany({
    where: { id: params.invitationId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: params.now ?? new Date() },
  });

  return revoked.count === 1;
}

export async function countPendingInvitationsForEmail(normalizedEmail: string): Promise<number> {
  return prisma.adminInvitation.count({
    where: { normalizedEmail, acceptedAt: null, revokedAt: null },
  });
}

export async function findInvitationById(id: string) {
  return prisma.adminInvitation.findUnique({ where: { id } });
}

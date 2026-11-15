import "server-only";

import { prisma } from "@/lib/prisma/client";

/**
 * Password-reset token persistence.
 *
 * A token is identified by its SHA-256 hash. Consumption uses
 * `UPDATE ... WHERE used_at IS NULL AND expires_at > now()`, so a replayed
 * token can never be applied twice even under concurrent requests.
 */

export async function createPasswordResetToken(params: {
  adminUserId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  return prisma.passwordResetToken.create({
    data: {
      adminUserId: params.adminUserId,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
    },
    select: { id: true, adminUserId: true, expiresAt: true, createdAt: true },
  });
}

/** Finds a usable reset token by hash. Returns `null` for used/expired rows. */
export async function findUsableResetToken(tokenHash: string, now: Date = new Date()) {
  return prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    select: { id: true, adminUserId: true, expiresAt: true },
  });
}

/** Atomically marks a token as used. Returns false when it was already used. */
export async function consumeResetToken(params: {
  tokenId: string;
  now?: Date;
}): Promise<boolean> {
  const now = params.now ?? new Date();
  const result = await prisma.passwordResetToken.updateMany({
    where: { id: params.tokenId, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  return result.count === 1;
}

/**
 * Invalidates every outstanding reset token for an account. Called after a
 * password change so older links stop working immediately.
 */
export async function invalidateResetTokensForAdmin(
  adminUserId: string,
  now: Date = new Date(),
): Promise<number> {
  const result = await prisma.passwordResetToken.updateMany({
    where: { adminUserId, usedAt: null },
    data: { usedAt: now },
  });

  return result.count;
}

export async function deleteExpiredResetTokens(now: Date = new Date()): Promise<number> {
  const result = await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });

  return result.count;
}

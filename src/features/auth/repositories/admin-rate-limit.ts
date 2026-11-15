import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma/client";
import type { RateLimitScope } from "@/generated/prisma/enums";

/** Serializable snapshot of one rate-limit bucket. */
export type RateLimitBucket = {
  attemptCount: number;
  windowStartedAt: Date;
  lockedUntil: Date | null;
};

type RawBucketRow = {
  attempt_count: number;
  window_started_at: Date;
  locked_until: Date | null;
};

/**
 * Records one attempt against a bucket and returns the resulting state.
 *
 * This is a single `INSERT ... ON CONFLICT DO UPDATE` statement, so concurrent
 * requests cannot slip past the limit by reading the same pre-increment value.
 * The window reset, the counter increment, and the lockout decision are all
 * evaluated inside the database from the existing row, which keeps the
 * operation atomic and safe across processes and restarts.
 *
 * Note: inside `ON CONFLICT DO UPDATE`, `"admin_rate_limits"."column"` refers
 * to the stored row (the pre-update value), which is exactly what the CASE
 * expressions need.
 */
export async function recordAttempt(params: {
  scope: RateLimitScope;
  keyHash: string;
  policy: { windowSeconds: number; maxAttempts: number; lockoutSeconds: number };
  now: Date;
}): Promise<RateLimitBucket> {
  const { scope, keyHash, policy, now } = params;

  const windowFloor = new Date(now.getTime() - policy.windowSeconds * 1_000);
  const lockedUntil = new Date(now.getTime() + policy.lockoutSeconds * 1_000);
  const retentionSeconds = Math.max(policy.windowSeconds, policy.lockoutSeconds) + 60;
  const expiresAt = new Date(now.getTime() + retentionSeconds * 1_000);
  const id = randomUUID();

  const rows = await prisma.$queryRaw<RawBucketRow[]>`
    INSERT INTO "admin_rate_limits" (
      "id", "scope", "key_hash", "attempt_count", "window_started_at",
      "locked_until", "expires_at", "created_at", "updated_at"
    )
    VALUES (
      ${id}::uuid, ${scope}::"rate_limit_scope", ${keyHash}, 1, ${now},
      NULL, ${expiresAt}, ${now}, ${now}
    )
    ON CONFLICT ("scope", "key_hash") DO UPDATE SET
      "attempt_count" = CASE
        WHEN "admin_rate_limits"."window_started_at" <= ${windowFloor} THEN 1
        ELSE "admin_rate_limits"."attempt_count" + 1
      END,
      "window_started_at" = CASE
        WHEN "admin_rate_limits"."window_started_at" <= ${windowFloor} THEN ${now}
        ELSE "admin_rate_limits"."window_started_at"
      END,
      "locked_until" = CASE
        WHEN "admin_rate_limits"."window_started_at" <= ${windowFloor} THEN NULL
        WHEN "admin_rate_limits"."attempt_count" + 1 >= ${policy.maxAttempts} THEN ${lockedUntil}
        ELSE "admin_rate_limits"."locked_until"
      END,
      "expires_at" = ${expiresAt},
      "updated_at" = ${now}
    RETURNING "attempt_count", "window_started_at", "locked_until"
  `;

  const row = rows[0];

  return {
    attemptCount: row.attempt_count,
    windowStartedAt: row.window_started_at,
    lockedUntil: row.locked_until,
  };
}

/** Reads a bucket without mutating it. */
export async function readBucket(
  scope: RateLimitScope,
  keyHash: string,
): Promise<RateLimitBucket | null> {
  const row = await prisma.adminRateLimit.findUnique({
    where: { scope_keyHash: { scope, keyHash } },
    select: { attemptCount: true, windowStartedAt: true, lockedUntil: true },
  });

  return row ?? null;
}

/** Clears a bucket. Used after a successful sign-in. */
export async function clearBucket(scope: RateLimitScope, keyHash: string): Promise<void> {
  await prisma.adminRateLimit.deleteMany({ where: { scope, keyHash } });
}

/**
 * Deletes buckets whose retention horizon has passed. Returns the number of
 * removed rows so callers can record a security event.
 */
export async function deleteExpiredBuckets(now: Date = new Date()): Promise<number> {
  const result = await prisma.adminRateLimit.deleteMany({ where: { expiresAt: { lt: now } } });

  return result.count;
}

/** Bucket count for diagnostics and tests. */
export async function countBuckets(): Promise<number> {
  return prisma.adminRateLimit.count();
}

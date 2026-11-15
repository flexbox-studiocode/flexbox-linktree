import "server-only";

import {
  clearBucket,
  deleteExpiredBuckets,
  readBucket,
  recordAttempt,
} from "@/features/auth/repositories/admin-rate-limit";
import { deriveAccountBucket, deriveSourceBucket } from "@/lib/security/tokens";

/**
 * Database-backed login throttling.
 *
 * Why not an in-memory counter: the counter must survive a process restart and
 * must be shared by every process serving the deployment. A `Map` satisfies
 * neither property, and an attacker who can trigger a restart would reset it.
 *
 * Two independent buckets are evaluated for every credential check:
 *
 *   - ACCOUNT: keyed by SHA-256 of the normalized email address. If this bucket
 *     were keyed by raw email, the table would hold account identifiers; hashing
 *     keeps the stored key non-reversible while still being stable per account.
 *   - SOURCE:  keyed by an HMAC of the client address with a dedicated secret.
 *     Raw addresses are never persisted, and the HMAC prevents offline
 *     recovery of the small IPv4 keyspace from the stored digests.
 *
 * Default policy (documented in `.docs/AUTH_SECURITY.md`):
 *   - 5 failures per account within 15 minutes, then a 15-minute lockout.
 *   - 20 failures per source within 15 minutes, then a 15-minute lockout.
 *
 * Thresholds are part of this module so tests can exercise the boundaries.
 */

export type RateLimitPolicy = {
  windowSeconds: number;
  maxAttempts: number;
  lockoutSeconds: number;
};

export const ACCOUNT_RATE_LIMIT_POLICY: RateLimitPolicy = {
  windowSeconds: 15 * 60,
  maxAttempts: 5,
  lockoutSeconds: 15 * 60,
};

export const SOURCE_RATE_LIMIT_POLICY: RateLimitPolicy = {
  windowSeconds: 15 * 60,
  maxAttempts: 20,
  lockoutSeconds: 15 * 60,
};

/**
 * Recovery endpoints reuse the SOURCE bucket.
 *
 * The `admin_rate_limits` table has exactly two scopes (`ACCOUNT`, `SOURCE`) and
 * that is deliberate: recovery, invitation acceptance, and sign-in are the same
 * authentication surface, so one source that is flooding any of them must not be
 * able to hammer the others for free.
 */

export type BucketDecision = {
  blocked: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
};

/** Converts a lock state into a decision and a client-safe retry hint. */
export function decideFromBucket(
  bucket: { attemptCount: number; lockedUntil: Date | null } | null,
  policy: RateLimitPolicy,
  now: Date = new Date(),
): BucketDecision {
  if (!bucket) {
    return { blocked: false, retryAfterSeconds: 0, remainingAttempts: policy.maxAttempts };
  }

  if (bucket.lockedUntil && bucket.lockedUntil.getTime() > now.getTime()) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.lockedUntil.getTime() - now.getTime()) / 1_000)),
      remainingAttempts: 0,
    };
  }

  return {
    blocked: false,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, policy.maxAttempts - bucket.attemptCount),
  };
}

export type SourceBucketContext = {
  /** Raw client address, or null when the deployment is not trusted to supply one. */
  sourceIdentifier: string | null;
};

/**
 * Resolves the source bucket key. Returns `null` when no trustworthy address is
 * available, in which case only the account bucket applies.
 */
export function sourceBucketKey(
  context: SourceBucketContext,
  secret: string | undefined,
): string | null {
  if (!context.sourceIdentifier || !secret) {
    return null;
  }

  return deriveSourceBucket(context.sourceIdentifier, secret);
}

export function accountBucketKey(normalizedEmail: string): string {
  return deriveAccountBucket(normalizedEmail);
}

/** Pre-check: reads both buckets and reports whether the attempt may proceed. */
export async function checkLoginAllowed(params: {
  normalizedEmail: string;
  sourceBucketKey: string | null;
  now?: Date;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = params.now ?? new Date();

  const [accountBucket, sourceBucket] = await Promise.all([
    readBucket("ACCOUNT", accountBucketKey(params.normalizedEmail)),
    params.sourceBucketKey ? readBucket("SOURCE", params.sourceBucketKey) : Promise.resolve(null),
  ]);

  const accountDecision = decideFromBucket(accountBucket, ACCOUNT_RATE_LIMIT_POLICY, now);
  const sourceDecision = decideFromBucket(sourceBucket, SOURCE_RATE_LIMIT_POLICY, now);

  if (accountDecision.blocked || sourceDecision.blocked) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(accountDecision.retryAfterSeconds, sourceDecision.retryAfterSeconds),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Records a failed credential check against both buckets and reports whether
 * the account bucket is now locked out.
 */
export async function recordFailedLogin(params: {
  normalizedEmail: string;
  sourceBucketKey: string | null;
  now?: Date;
}): Promise<{ locked: boolean; attemptCount: number; retryAfterSeconds: number }> {
  const now = params.now ?? new Date();

  const accountBucket = await recordAttempt({
    scope: "ACCOUNT",
    keyHash: accountBucketKey(params.normalizedEmail),
    policy: ACCOUNT_RATE_LIMIT_POLICY,
    now,
  });

  if (params.sourceBucketKey) {
    await recordAttempt({
      scope: "SOURCE",
      keyHash: params.sourceBucketKey,
      policy: SOURCE_RATE_LIMIT_POLICY,
      now,
    });
  }

  const decision = decideFromBucket(accountBucket, ACCOUNT_RATE_LIMIT_POLICY, now);

  return {
    locked: decision.blocked,
    attemptCount: accountBucket.attemptCount,
    retryAfterSeconds: decision.retryAfterSeconds,
  };
}

/** Clears both buckets after a successful sign-in. */
export async function resetLoginThrottle(params: {
  normalizedEmail: string;
  sourceBucketKey: string | null;
}): Promise<void> {
  await clearBucket("ACCOUNT", accountBucketKey(params.normalizedEmail));

  if (params.sourceBucketKey) {
    await clearBucket("SOURCE", params.sourceBucketKey);
  }
}

/** Removes expired buckets. Safe to run on any schedule; returns rows deleted. */
export async function cleanupExpiredRateLimits(now: Date = new Date()): Promise<number> {
  return deleteExpiredBuckets(now);
}

/**
 * Source-only throttle for endpoints that must not reveal whether an account
 * exists (recovery requests, invitation acceptance). Only the SOURCE bucket is
 * consulted: an ACCOUNT bucket would leak account existence through timing or
 * lockout, and there is nothing to protect per-account here.
 */
export async function checkSourceAllowed(params: {
  sourceBucketKey: string | null;
  now?: Date;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (!params.sourceBucketKey) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const now = params.now ?? new Date();
  const bucket = await readBucket("SOURCE", params.sourceBucketKey);
  const decision = decideFromBucket(bucket, SOURCE_RATE_LIMIT_POLICY, now);

  return { allowed: !decision.blocked, retryAfterSeconds: decision.retryAfterSeconds };
}

/** Records one attempt against the SOURCE bucket. */
export async function recordSourceAttempt(params: {
  sourceBucketKey: string | null;
  now?: Date;
}): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  if (!params.sourceBucketKey) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const now = params.now ?? new Date();
  const bucket = await recordAttempt({
    scope: "SOURCE",
    keyHash: params.sourceBucketKey,
    policy: SOURCE_RATE_LIMIT_POLICY,
    now,
  });
  const decision = decideFromBucket(bucket, SOURCE_RATE_LIMIT_POLICY, now);

  return { blocked: decision.blocked, retryAfterSeconds: decision.retryAfterSeconds };
}

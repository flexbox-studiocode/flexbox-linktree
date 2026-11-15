import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Analytics identifier cryptography.
 *
 * Raw visitor and session identifiers exist only inside the visitor's cookie
 * jar. Everything that reaches PostgreSQL is a keyed digest produced here, so a
 * database disclosure cannot be turned back into a visitor identifier without
 * the server secret.
 *
 * The secret is intentionally separate from `NEXTAUTH_SECRET`. Rotating it is a
 * supported privacy control: every stored hash becomes unlinkable from future
 * traffic, which also resets distinct-visitor counts. Rotating it must be an
 * explicit operational decision, never an automatic fallback.
 */

const KEY_ENV = "ANALYTICS_HASH_SECRET";
const FALLBACK_ENV = "NEXTAUTH_SECRET";

let cachedSecret: string | null | undefined;

function resolveSecret(): string | null {
  if (cachedSecret !== undefined) {
    return cachedSecret;
  }

  const configured = process.env[KEY_ENV]?.trim();

  if (configured && configured.length >= 16) {
    cachedSecret = configured;
    return cachedSecret;
  }

  // Development convenience only: a local run without the dedicated key still
  // works because the Auth.js secret is already required. Production must set
  // `ANALYTICS_HASH_SECRET` explicitly; without it the collector is disabled and
  // the dashboard reports zero collected events instead of storing digests under
  // a key shared with session signing.
  if (process.env.NODE_ENV === "production") {
    cachedSecret = null;
    return cachedSecret;
  }

  const fallback = process.env[FALLBACK_ENV]?.trim();
  cachedSecret = fallback && fallback.length >= 16 ? fallback : null;

  return cachedSecret;
}

/** True when analytics hashing is configured. Unset means collection is off. */
export function analyticsHashingEnabled(): boolean {
  return resolveSecret() !== null;
}

/** Test-only: drops the memoized secret after an environment change. */
export function resetAnalyticsSecretCache(): void {
  cachedSecret = undefined;
}

/**
 * Keyed digest of an identifier or of a dedupe window descriptor.
 * Returns `null` when no secret is configured, which callers treat as
 * "analytics disabled" rather than falling back to an unkeyed hash.
 */
export function keyedDigest(value: string): string | null {
  const secret = resolveSecret();

  if (!secret) {
    return null;
  }

  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

/** Unkeyed SHA-256 for non-identifying lookups such as an emailed account key. */
export function plainDigest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Cryptographically random identifier, base64url encoded. */
export function randomIdentifier(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}

/** Constant-time comparison for two digest strings of the same length. */
export function digestsEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

/** 30-second dedupe window bucket, matching the documented refresh policy. */
export function dedupeWindowBucket(instant: Date, windowSeconds = 30): number {
  return Math.floor(instant.getTime() / 1000 / windowSeconds);
}
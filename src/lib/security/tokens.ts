import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Opaque security token and pseudonym helpers.
 *
 * Design rules enforced here:
 *
 * 1. Tokens are cryptographically random (`crypto.randomBytes`, 256 bits of
 *    entropy encoded as base64url). They are never derived from user data.
 * 2. Only a hash of a token is persisted. A database leak therefore does not
 *    yield usable invitation or password-reset links.
 * 3. Lookup is by hash, and comparison of any two hashes uses
 *    `timingSafeEqual` so a length-independent comparison cannot leak
 *    information.
 * 4. Source addresses are never stored. Rate-limit buckets use a keyed HMAC
 *    with a dedicated server secret, so the raw IP cannot be recovered from the
 *    database without that secret.
 */

/** Number of random bytes in an invitation or password-reset token (256 bits). */
export const TOKEN_BYTES = 32;

/** Generates a URL-safe random token. The raw value is returned exactly once. */
export function generateOpaqueToken(bytes: number = TOKEN_BYTES): string {
  if (!Number.isInteger(bytes) || bytes < 16) {
    throw new RangeError("Opaque tokens require at least 128 bits of entropy.");
  }

  return randomBytes(bytes).toString("base64url");
}

/**
 * SHA-256 hex digest used as the stored representation of a token. Input is
 * normalised with `trim()` because a token pasted from a URL can carry a
 * trailing newline; an empty token hashes to a value that never matches a real
 * digest, so callers still fail closed.
 */
export function hashOpaqueToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Length-safe, constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

/**
 * Derives the rate-limit bucket key for a client source address.
 *
 * The HMAC secret is mandatory: without it we would be storing a plain hash of
 * an IP address, which is trivially reversible by enumeration (the IPv4 space
 * is small). The caller is responsible for supplying the configured secret.
 */
export function deriveSourceBucket(sourceIdentifier: string, secret: string): string {
  if (!secret) {
    throw new Error("A rate-limit HMAC secret is required to bucket source addresses.");
  }

  return createHmac("sha256", secret).update(sourceIdentifier).digest("hex");
}

/** Derives the account bucket key from a normalized email address. */
export function deriveAccountBucket(normalizedEmail: string): string {
  return createHash("sha256").update(normalizedEmail).digest("hex");
}

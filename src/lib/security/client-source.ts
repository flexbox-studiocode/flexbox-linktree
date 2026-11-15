import "server-only";

/**
 * Client address resolution for login throttling.
 *
 * Forwarded headers (`x-forwarded-for`, `x-real-ip`) are supplied by the
 * client unless a reverse proxy overwrites them. Trusting them unconditionally
 * would let an attacker rotate the throttle key on every attempt, so they are
 * read only when the deployment explicitly opts in through
 * `TRUST_PROXY_HEADERS=true` (set it only behind your own proxy).
 *
 * The returned value is never stored; `sourceBucketKey()` HMACs it before it
 * reaches the database.
 */

/** Marker used when a deployment explicitly trusts proxy headers. */
export function trustProxyHeaders(): boolean {
  return process.env.TRUST_PROXY_HEADERS === "true";
}

export function resolveSourceIdentifier(headers: Headers): string | null {
  if (!trustProxyHeaders()) {
    return null;
  }

  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    // The left-most entry is the originating client as appended by the proxy.
    const first = forwardedFor.split(",")[0]?.trim();

    if (first) {
      return first;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();

  return realIp && realIp.length > 0 ? realIp : null;
}

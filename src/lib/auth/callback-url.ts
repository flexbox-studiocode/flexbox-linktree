/**
 * `callbackUrl` sanitisation.
 *
 * Auth.js stores the destination the user was trying to reach and sends them
 * there after a successful sign-in. A raw, attacker-supplied `?callbackUrl=`
 * therefore has to be treated as untrusted input: accepted values must be
 * same-origin paths inside `/admin`, and everything else falls back to the
 * administration home.
 *
 * Rejected shapes:
 *   - absolute URLs, including `javascript:` and `data:` schemes;
 *   - protocol-relative URLs (`//evil.test/...`);
 *   - backslash variants that browsers normalise into `//host`;
 *   - control characters and whitespace;
 *   - any path outside the `/admin` prefix (which would let a sign-in flow hand
 *     the user a bookmarkable redirect into a public route).
 */

export const ADMIN_HOME_PATH = "/admin";

/** Paths inside `/admin` that must never be a redirect target (loop guard). */
const DENIED_TARGETS = new Set(["/admin/login"]);

function isSafePathSegment(pathname: string): boolean {
  return pathname.startsWith("/") && !pathname.includes("\\");
}

export function sanitizeCallbackUrl(candidate: unknown): string {
  if (typeof candidate !== "string") {
    return ADMIN_HOME_PATH;
  }

  // Control characters and embedded whitespace can smuggle headers or split the
  // value in downstream parsers. Reject instead of sanitising them away.
  const trimmed = candidate.trim();

  if (
    trimmed.length === 0 ||
    trimmed !== candidate ||
    /[\u0000-\u001F\u007F]/.test(trimmed) ||
    trimmed.includes(" ")
  ) {
    return ADMIN_HOME_PATH;
  }

  if (!isSafePathSegment(trimmed) || trimmed.startsWith("//") || DENIED_TARGETS.has(trimmed.split("?")[0])) {
    return ADMIN_HOME_PATH;
  }

  let parsed: URL;

  try {
    // A dummy base: only the pathname/search of a relative URL are meaningful.
    parsed = new URL(trimmed, "http://admin.invalid");
  } catch {
    return ADMIN_HOME_PATH;
  }

  // An absolute URL supplied by the caller would have replaced the base host.
  if (parsed.origin !== "http://admin.invalid") {
    return ADMIN_HOME_PATH;
  }

  const normalizedPath = parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, "") : parsed.pathname;

  if (normalizedPath !== "/admin" && !normalizedPath.startsWith("/admin/")) {
    return ADMIN_HOME_PATH;
  }

  return DENIED_TARGETS.has(normalizedPath)
    ? ADMIN_HOME_PATH
    : `${normalizedPath}${parsed.search}`;
}

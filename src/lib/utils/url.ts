const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_MAIL_PROTOCOLS = new Set(["mailto:"]);

/**
 * Returns true when a destination is safe for a public link card.
 *
 * Encodes the approved rule from AGENTS.md: only HTTP(S) destinations, plus
 * `mailto:` where a verified contact address is intended. `javascript:`,
 * `data:`, protocol-relative URLs, and arbitrary schemes are rejected.
 */
export function isAllowedDestinationUrl(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return false;
  }

  // Reject protocol-relative URLs such as "//evil.example" and bare relative
  // paths, which have no business being stored as public destinations.
  if (trimmed.startsWith("//") || trimmed.startsWith("/")) {
    return false;
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return parsed.hostname.length > 0;
  }

  if (ALLOWED_MAIL_PROTOCOLS.has(parsed.protocol)) {
    return parsed.pathname.length > 0;
  }

  return false;
}

/**
 * Returns the protocol family for a destination, or `null` when the value is
 * not an allowed destination.
 */
export function getDestinationKind(value: string): "web" | "email" | null {
  if (!isAllowedDestinationUrl(value)) {
    return null;
  }

  const protocol = new URL(value.trim()).protocol;

  return protocol === "mailto:" ? "email" : "web";
}
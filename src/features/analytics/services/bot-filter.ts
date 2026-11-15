import { isLikelyBot } from "@/features/analytics/utils/normalize";

/**
 * Collection exclusions.
 *
 * Three independent reasons to skip an event:
 *
 *  1. known automation (documented heuristic, section "Bot filtering" of
 *     `.docs/ANALYTICS_SPECIFICATION.md`);
 *  2. a health check or internal probe path;
 *  3. a request that targets the collector itself rather than a page.
 *
 * Administrator exclusion is deliberately *not* here: it requires a verified
 * session, so it lives in the collector route where the server can check the
 * administrator row.
 */

const PROBE_PATHS = new Set(["/api/health", "/health", "/healthz", "/robots.txt", "/sitemap.xml", "/favicon.ico"]);

export type BotFilterInput = {
  userAgent: string | null;
  /** Canonical public path, or `null` when the target is not a public page. */
  path: string | null;
};

export type BotFilterResult = { skip: true; reason: "bot" | "probe" | "non_page" } | { skip: false };

export function checkCollectionExclusion(input: BotFilterInput): BotFilterResult {
  if (input.path === null) {
    return { skip: true, reason: "non_page" };
  }

  if (PROBE_PATHS.has(input.path)) {
    return { skip: true, reason: "probe" };
  }

  if (isLikelyBot(input.userAgent)) {
    return { skip: true, reason: "bot" };
  }

  return { skip: false };
}
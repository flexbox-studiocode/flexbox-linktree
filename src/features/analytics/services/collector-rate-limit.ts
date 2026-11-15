import "server-only";

/**
 * Small in-memory abuse limiter for the anonymous collector.
 *
 * This limiter is intentionally not used as a security boundary and no key is
 * persisted. It bounds accidental beacon loops and trivial same-process abuse;
 * production deployments with multiple nodes should put equivalent limits at the
 * reverse proxy. A denied event returns 204 and never affects the public page.
 */

const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 120;
const MAX_BUCKETS = 2_000;

type Bucket = { startedAt: number; count: number };
const buckets = new Map<string, Bucket>();

/** Rate-limit a short-lived request-local fingerprint. */
export function allowCollectorRequest(key: string, now = Date.now()): boolean {
  const existing = buckets.get(key);

  if (!existing || now - existing.startedAt >= WINDOW_MS) {
    if (buckets.size >= MAX_BUCKETS) {
      // Discard expired entries first. If a hostile process fills the map with
      // fresh values, do not allocate unbounded memory: degrade collection.
      for (const [bucketKey, bucket] of buckets) {
        if (now - bucket.startedAt >= WINDOW_MS) buckets.delete(bucketKey);
      }

      if (buckets.size >= MAX_BUCKETS) return false;
    }

    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }

  if (existing.count >= MAX_EVENTS_PER_WINDOW) {
    return false;
  }

  existing.count += 1;
  return true;
}

/** Test-only cleanup. */
export function resetCollectorRateLimits(): void {
  buckets.clear();
}
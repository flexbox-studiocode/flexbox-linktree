import "server-only";

import { MAX_EVENT_BODY_BYTES } from "@/features/analytics/schemas/event";

/**
 * Request-shape guards for the public analytics collector.
 *
 * The collector is unauthenticated, so it must not become a body-read or
 * cross-site abuse vector. Both helpers are intentionally total: any ambiguity
 * resolves to "reject", and the route answers 204 either way.
 */

/** Reads at most `MAX_EVENT_BODY_BYTES`; returns `null` when the body is over. */
export async function readCollectorBody(
  body: ReadableStream<Uint8Array> | null,
  contentLength: string | null,
): Promise<string | null> {
  if (contentLength) {
    const declared = Number(contentLength);

    if (!Number.isFinite(declared) || declared < 0 || declared > MAX_EVENT_BODY_BYTES) {
      return null;
    }
  }

  if (!body) {
    return "";
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      total += value.byteLength;

      if (total > MAX_EVENT_BODY_BYTES) {
        await reader.cancel();
        return null;
      }

      chunks.push(value);
    }
  } catch {
    return null;
  }

  const joined = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(joined);
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value || value === "null") {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Accepts only same-origin collector requests.
 *
 * `Origin` is authoritative when the browser sends it. `Sec-Fetch-Site` is the
 * fallback for clients that omit `Origin`. When neither signal is present (some
 * privacy tools strip both, and legacy beacons did not send them), the request is
 * allowed through to schema validation rather than dropping legitimate page
 * views; the collector has no side effects beyond analytics writes and cookies.
 */
export function isSameOriginCollectorRequest(input: {
  origin: string | null;
  secFetchSite: string | null;
  requestUrl: string;
  configuredOrigin?: string | null;
}): boolean {
  const expected =
    normalizeOrigin(input.configuredOrigin ?? null) ?? normalizeOrigin(input.requestUrl);

  if (!expected) {
    return false;
  }

  if (input.origin) {
    return normalizeOrigin(input.origin) === expected;
  }

  if (input.secFetchSite) {
    return input.secFetchSite === "same-origin";
  }

  return true;
}
import { z } from "zod";

/**
 * Strict input contract for the public collector.
 *
 * The collector is unauthenticated by design, so the schema is the first line of
 * defence: unknown keys are rejected (`z.strictObject`), every string is bounded,
 * and the only accepted event type is the literal `page_view`. There is no
 * generic property bag and no way to submit a link click from the browser — clicks
 * are recorded server-side by the redirect handler.
 */

export const MAX_EVENT_BODY_BYTES = 2048;

const campaignValue = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._~-]*$/, "campaign value must be machine-shaped");

const campaignSchema = z
  .strictObject({
    source: campaignValue.optional(),
    medium: campaignValue.optional(),
    name: campaignValue.optional(),
  })
  .optional();

export const pageViewEventSchema = z.strictObject({
  type: z.literal("page_view"),
  /** Same-origin page path. Used only for the dedupe window and never stored. */
  path: z.string().max(256).optional(),
  /** `document.referrer`, reduced to a category server-side and never stored. */
  referrerUrl: z.string().max(512).optional(),
  campaign: campaignSchema,
});

export type PageViewEventPayload = z.infer<typeof pageViewEventSchema>;

export type ParsedEvent =
  | { ok: true; event: PageViewEventPayload }
  | { ok: false; reason: "invalid_payload" | "oversized" | "unsupported_content_type" };

/** Parses a request body into an allowed event, rejecting everything else. */
export function parseEventBody(rawBody: string): ParsedEvent {
  if (rawBody.length > MAX_EVENT_BODY_BYTES) {
    return { ok: false, reason: "oversized" };
  }

  let json: unknown;

  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }

  const parsed = pageViewEventSchema.safeParse(json);

  return parsed.success
    ? { ok: true, event: parsed.data }
    : { ok: false, reason: "invalid_payload" };
}

/** True when the request declares one of the two accepted minimal content types. */
export function isAcceptedContentType(contentType: string | null): boolean {
  if (!contentType) {
    // `navigator.sendBeacon` sends a Blob with an explicit type; a missing type is
    // still a same-origin form submission, so it is accepted and validated.
    return true;
  }

  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  return normalized === "application/json" || normalized === "text/plain";
}
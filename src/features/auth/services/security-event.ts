import "server-only";

import { insertSecurityEvent } from "@/features/auth/repositories/security-event";
import type { SecurityEventType } from "@/generated/prisma/enums";

/**
 * Security event recording.
 *
 * Audit logging must never be the reason a login fails or a mutation aborts, so
 * failures are swallowed after a redacted server-side warning. The event itself
 * is written with an allowlisted metadata shape, which is the last line of
 * defence against accidentally persisting a secret.
 */

/** Metadata keys that may be persisted. Anything else is dropped. */
const ALLOWED_METADATA_KEYS = new Set([
  "reason",
  "controller",
  "sourceBucket",
  "attemptCount",
  "retryAfterSeconds",
  "accountEmail",
  "actorEmail",
  "invitationId",
  "resetTokenId",
  "previousStatus",
  "nextStatus",
  "authVersion",
  "removedBuckets",
  "removedResetTokens",
  "expiresAt",
  "targetType",
  // Phase 5 CMS audit metadata. All values are non-secret bookkeeping strings or
  // counts: slugs, ids, setting keys, MIME types, byte sizes, and changed-field
  // lists. Passwords, hashes, tokens, and cookies are never placed here.
  "linkId",
  "linkSlug",
  "previousSlug",
  "categoryId",
  "categorySlug",
  "previousCategoryId",
  "settingKey",
  "mediaId",
  "storageKey",
  "mimeType",
  "sizeBytes",
  "changedFields",
  "linkCount",
  "position",
  "reassignedCount",
  "deliveryStatus",
]);

const MAX_METADATA_VALUE_LENGTH = 200;

export type SecurityMetadata = Record<string, string | number | boolean | null | undefined>;

/** Drops unrecognised keys and truncates long strings. */
export function redactMetadata(metadata: SecurityMetadata | undefined) {
  if (!metadata) {
    return undefined;
  }

  const safe: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key) || value === undefined) {
      continue;
    }

    safe[key] =
      typeof value === "string" ? value.slice(0, MAX_METADATA_VALUE_LENGTH) : value;
  }

  return Object.keys(safe).length > 0 ? safe : undefined;
}

export type RecordSecurityEventInput = {
  eventType: SecurityEventType;
  adminUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: SecurityMetadata;
};

export async function recordSecurityEvent(input: RecordSecurityEventInput): Promise<void> {
  try {
    await insertSecurityEvent({
      eventType: input.eventType,
      adminUserId: input.adminUserId ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      safeMetadata: redactMetadata(input.metadata) ?? null,
    });
  } catch (error) {
    // Never surface audit failures to the caller, and never print metadata.
    const detail = error instanceof Error ? error.name : "UnknownError";

    console.error(`[auth] failed to record security event ${input.eventType} (${detail})`);
  }
}

import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { SecurityEventType } from "@/generated/prisma/enums";

/**
 * Security event persistence.
 *
 * Insert-only. Callers must pass a `safeMetadata` object that contains no
 * secrets: no passwords, password hashes, JWTs, invitation tokens, reset
 * tokens, `AUTH_SECRET`, or database URLs. The `redactMetadata` helper in the
 * service layer enforces an allowlist on top of this.
 */
export type SecurityEventInput = {
  eventType: SecurityEventType;
  adminUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  safeMetadata?: Prisma.InputJsonValue | null;
};

export async function insertSecurityEvent(input: SecurityEventInput): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      eventType: input.eventType,
      adminUserId: input.adminUserId ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      safeMetadata: input.safeMetadata ?? undefined,
    },
  });
}

/** Reads recent events. Used by tests and by the future Phase 5 audit screens. */
export async function findRecentSecurityEvents(limit = 50) {
  return prisma.securityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
}

export async function countSecurityEventsByType(eventType: SecurityEventType): Promise<number> {
  return prisma.securityEvent.count({ where: { eventType } });
}

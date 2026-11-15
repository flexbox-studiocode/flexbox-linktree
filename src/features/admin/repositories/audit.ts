import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { SecurityEventType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Audit-log reads over the shared append-only `security_events` trail.
 *
 * Phase 5 reuses the Phase 4 table instead of creating a second history. Only
 * safe columns are selected: `safe_metadata` is written through an allowlist in
 * `src/features/auth/services/security-event.ts` and never contains passwords,
 * hashes, tokens, cookies, or raw addresses.
 */

export type AuditEventFilters = {
  eventType?: SecurityEventType | "ALL";
  actorId?: string | "ALL";
  from?: Date;
  to?: Date;
};

export type AuditEventRow = {
  id: string;
  eventType: SecurityEventType;
  targetType: string | null;
  targetId: string | null;
  safeMetadata: unknown;
  createdAt: Date;
  actor: { id: string; fullName: string; email: string } | null;
};

function buildWhere(filters: AuditEventFilters): Prisma.SecurityEventWhereInput {
  return {
    ...(filters.eventType && filters.eventType !== "ALL" ? { eventType: filters.eventType } : {}),
    ...(filters.actorId && filters.actorId !== "ALL" ? { adminUserId: filters.actorId } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };
}

export async function findAuditEvents(params: {
  filters: AuditEventFilters;
  page: number;
  pageSize: number;
}): Promise<AuditEventRow[]> {
  const rows = await prisma.securityEvent.findMany({
    where: buildWhere(params.filters),
    orderBy: { createdAt: "desc" },
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
    select: {
      id: true,
      eventType: true,
      targetType: true,
      targetId: true,
      safeMetadata: true,
      createdAt: true,
      adminUser: { select: { id: true, fullName: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    targetType: row.targetType,
    targetId: row.targetId,
    safeMetadata: row.safeMetadata,
    createdAt: row.createdAt,
    actor: row.adminUser,
  }));
}

export async function countAuditEvents(filters: AuditEventFilters): Promise<number> {
  return prisma.securityEvent.count({ where: buildWhere(filters) });
}

/** Distinct event types that actually occur, for the filter dropdown. */
export async function findAuditEventTypes(): Promise<SecurityEventType[]> {
  const rows = await prisma.securityEvent.findMany({
    distinct: ["eventType"],
    orderBy: { eventType: "asc" },
    select: { eventType: true },
  });

  return rows.map((row) => row.eventType);
}

/** Administrators that appear as actors, for the filter dropdown. */
export async function findAuditActors(): Promise<{ id: string; fullName: string; email: string }[]> {
  return prisma.adminUser.findMany({
    orderBy: [{ fullName: "asc" }],
    select: { id: true, fullName: true, email: true },
  });
}

export async function countAuditEventsSince(from: Date): Promise<number> {
  return prisma.securityEvent.count({ where: { createdAt: { gte: from } } });
}

export async function findRecentAuditEvents(limit = 8): Promise<AuditEventRow[]> {
  return findAuditEvents({ filters: {}, page: 1, pageSize: Math.min(Math.max(limit, 1), 50) });
}

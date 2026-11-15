import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { PublicCategoryRecord } from "@/features/content/mappers/public-content";

/**
 * Public content queries. Every filter that defines "public" is applied in SQL
 * so an ineligible record can never reach a React component:
 *
 *   PublicLink = status PUBLISHED AND link active AND owning category active
 *
 * Ordering is deterministic: `sortOrder` first, then `slug` as the stable
 * tie-breaker. Indexes backing these paths are declared in `prisma/schema.prisma`.
 */
export async function findPublicCategories(): Promise<PublicCategoryRecord[]> {
  return prisma.category.findMany({
    where: {
      isActive: true,
      links: { some: { status: "PUBLISHED", isActive: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    include: {
      links: {
        where: { status: "PUBLISHED", isActive: true },
        orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      },
    },
  });
}

/** Reads every site setting row. Values are validated by key in the service. */
export async function findSiteSettings(): Promise<Record<string, unknown>> {
  const rows = await prisma.siteSetting.findMany({
    select: { key: true, value: true },
    orderBy: { key: "asc" },
  });

  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

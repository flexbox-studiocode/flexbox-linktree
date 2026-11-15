import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { LinkDestinationType, PublicationStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Administrator content queries.
 *
 * These queries are deliberately separate from `repositories/content.ts`, which
 * serves the public page: the admin surface must read drafts, archived records,
 * and inactive rows, and it must not reuse the public eligibility filter.
 *
 * Every query selects explicit columns (no `include: { category: true }`) and
 * applies server-side pagination so the CMS never issues an unbounded read.
 */

export type AdminLinkRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  tag: string | null;
  destinationType: LinkDestinationType;
  destinationUrl: string | null;
  internalAnchor: string | null;
  status: PublicationStatus;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: Date | null;
  updatedAt: Date;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  categoryActive: boolean;
};

const ADMIN_LINK_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  icon: true,
  tag: true,
  destinationType: true,
  destinationUrl: true,
  internalAnchor: true,
  status: true,
  isActive: true,
  isFeatured: true,
  sortOrder: true,
  publishedAt: true,
  updatedAt: true,
  categoryId: true,
  category: { select: { name: true, slug: true, isActive: true } },
} as const;

function toAdminLinkRow(row: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  tag: string | null;
  destinationType: LinkDestinationType;
  destinationUrl: string | null;
  internalAnchor: string | null;
  status: PublicationStatus;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: Date | null;
  updatedAt: Date;
  categoryId: string;
  category: { name: string; slug: string; isActive: boolean };
}): AdminLinkRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    icon: row.icon,
    tag: row.tag,
    destinationType: row.destinationType,
    destinationUrl: row.destinationUrl,
    internalAnchor: row.internalAnchor,
    status: row.status,
    isActive: row.isActive,
    isFeatured: row.isFeatured,
    sortOrder: row.sortOrder,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    categorySlug: row.category.slug,
    categoryActive: row.category.isActive,
  };
}

export type AdminLinkFilters = {
  search?: string;
  categoryId?: string;
  status?: PublicationStatus | "ALL";
  active?: "ALL" | "ACTIVE" | "INACTIVE";
};

function buildLinkWhere(filters: AdminLinkFilters): Prisma.LinkWhereInput {
  return {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.active === "ACTIVE" ? { isActive: true } : {}),
    ...(filters.active === "INACTIVE" ? { isActive: false } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            { slug: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function findAdminLinks(params: {
  filters: AdminLinkFilters;
  page: number;
  pageSize: number;
}): Promise<AdminLinkRow[]> {
  const rows = await prisma.link.findMany({
    where: buildLinkWhere(params.filters),
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { slug: "asc" }],
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
    select: ADMIN_LINK_SELECT,
  });

  return rows.map(toAdminLinkRow);
}

export async function countAdminLinks(filters: AdminLinkFilters): Promise<number> {
  return prisma.link.count({ where: buildLinkWhere(filters) });
}

export async function findAdminLinkById(id: string): Promise<AdminLinkRow | null> {
  const row = await prisma.link.findUnique({ where: { id }, select: ADMIN_LINK_SELECT });

  return row ? toAdminLinkRow(row) : null;
}

export async function findLinkBySlug(slug: string): Promise<{ id: string } | null> {
  return prisma.link.findUnique({ where: { slug }, select: { id: true } });
}

export async function findMaxLinkSortOrder(categoryId: string): Promise<number> {
  const result = await prisma.link.aggregate({
    where: { categoryId },
    _max: { sortOrder: true },
  });

  return result._max.sortOrder ?? 0;
}

/** Neighbour lookup for up/down reordering inside one category. */
export async function findLinkNeighbour(params: {
  categoryId: string;
  sortOrder: number;
  direction: "up" | "down";
  excludeId: string;
}) {
  const where: Prisma.LinkWhereInput = {
    categoryId: params.categoryId,
    id: { not: params.excludeId },
    ...(params.direction === "up"
      ? { sortOrder: { lt: params.sortOrder } }
      : { sortOrder: { gt: params.sortOrder } }),
  };

  return prisma.link.findFirst({
    where,
    orderBy: { sortOrder: params.direction === "up" ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });
}

export type AdminCategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  updatedAt: Date;
  linkCount: number;
};

export type AdminCategoryFilters = {
  search?: string;
  active?: "ALL" | "ACTIVE" | "INACTIVE";
};

function buildCategoryWhere(filters: AdminCategoryFilters): Prisma.CategoryWhereInput {
  return {
    ...(filters.active === "ACTIVE" ? { isActive: true } : {}),
    ...(filters.active === "INACTIVE" ? { isActive: false } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { slug: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function findAdminCategories(params: {
  filters: AdminCategoryFilters;
  page: number;
  pageSize: number;
}): Promise<AdminCategoryRow[]> {
  const rows = await prisma.category.findMany({
    where: buildCategoryWhere(params.filters),
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      sortOrder: true,
      isActive: true,
      updatedAt: true,
      _count: { select: { links: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    linkCount: row._count.links,
  }));
}

export async function countAdminCategories(filters: AdminCategoryFilters): Promise<number> {
  return prisma.category.count({ where: buildCategoryWhere(filters) });
}

export async function findAdminCategoryById(id: string): Promise<AdminCategoryRow | null> {
  const row = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      sortOrder: true,
      isActive: true,
      updatedAt: true,
      _count: { select: { links: true } },
    },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    linkCount: row._count.links,
  };
}

export async function findCategoryIdBySlug(slug: string): Promise<{ id: string } | null> {
  return prisma.category.findUnique({ where: { slug }, select: { id: true } });
}

export async function findAllCategoryOptions(): Promise<
  { id: string; name: string; slug: string; isActive: boolean; linkCount: number }[]
> {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    select: { id: true, name: true, slug: true, isActive: true, _count: { select: { links: true } } },
  }).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      isActive: row.isActive,
      linkCount: row._count.links,
    })),
  );
}

export async function findMaxCategorySortOrder(): Promise<number> {
  const result = await prisma.category.aggregate({ _max: { sortOrder: true } });

  return result._max.sortOrder ?? 0;
}

export async function findCategoryNeighbour(params: {
  sortOrder: number;
  direction: "up" | "down";
  excludeId: string;
}) {
  return prisma.category.findFirst({
    where: {
      id: { not: params.excludeId },
      ...(params.direction === "up"
        ? { sortOrder: { lt: params.sortOrder } }
        : { sortOrder: { gt: params.sortOrder } }),
    },
    orderBy: { sortOrder: params.direction === "up" ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });
}

export type AdminSettingRow = {
  key: string;
  value: unknown;
  updatedAt: Date;
};

export async function findAdminSettings(): Promise<AdminSettingRow[]> {
  const rows = await prisma.siteSetting.findMany({
    orderBy: { key: "asc" },
    select: { key: true, value: true, updatedAt: true },
  });

  return rows;
}

export type ContentCounts = {
  categories: number;
  activeCategories: number;
  links: number;
  drafts: number;
  published: number;
  archived: number;
  inactiveLinks: number;
  inactiveCategories: number;
};

export async function getContentCounts(): Promise<ContentCounts> {
  const [categories, activeCategories, drafts, published, archived, inactiveLinks, inactiveCategories] =
    await Promise.all([
      prisma.category.count(),
      prisma.category.count({ where: { isActive: true } }),
      prisma.link.count({ where: { status: "DRAFT" } }),
      prisma.link.count({ where: { status: "PUBLISHED" } }),
      prisma.link.count({ where: { status: "ARCHIVED" } }),
      prisma.link.count({ where: { isActive: false } }),
      prisma.category.count({ where: { isActive: false } }),
    ]);

  return {
    categories,
    activeCategories,
    links: drafts + published + archived,
    drafts,
    published,
    archived,
    inactiveLinks,
    inactiveCategories,
  };
}

export async function findRecentlyUpdatedLinks(limit = 5) {
  return prisma.link.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, title: true, slug: true, status: true, updatedAt: true },
  });
}

export async function findRecentlyUpdatedCategories(limit = 5) {
  return prisma.category.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, name: true, slug: true, isActive: true, updatedAt: true },
  });
}

import "server-only";

import { revalidatePath, updateTag } from "next/cache";

import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import type { LinkDestinationType, PublicationStatus } from "@/generated/prisma/enums";
import { categorySchema } from "@/features/content/schemas/category";
import { linkSchema, publicationTransitionSchema } from "@/features/content/schemas/link";
import { publicContentCacheTag } from "@/features/content/services/cache-tag";
import { recordSecurityEvent } from "@/features/auth/services/security-event";
import { isValidSlug, slugify } from "@/lib/utils/slug";

/**
 * Administrator content mutations for links and categories.
 *
 * Every function here assumes the caller has already passed
 * `requireAdminAction()`. It re-validates with the shared Zod schemas, applies
 * the publication-timestamp rules, records an audit event, and invalidates the
 * public content cache. Authorization is still repeated in the Server Action
 * layer; this module is never imported by a Client Component.
 */

export type ContentErrorCode =
  | "invalid_input"
  | "not_found"
  | "duplicate_slug"
  | "invalid_category"
  | "invalid_transition"
  | "category_not_empty"
  | "same_category"
  | "store_failure";

export class ContentAdminError extends Error {
  readonly code: ContentErrorCode;

  constructor(code: ContentErrorCode, message: string) {
    super(message);
    this.name = "ContentAdminError";
    this.code = code;
  }
}

export type ActorContext = { adminId: string; actorEmail: string };

/** Invalidates the public content cache after a successful mutation. */
export function invalidatePublicContent(): void {
  try {
    updateTag(publicContentCacheTag);
    revalidatePath("/");
  } catch {
    // Cache invalidation must never fail a committed mutation. The one-minute
    // `cacheLife` window still bounds staleness if this throws.
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export type LinkDraft = {
  slug: string;
  categoryId: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  tag?: string | null;
  destinationType: LinkDestinationType;
  destinationUrl?: string | null;
  internalAnchor?: string | null;
  status: PublicationStatus;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
};

/**
 * Resolves the publication timestamp from the requested status.
 *
 * - PUBLISHED keeps the first publication instant and sets it on first publish.
 * - DRAFT always clears it.
 * - ARCHIVED keeps whatever instant already exists.
 */
export function resolvePublishedAt(params: {
  status: PublicationStatus;
  existing: Date | null;
  now?: Date;
}): Date | null {
  if (params.status === "DRAFT") {
    return null;
  }

  if (params.status === "PUBLISHED") {
    return params.existing ?? params.now ?? new Date();
  }

  return params.existing ?? null;
}

/** Validates a link draft and normalizes the slug and publication timestamp. */
export function normalizeLinkDraft(draft: LinkDraft, existing?: { publishedAt: Date | null; slug: string }) {
  const slug = draft.slug.trim().length > 0 ? draft.slug.trim() : slugify(draft.title);

  if (!isValidSlug(slug)) {
    throw new ContentAdminError(
      "invalid_input",
      "Slug tidak valid. Gunakan huruf kecil, angka, dan tanda hubung.",
    );
  }

  const candidate = {
    slug,
    categoryId: draft.categoryId,
    title: draft.title,
    description: draft.description ?? null,
    icon: draft.icon ?? null,
    tag: draft.tag ?? null,
    destinationType: draft.destinationType,
    destinationUrl: draft.destinationType === "EXTERNAL" ? draft.destinationUrl ?? null : null,
    internalAnchor: draft.destinationType === "INTERNAL" ? draft.internalAnchor ?? null : null,
    status: draft.status,
    isActive: draft.isActive,
    isFeatured: draft.isFeatured,
    sortOrder: draft.sortOrder,
    publishedAt: resolvePublishedAt({ status: draft.status, existing: existing?.publishedAt ?? null }),
  };

  const parsed = linkSchema.safeParse(candidate);

  if (!parsed.success) {
    const first = parsed.error.issues[0];

    throw new ContentAdminError("invalid_input", first?.message ?? "Data tautan tidak valid.");
  }

  return parsed.data;
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });

  if (!category) {
    throw new ContentAdminError("invalid_category", "Kategori tidak ditemukan.");
  }
}

export type CreateLinkInput = LinkDraft;

export async function createLink(input: { actor: ActorContext; draft: CreateLinkInput }) {
  await assertCategoryExists(input.draft.categoryId);

  const draft = input.draft;
  const sortOrder =
    draft.sortOrder > 0 ? draft.sortOrder : (await prisma.link.aggregate({ where: { categoryId: draft.categoryId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0;

  const data = normalizeLinkDraft({ ...draft, sortOrder: draft.sortOrder > 0 ? draft.sortOrder : sortOrder + 1 });

  try {
    const created = await prisma.link.create({
      data: {
        slug: data.slug,
        categoryId: data.categoryId,
        title: data.title,
        description: data.description ?? null,
        icon: data.icon ?? null,
        tag: data.tag ?? null,
        destinationType: data.destinationType,
        destinationUrl: data.destinationUrl ?? null,
        internalAnchor: data.internalAnchor ?? null,
        status: data.status,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        sortOrder: data.sortOrder,
        publishedAt: data.publishedAt ?? null,
      },
      select: { id: true, slug: true, status: true, categoryId: true },
    });

    await recordSecurityEvent({
      eventType: "LINK_CREATED",
      adminUserId: input.actor.adminId,
      targetType: "link",
      targetId: created.id,
      metadata: {
        actorEmail: input.actor.actorEmail,
        linkSlug: created.slug,
        nextStatus: created.status,
        categoryId: created.categoryId,
      },
    });

    invalidatePublicContent();

    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ContentAdminError("duplicate_slug", "Slug sudah digunakan oleh tautan lain.");
    }

    throw error;
  }
}

export async function updateLink(input: {
  actor: ActorContext;
  linkId: string;
  draft: LinkDraft;
}) {
  const existing = await prisma.link.findUnique({
    where: { id: input.linkId },
    select: { id: true, slug: true, status: true, publishedAt: true, categoryId: true },
  });

  if (!existing) {
    throw new ContentAdminError("not_found", "Tautan tidak ditemukan.");
  }

  await assertCategoryExists(input.draft.categoryId);

  const data = normalizeLinkDraft(input.draft, existing);

  try {
    const updated = await prisma.link.update({
      where: { id: existing.id },
      data: {
        slug: data.slug,
        categoryId: data.categoryId,
        title: data.title,
        description: data.description ?? null,
        icon: data.icon ?? null,
        tag: data.tag ?? null,
        destinationType: data.destinationType,
        destinationUrl: data.destinationUrl ?? null,
        internalAnchor: data.internalAnchor ?? null,
        status: data.status,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        sortOrder: data.sortOrder,
        publishedAt: data.publishedAt ?? null,
      },
      select: { id: true, slug: true, status: true, categoryId: true },
    });

    await recordSecurityEvent({
      eventType: "LINK_UPDATED",
      adminUserId: input.actor.adminId,
      targetType: "link",
      targetId: updated.id,
      metadata: {
        actorEmail: input.actor.actorEmail,
        linkSlug: updated.slug,
        previousSlug: existing.slug,
        nextStatus: updated.status,
      },
    });

    if (existing.status !== updated.status) {
      await recordSecurityEvent({
        eventType: publicationEventType(existing.status, updated.status),
        adminUserId: input.actor.adminId,
        targetType: "link",
        targetId: updated.id,
        metadata: {
          actorEmail: input.actor.actorEmail,
          linkSlug: updated.slug,
          previousStatus: existing.status,
          nextStatus: updated.status,
        },
      });
    }

    invalidatePublicContent();

    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ContentAdminError("duplicate_slug", "Slug sudah digunakan oleh tautan lain.");
    }

    throw error;
  }
}

function publicationEventType(
  from: PublicationStatus,
  to: PublicationStatus,
): "LINK_PUBLISHED" | "LINK_UNPUBLISHED" | "LINK_ARCHIVED" | "LINK_RESTORED" {
  if (to === "PUBLISHED") {
    return from === "ARCHIVED" ? "LINK_RESTORED" : "LINK_PUBLISHED";
  }

  if (to === "ARCHIVED") {
    return "LINK_ARCHIVED";
  }

  return from === "ARCHIVED" ? "LINK_RESTORED" : "LINK_UNPUBLISHED";
}

/** Applies a deliberate publication transition with the documented timestamp rule. */
export async function transitionLinkStatus(input: {
  actor: ActorContext;
  linkId: string;
  to: PublicationStatus;
}) {
  const existing = await prisma.link.findUnique({
    where: { id: input.linkId },
    select: { id: true, slug: true, status: true, publishedAt: true },
  });

  if (!existing) {
    throw new ContentAdminError("not_found", "Tautan tidak ditemukan.");
  }

  const transition = publicationTransitionSchema.safeParse({ from: existing.status, to: input.to });

  if (!transition.success) {
    throw new ContentAdminError("invalid_transition", "Perubahan status publikasi tidak diizinkan.");
  }

  if (existing.status === input.to) {
    return { id: existing.id, status: existing.status, slug: existing.slug };
  }

  const updated = await prisma.link.update({
    where: { id: existing.id },
    data: {
      status: input.to,
      publishedAt: resolvePublishedAt({ status: input.to, existing: existing.publishedAt }),
    },
    select: { id: true, slug: true, status: true },
  });

  await recordSecurityEvent({
    eventType: publicationEventType(existing.status, input.to),
    adminUserId: input.actor.adminId,
    targetType: "link",
    targetId: updated.id,
    metadata: {
      actorEmail: input.actor.actorEmail,
      linkSlug: updated.slug,
      previousStatus: existing.status,
      nextStatus: updated.status,
    },
  });

  invalidatePublicContent();

  return updated;
}

export async function setLinkActive(input: { actor: ActorContext; linkId: string; isActive: boolean }) {
  const updated = await prisma.link.update({
    where: { id: input.linkId },
    data: { isActive: input.isActive },
    select: { id: true, slug: true, isActive: true },
  });

  await recordSecurityEvent({
    eventType: "LINK_UPDATED",
    adminUserId: input.actor.adminId,
    targetType: "link",
    targetId: updated.id,
    metadata: {
      actorEmail: input.actor.actorEmail,
      linkSlug: updated.slug,
      changedFields: `isActive=${updated.isActive}`,
    },
  });

  invalidatePublicContent();

  return updated;
}

export async function setLinkFeatured(input: {
  actor: ActorContext;
  linkId: string;
  isFeatured: boolean;
}) {
  const updated = await prisma.link.update({
    where: { id: input.linkId },
    data: { isFeatured: input.isFeatured },
    select: { id: true, slug: true, isFeatured: true },
  });

  await recordSecurityEvent({
    eventType: "LINK_UPDATED",
    adminUserId: input.actor.adminId,
    targetType: "link",
    targetId: updated.id,
    metadata: {
      actorEmail: input.actor.actorEmail,
      linkSlug: updated.slug,
      changedFields: `isFeatured=${updated.isFeatured}`,
    },
  });

  return updated;
}

/** Swaps the sort order with the adjacent link in the same category. */
export async function reorderLink(input: {
  actor: ActorContext;
  linkId: string;
  direction: "up" | "down";
}) {
  const link = await prisma.link.findUnique({
    where: { id: input.linkId },
    select: { id: true, slug: true, categoryId: true, sortOrder: true },
  });

  if (!link) {
    throw new ContentAdminError("not_found", "Tautan tidak ditemukan.");
  }

  const neighbour = await prisma.link.findFirst({
    where: {
      categoryId: link.categoryId,
      id: { not: link.id },
      ...(input.direction === "up" ? { sortOrder: { lt: link.sortOrder } } : { sortOrder: { gt: link.sortOrder } }),
    },
    orderBy: { sortOrder: input.direction === "up" ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });

  if (!neighbour) {
    return { moved: false as const };
  }

  // Swap inside a transaction so the two rows cannot end up with one order value.
  const [first, second] = link.sortOrder <= neighbour.sortOrder ? [link, neighbour] : [neighbour, link];

  await prisma.$transaction([
    prisma.link.update({ where: { id: first.id }, data: { sortOrder: second.sortOrder } }),
    prisma.link.update({ where: { id: second.id }, data: { sortOrder: first.sortOrder } }),
  ]);

  await recordSecurityEvent({
    eventType: "LINK_REORDERED",
    adminUserId: input.actor.adminId,
    targetType: "link",
    targetId: link.id,
    metadata: { actorEmail: input.actor.actorEmail, linkSlug: link.slug, position: input.direction },
  });

  invalidatePublicContent();

  return { moved: true as const };
}

export async function deleteLink(input: { actor: ActorContext; linkId: string }) {
  const existing = await prisma.link.findUnique({
    where: { id: input.linkId },
    select: { id: true, slug: true, status: true },
  });

  if (!existing) {
    throw new ContentAdminError("not_found", "Tautan tidak ditemukan.");
  }

  await prisma.link.delete({ where: { id: existing.id } });

  await recordSecurityEvent({
    eventType: "LINK_DELETED",
    adminUserId: input.actor.adminId,
    targetType: "link",
    targetId: existing.id,
    metadata: {
      actorEmail: input.actor.actorEmail,
      linkSlug: existing.slug,
      previousStatus: existing.status,
    },
  });

  invalidatePublicContent();

  return { id: existing.id };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryDraft = {
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  sortOrder: number;
  isActive: boolean;
};

function normalizeCategoryDraft(draft: CategoryDraft) {
  const slug = draft.slug.trim().length > 0 ? draft.slug.trim() : slugify(draft.name);

  if (!isValidSlug(slug)) {
    throw new ContentAdminError(
      "invalid_input",
      "Slug kategori tidak valid. Gunakan huruf kecil, angka, dan tanda hubung.",
    );
  }

  const parsed = categorySchema.safeParse({
    name: draft.name,
    slug,
    description: draft.description ?? null,
    icon: draft.icon ?? null,
    sortOrder: draft.sortOrder,
    isActive: draft.isActive,
  });

  if (!parsed.success) {
    throw new ContentAdminError("invalid_input", parsed.error.issues[0]?.message ?? "Data kategori tidak valid.");
  }

  return parsed.data;
}

export async function createCategory(input: { actor: ActorContext; draft: CategoryDraft }) {
  const draft = input.draft;
  const nextOrder =
    draft.sortOrder > 0
      ? draft.sortOrder
      : ((await prisma.category.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1;

  const data = normalizeCategoryDraft({ ...draft, sortOrder: nextOrder });

  try {
    const created = await prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        icon: data.icon ?? null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
      select: { id: true, slug: true, name: true },
    });

    await recordSecurityEvent({
      eventType: "CATEGORY_CREATED",
      adminUserId: input.actor.adminId,
      targetType: "category",
      targetId: created.id,
      metadata: { actorEmail: input.actor.actorEmail, categorySlug: created.slug },
    });

    invalidatePublicContent();

    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ContentAdminError("duplicate_slug", "Slug sudah digunakan oleh kategori lain.");
    }

    throw error;
  }
}

export async function updateCategory(input: { actor: ActorContext; categoryId: string; draft: CategoryDraft }) {
  const existing = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, slug: true },
  });

  if (!existing) {
    throw new ContentAdminError("not_found", "Kategori tidak ditemukan.");
  }

  const data = normalizeCategoryDraft(input.draft);

  try {
    const updated = await prisma.category.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        icon: data.icon ?? null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
      select: { id: true, slug: true, name: true, isActive: true },
    });

    await recordSecurityEvent({
      eventType: "CATEGORY_UPDATED",
      adminUserId: input.actor.adminId,
      targetType: "category",
      targetId: updated.id,
      metadata: {
        actorEmail: input.actor.actorEmail,
        categorySlug: updated.slug,
        previousSlug: existing.slug,
      },
    });

    invalidatePublicContent();

    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ContentAdminError("duplicate_slug", "Slug sudah digunakan oleh kategori lain.");
    }

    throw error;
  }
}

export async function setCategoryActive(input: {
  actor: ActorContext;
  categoryId: string;
  isActive: boolean;
}) {
  const existing = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, slug: true, isActive: true },
  });

  if (!existing) {
    throw new ContentAdminError("not_found", "Kategori tidak ditemukan.");
  }

  const updated = await prisma.category.update({
    where: { id: existing.id },
    data: { isActive: input.isActive },
    select: { id: true, slug: true, isActive: true },
  });

  await recordSecurityEvent({
    eventType: updated.isActive ? "CATEGORY_ACTIVATED" : "CATEGORY_DEACTIVATED",
    adminUserId: input.actor.adminId,
    targetType: "category",
    targetId: updated.id,
    metadata: {
      actorEmail: input.actor.actorEmail,
      categorySlug: updated.slug,
      previousStatus: existing.isActive ? "ACTIVE" : "INACTIVE",
      nextStatus: updated.isActive ? "ACTIVE" : "INACTIVE",
    },
  });

  invalidatePublicContent();

  return updated;
}

export async function reorderCategory(input: { actor: ActorContext; categoryId: string; direction: "up" | "down" }) {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, slug: true, sortOrder: true },
  });

  if (!category) {
    throw new ContentAdminError("not_found", "Kategori tidak ditemukan.");
  }

  const neighbour = await prisma.category.findFirst({
    where: {
      id: { not: category.id },
      ...(input.direction === "up" ? { sortOrder: { lt: category.sortOrder } } : { sortOrder: { gt: category.sortOrder } }),
    },
    orderBy: { sortOrder: input.direction === "up" ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });

  if (!neighbour) {
    return { moved: false as const };
  }

  const [first, second] = category.sortOrder <= neighbour.sortOrder ? [category, neighbour] : [neighbour, category];

  await prisma.$transaction([
    prisma.category.update({ where: { id: first.id }, data: { sortOrder: second.sortOrder } }),
    prisma.category.update({ where: { id: second.id }, data: { sortOrder: first.sortOrder } }),
  ]);

  await recordSecurityEvent({
    eventType: "CATEGORY_REORDERED",
    adminUserId: input.actor.adminId,
    targetType: "category",
    targetId: category.id,
    metadata: { actorEmail: input.actor.actorEmail, categorySlug: category.slug, position: input.direction },
  });

  invalidatePublicContent();

  return { moved: true as const };
}

export async function deleteCategory(input: { actor: ActorContext; categoryId: string }) {
  const existing = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, slug: true, _count: { select: { links: true } } },
  });

  if (!existing) {
    throw new ContentAdminError("not_found", "Kategori tidak ditemukan.");
  }

  if (existing._count.links > 0) {
    throw new ContentAdminError(
      "category_not_empty",
      "Kategori masih memiliki tautan. Pindahkan tautan tersebut terlebih dahulu.",
    );
  }

  await prisma.category.delete({ where: { id: existing.id } });

  await recordSecurityEvent({
    eventType: "CATEGORY_DELETED",
    adminUserId: input.actor.adminId,
    targetType: "category",
    targetId: existing.id,
    metadata: { actorEmail: input.actor.actorEmail, categorySlug: existing.slug },
  });

  invalidatePublicContent();

  return { id: existing.id };
}

/** Moves every link from one category to another, then deletes the empty source. */
export async function reassignAndDeleteCategory(input: {
  actor: ActorContext;
  categoryId: string;
  targetCategoryId: string;
}) {
  if (input.categoryId === input.targetCategoryId) {
    throw new ContentAdminError("same_category", "Pilih kategori tujuan yang berbeda.");
  }

  const [source, target] = await Promise.all([
    prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true, slug: true, _count: { select: { links: true } } },
    }),
    prisma.category.findUnique({ where: { id: input.targetCategoryId }, select: { id: true, slug: true } }),
  ]);

  if (!source) {
    throw new ContentAdminError("not_found", "Kategori sumber tidak ditemukan.");
  }

  if (!target) {
    throw new ContentAdminError("invalid_category", "Kategori tujuan tidak ditemukan.");
  }

  const moved = await prisma.$transaction(async (tx) => {
    const result = await tx.link.updateMany({
      where: { categoryId: source.id },
      data: { categoryId: target.id },
    });

    await tx.category.delete({ where: { id: source.id } });

    return result.count;
  });

  await recordSecurityEvent({
    eventType: "CATEGORY_DELETED",
    adminUserId: input.actor.adminId,
    targetType: "category",
    targetId: source.id,
    metadata: {
      actorEmail: input.actor.actorEmail,
      categorySlug: source.slug,
      previousCategoryId: target.id,
      reassignedCount: moved,
    },
  });

  invalidatePublicContent();

  return { moved };
}

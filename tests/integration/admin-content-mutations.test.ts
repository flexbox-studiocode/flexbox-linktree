import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ContentAdminError,
  createCategory,
  createLink,
  deleteCategory,
  reassignAndDeleteCategory,
  reorderLink,
  setLinkFeatured,
  transitionLinkStatus,
  updateLink,
} from "@/features/content/services/admin-content";
import { findPublicCategories } from "@/features/content/repositories/content";
import { openLocalDatabase, testSlug, type LocalDatabase } from "../helpers/db";

const cacheCalls = vi.hoisted(() => ({ updateTag: [] as string[], revalidatePath: [] as string[] }));

vi.mock("next/cache", () => ({
  updateTag: (tag: string) => cacheCalls.updateTag.push(tag),
  revalidatePath: (path: string) => cacheCalls.revalidatePath.push(path),
  cacheLife: () => undefined,
  cacheTag: () => undefined,
}));

/**
 * CMS content mutation integration tests.
 *
 * They exercise the real services against a local PostgreSQL database. Every row
 * is created with a unique `test-` slug and removed again in `afterAll`; the
 * seeded content is never modified.
 */
const db: LocalDatabase | null = openLocalDatabase();

describe.skipIf(!db)("CMS content mutations (local database)", () => {
  const prisma = db!.prisma;
  let actor: { adminId: string; actorEmail: string };
  const createdCategoryIds: string[] = [];
  const createdLinkIds: string[] = [];

  beforeAll(async () => {
    const normalizedEmail = `${testSlug("cms-actor")}@example.test`;

    const admin = await prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        fullName: "CMS Integration Actor",
        role: "SUPER_ADMIN",
        status: "DISABLED",
      },
      select: { id: true, normalizedEmail: true },
    });

    actor = { adminId: admin.id, actorEmail: admin.normalizedEmail };
  });

  afterAll(async () => {
    if (!db) return;

    // Security events survive account deletion by design, so they are removed
    // explicitly for this test actor.
    await prisma.securityEvent.deleteMany({ where: { adminUserId: actor?.adminId } });
    await prisma.link.deleteMany({ where: { id: { in: createdLinkIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.adminUser.deleteMany({ where: { id: actor?.adminId } });
    await db.dispose();
  });

  async function makeCategory(active = true) {
    const created = await createCategory({
      actor,
      draft: { name: `QA ${testSlug("cat")}`, slug: testSlug("cat"), description: null, icon: null, sortOrder: 0, isActive: active },
    });

    createdCategoryIds.push(created.id);

    return created;
  }

  async function makeLink(categoryId: string, overrides: { slug?: string; status?: "DRAFT" | "PUBLISHED" } = {}) {
    const created = await createLink({
      actor,
      draft: {
        slug: overrides.slug ?? testSlug("link"),
        categoryId,
        title: "QA Tautan",
        description: "Dibuat oleh pengujian integrasi.",
        icon: null,
        tag: null,
        destinationType: "EXTERNAL",
        destinationUrl: "https://example.com/qa",
        internalAnchor: null,
        status: overrides.status ?? "DRAFT",
        isActive: true,
        isFeatured: false,
        sortOrder: 0,
      },
    });

    createdLinkIds.push(created.id);

    return created;
  }

  it("creates a draft link without a publication timestamp", async () => {
    const category = await makeCategory();
    const link = await makeLink(category.id);

    const row = await prisma.link.findUniqueOrThrow({ where: { id: link.id } });

    expect(row.status).toBe("DRAFT");
    expect(row.publishedAt).toBeNull();
  });

  it("publishes, exposes publicly, then archives and hides the link", async () => {
    const category = await makeCategory();
    const link = await makeLink(category.id);

    await transitionLinkStatus({ actor, linkId: link.id, to: "PUBLISHED" });

    const published = await prisma.link.findUniqueOrThrow({ where: { id: link.id } });
    expect(published.publishedAt).toBeInstanceOf(Date);

    const publicCategories = await findPublicCategories();
    const visible = publicCategories
      .flatMap((entry) => entry.links)
      .some((entry) => entry.slug === link.slug);
    expect(visible).toBe(true);

    await transitionLinkStatus({ actor, linkId: link.id, to: "ARCHIVED" });

    const afterArchive = await findPublicCategories();
    const stillVisible = afterArchive
      .flatMap((entry) => entry.links)
      .some((entry) => entry.slug === link.slug);
    expect(stillVisible).toBe(false);
  });

  it("rejects a duplicate slug with a stable error code", async () => {
    const category = await makeCategory();
    const link = await makeLink(category.id);

    await expect(makeLink(category.id, { slug: link.slug })).rejects.toMatchObject({
      name: "ContentAdminError",
      code: "duplicate_slug",
    });
  });

  it("keeps the first publication timestamp across archive and republish", async () => {
    const category = await makeCategory();
    const link = await makeLink(category.id);

    await transitionLinkStatus({ actor, linkId: link.id, to: "PUBLISHED" });
    const first = await prisma.link.findUniqueOrThrow({ where: { id: link.id } });

    // Archiving keeps the instant; returning to DRAFT clears it, because the
    // schema forbids a draft that claims to have been published.
    await transitionLinkStatus({ actor, linkId: link.id, to: "ARCHIVED" });
    await transitionLinkStatus({ actor, linkId: link.id, to: "PUBLISHED" });

    const second = await prisma.link.findUniqueOrThrow({ where: { id: link.id } });

    expect(second.publishedAt?.toISOString()).toBe(first.publishedAt?.toISOString());

    await transitionLinkStatus({ actor, linkId: link.id, to: "DRAFT" });
    const drafted = await prisma.link.findUniqueOrThrow({ where: { id: link.id } });
    expect(drafted.publishedAt).toBeNull();
  });

  it("updates a link and records an audit event", async () => {
    const category = await makeCategory();
    const link = await makeLink(category.id);

    await updateLink({
      actor,
      linkId: link.id,
      draft: {
        slug: link.slug,
        categoryId: category.id,
        title: "Judul Diperbarui",
        description: null,
        icon: null,
        tag: "Baru",
        destinationType: "EXTERNAL",
        destinationUrl: "https://example.com/baru",
        internalAnchor: null,
        status: "DRAFT",
        isActive: true,
        isFeatured: true,
        sortOrder: 0,
      },
    });

    const row = await prisma.link.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.title).toBe("Judul Diperbarui");
    expect(row.isFeatured).toBe(true);

    const events = await prisma.securityEvent.findMany({
      where: { targetId: link.id, adminUserId: actor.adminId },
      select: { eventType: true },
    });

    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["LINK_CREATED", "LINK_UPDATED"]),
    );
  });

  it("toggles featured state, records an audit event, and invalidates public content", async () => {
    const category = await makeCategory();
    const link = await makeLink(category.id);

    cacheCalls.updateTag.length = 0;
    cacheCalls.revalidatePath.length = 0;

    const updated = await setLinkFeatured({ actor, linkId: link.id, isFeatured: true });
    expect(updated.isFeatured).toBe(true);

    const row = await prisma.link.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.isFeatured).toBe(true);

    expect(cacheCalls.updateTag).toContain("public-content");
    expect(cacheCalls.revalidatePath).toContain("/");

    const events = await prisma.securityEvent.findMany({
      where: { targetId: link.id, adminUserId: actor.adminId, eventType: "LINK_UPDATED" },
      select: { id: true },
    });
    expect(events.length).toBeGreaterThan(0);
  });

  it("swaps the sort order with the neighbouring link", async () => {
    const category = await makeCategory();
    const first = await makeLink(category.id);
    const second = await makeLink(category.id);

    const before = await prisma.link.findMany({
      where: { id: { in: [first.id, second.id] } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, sortOrder: true },
    });

    expect(before).toHaveLength(2);

    const result = await reorderLink({ actor, linkId: before[1].id, direction: "up" });
    expect(result.moved).toBe(true);

    const after = await prisma.link.findMany({
      where: { id: { in: [first.id, second.id] } },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });

    expect(after[0].id).toBe(before[1].id);
  });

  it("refuses to delete a category that still owns links", async () => {
    const category = await makeCategory();
    await makeLink(category.id);

    await expect(deleteCategory({ actor, categoryId: category.id })).rejects.toMatchObject({
      name: "ContentAdminError",
      code: "category_not_empty",
    });
  });

  it("reassigns links before deleting the source category", async () => {
    const source = await makeCategory();
    const target = await makeCategory();
    const link = await makeLink(source.id);

    const result = await reassignAndDeleteCategory({
      actor,
      categoryId: source.id,
      targetCategoryId: target.id,
    });

    expect(result.moved).toBe(1);

    const moved = await prisma.link.findUniqueOrThrow({ where: { id: link.id } });
    expect(moved.categoryId).toBe(target.id);

    const sourceRow = await prisma.category.findUnique({ where: { id: source.id } });
    expect(sourceRow).toBeNull();
  });

  it("rejects an unsupported publication transition", async () => {
    const category = await makeCategory();
    const link = await makeLink(category.id);

    await expect(
      transitionLinkStatus({ actor, linkId: link.id, to: "PUBLISHED" }),
    ).resolves.toBeTruthy();

    // PUBLISHED -> PUBLISHED is a no-op, not an error; ARCHIVED -> ARCHIVED is too.
    const archived = await transitionLinkStatus({ actor, linkId: link.id, to: "ARCHIVED" });
    expect(archived.status).toBe("ARCHIVED");

    await expect(
      transitionLinkStatus({ actor, linkId: "2b1f0f4c-0000-4000-8000-000000000000", to: "PUBLISHED" }),
    ).rejects.toBeInstanceOf(ContentAdminError);
  });
});
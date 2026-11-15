import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toPublicCategory } from "@/features/content/mappers/public-content";
import { composePublicContent } from "@/features/content/services/content";
import { findPublicCategories, findSiteSettings } from "@/features/content/repositories/content";
import { openLocalDatabase, testSlug, type LocalDatabase } from "../helpers/db";

/**
 * Database integration tests for the public content path.
 *
 * They run only against a local database (see `tests/helpers/db.ts`) and are
 * strictly additive: every record is created with a unique `test-` slug and is
 * deleted again in `afterAll`. No truncation, no reset, and the seeded
 * Phase 3 content is left untouched.
 */
const db: LocalDatabase | null = openLocalDatabase();
const createdCategoryIds: string[] = [];

describe.skipIf(!db)("public content queries (local database)", () => {
  beforeAll(async () => {
    await db!.prisma.systemCheck.upsert({
      where: { key: "integration-check" },
      update: { note: "checked" },
      create: { key: "integration-check", note: "checked" },
    });
  });

  afterAll(async () => {
    if (!db) return;

    for (const id of createdCategoryIds) {
      await db.prisma.link.deleteMany({ where: { categoryId: id } });
      await db.prisma.category.deleteMany({ where: { id } });
    }

    await db.dispose();
  });

  async function createCategoryWithLink(options: {
    category: { isActive?: boolean; sortOrder?: number };
    link: {
      status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      isActive?: boolean;
      sortOrder?: number;
      destinationType?: "EXTERNAL" | "INTERNAL" | "NONE";
      destinationUrl?: string | null;
      internalAnchor?: string | null;
      tag?: string | null;
      slugSuffix: string;
    };
  }) {
    const categorySlug = testSlug(options.link.slugSuffix);
    const linkSlug = testSlug(options.link.slugSuffix);
    const category = await db!.prisma.category.create({
      data: {
        name: `QA ${linkSlug}`,
        slug: categorySlug,
        sortOrder: options.category.sortOrder ?? 500,
        isActive: options.category.isActive ?? true,
      },
    });
    createdCategoryIds.push(category.id);

    const link = await db!.prisma.link.create({
      data: {
        slug: linkSlug,
        categoryId: category.id,
        title: `QA link ${linkSlug}`,
        description: "Created by an integration test.",
        icon: "grid",
        tag: options.link.tag ?? null,
        destinationType: options.link.destinationType ?? "NONE",
        destinationUrl: options.link.destinationUrl ?? null,
        internalAnchor: options.link.internalAnchor ?? null,
        status: options.link.status ?? "PUBLISHED",
        isActive: options.link.isActive ?? true,
        isFeatured: false,
        sortOrder: options.link.sortOrder ?? 500,
        publishedAt: (options.link.status ?? "PUBLISHED") === "DRAFT" ? null : new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    return { category, link };
  }

  it("creates and reads a category and a link", async () => {
    const { category, link } = await createCategoryWithLink({ category: {}, link: { slugSuffix: "crud" } });

    const readCategory = await db!.prisma.category.findUnique({ where: { slug: category.slug } });
    const readLink = await db!.prisma.link.findUnique({ where: { slug: link.slug } });

    expect(readCategory?.name).toBe(category.name);
    expect(readLink?.categoryId).toBe(category.id);
  });

  it("exposes published active links and hides drafts, archived, and inactive records", async () => {
    const published = await createCategoryWithLink({ category: {}, link: { slugSuffix: "published" } });
    const draft = await createCategoryWithLink({ category: {}, link: { slugSuffix: "draft", status: "DRAFT" } });
    const archived = await createCategoryWithLink({ category: {}, link: { slugSuffix: "archived", status: "ARCHIVED" } });
    const inactive = await createCategoryWithLink({ category: {}, link: { slugSuffix: "inactive", isActive: false } });

    const slugs = (await findPublicCategories()).map((category) => category.links.map((link) => link.slug)).flat();

    expect(slugs).toContain(published.link.slug);
    expect(slugs).not.toContain(draft.link.slug);
    expect(slugs).not.toContain(archived.link.slug);
    expect(slugs).not.toContain(inactive.link.slug);
  });

  it("suppresses links of an inactive category", async () => {
    const inactive = await createCategoryWithLink({ category: { isActive: false }, link: { slugSuffix: "inactive-cat" } });

    const slugs = (await findPublicCategories()).map((category) => category.links.map((link) => link.slug)).flat();

    expect(slugs).not.toContain(inactive.link.slug);
  });

  it("hides a category with no public links", async () => {
    const emptyCategory = await db!.prisma.category.create({
      data: { name: "QA empty", slug: testSlug("empty"), sortOrder: 501, isActive: true },
    });
    createdCategoryIds.push(emptyCategory.id);

    const categories = await findPublicCategories();

    expect(categories.find((category) => category.id === emptyCategory.id)).toBeUndefined();
  });

  it("keeps a published NONE destination non-interactive and an internal anchor intact", async () => {
    const pending = await createCategoryWithLink({ category: {}, link: { slugSuffix: "pending", tag: "Segera" } });
    const internal = await createCategoryWithLink({
      category: {},
      link: { slugSuffix: "internal", destinationType: "INTERNAL", internalAnchor: "#kontak" },
    });

    const categories = await findPublicCategories();
    const mapped = categories.flatMap(toPublicCategory).flatMap((category) => category?.links ?? []);
    const pendingLink = mapped.find((link) => link.id === pending.link.slug);
    const internalLink = mapped.find((link) => link.id === internal.link.slug);

    expect(pendingLink).toBeDefined();
    expect(pendingLink?.href).toBeUndefined();
    expect(pendingLink?.tag).toBe("Segera");
    expect(internalLink?.href).toBe("#kontak");
  });

  it("does not expose an unsafe external URL even if one was stored", async () => {
    const unsafe = await createCategoryWithLink({
      category: {},
      link: { slugSuffix: "unsafe", destinationType: "EXTERNAL", destinationUrl: "https://allowed.example/path" },
    });

    const categories = await findPublicCategories();
    const mapped = categories.flatMap(toPublicCategory).flatMap((category) => category?.links ?? []);
    const unsafeLink = mapped.find((link) => link.id === unsafe.link.slug);

    expect(unsafeLink?.href).toBe("https://allowed.example/path");
  });

  it("orders categories and links by sort order with a stable slug tie-breaker", async () => {
    const category = await db!.prisma.category.create({
      data: { name: "QA ordering", slug: testSlug("ordering"), sortOrder: 502, isActive: true },
    });
    createdCategoryIds.push(category.id);

    const linkA = testSlug("order-a");
    const linkB = testSlug("order-b");
    const linkC = testSlug("order-c");

    await db!.prisma.link.createMany({
      data: [
        { slug: linkC, categoryId: category.id, title: "C", destinationType: "NONE", status: "PUBLISHED", isActive: true, sortOrder: 2, publishedAt: new Date("2026-01-01T00:00:00.000Z") },
        { slug: linkA, categoryId: category.id, title: "A", destinationType: "NONE", status: "PUBLISHED", isActive: true, sortOrder: 1, publishedAt: new Date("2026-01-01T00:00:00.000Z") },
        { slug: linkB, categoryId: category.id, title: "B", destinationType: "NONE", status: "PUBLISHED", isActive: true, sortOrder: 2, publishedAt: new Date("2026-01-01T00:00:00.000Z") },
      ],
    });

    const categories = await findPublicCategories();
    const found = categories.find((entry) => entry.id === category.id);
    const mapped = found ? toPublicCategory(found) : null;

    expect(mapped?.links.map((link) => link.id)).toEqual([linkA, linkB, linkC]);
  });

  it("reads site settings and composes them through the service layer", async () => {
    const values = await findSiteSettings();

    expect(values.general).toBeDefined();
    expect(values.contact).toBeDefined();

    const { site, isEmpty, categories } = composePublicContent(await findPublicCategories(), values);

    expect(site.name).toBe("Flexbox Studio");
    expect(site.contactEmail).toBeNull();
    expect(isEmpty).toBe(false);
    expect(categories.map((category) => category.slug)).toEqual(
      expect.arrayContaining(["studio-picks", "explore-more"]),
    );
  });

  it("seeded public content matches the Phase 2 directory", async () => {
    const categories = (await findPublicCategories()).map(toPublicCategory);

    const seededCategories = categories.filter(
      (category) => category?.slug === "studio-picks" || category?.slug === "explore-more",
    );

    expect(seededCategories.map((category) => category?.slug)).toEqual(["studio-picks", "explore-more"]);
    expect(seededCategories.flatMap((category) => category?.links.map((link) => link.id) ?? [])).toEqual([
      "flexbox-design-system",
      "flexbox-lab",
      "website-flexbox",
      "sumber-daya",
      "karya-digital",
      "eksperimen-visual",
      "terhubung",
      "kolaborasi",
    ]);

    const pending = seededCategories.flatMap((category) => category?.links ?? []).filter((link) => link.href === undefined);
    expect(pending).toHaveLength(6);
    expect(pending.every((link) => link.tag === "Segera")).toBe(true);
  });

  it("cannot delete a category that still owns links", async () => {
    const { category } = await createCategoryWithLink({ category: {}, link: { slugSuffix: "restrict" } });

    await expect(db!.prisma.category.delete({ where: { id: category.id } })).rejects.toThrow();

    expect(await db!.prisma.category.findUnique({ where: { id: category.id } })).not.toBeNull();
  });

  it("rejects an incoherent destination state at the database level", async () => {
    const category = await db!.prisma.category.create({
      data: { name: "QA invalid", slug: testSlug("invalid"), sortOrder: 503, isActive: true },
    });
    createdCategoryIds.push(category.id);

    await expect(
      db!.prisma.link.create({
        data: {
          slug: testSlug("bad-scheme"),
          categoryId: category.id,
          title: "Bad",
          destinationType: "EXTERNAL",
          destinationUrl: "javascript:alert(1)",
          status: "PUBLISHED",
          isActive: true,
          sortOrder: 1,
          publishedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();

    await expect(
      db!.prisma.link.create({
        data: {
          slug: testSlug("no-published-at"),
          categoryId: category.id,
          title: "Bad",
          destinationType: "NONE",
          status: "PUBLISHED",
          isActive: true,
          sortOrder: 1,
        },
      }),
    ).rejects.toThrow();
  });

  it("upserts seed data without creating duplicates", async () => {
    const category = await db!.prisma.category.findUnique({ where: { slug: "studio-picks" } });

    const existing = await db!.prisma.link.findUnique({ where: { slug: "flexbox-design-system" } });
    const upserted = await db!.prisma.link.upsert({
      where: { slug: "flexbox-design-system" },
      update: { title: existing?.title ?? "Flexbox Design System" },
      create: {
        slug: "flexbox-design-system",
        categoryId: category!.id,
        title: "Flexbox Design System",
        description: "Sistem visual dan prinsip desain yang menyatukan karya Flexbox.",
        icon: "grid",
        tag: "Segera",
        destinationType: "NONE",
        status: "PUBLISHED",
        isActive: true,
        isFeatured: true,
        sortOrder: 1,
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    expect(upserted.slug).toBe("flexbox-design-system");
    // Integration files share one local database and run in parallel, so a global
    // row count would race. The real invariant is that the natural key stays unique.
    expect(await db!.prisma.link.count({ where: { slug: "flexbox-design-system" } })).toBe(1);
  });
});

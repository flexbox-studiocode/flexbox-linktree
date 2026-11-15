import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findTrackableLink } from "@/features/analytics/repositories/links";
import { openLocalDatabase, testSlug, type LocalDatabase } from "../helpers/db";

/**
 * Tracking-redirect eligibility.
 *
 * `/go/[linkId]` never accepts a destination from the request. `findTrackableLink`
 * is the one place that decides whether a click may be counted and redirected, so
 * every ineligible state is asserted here: draft, archived, inactive link,
 * inactive category, non-web scheme, and a missing row.
 */

const db: LocalDatabase | null = openLocalDatabase();

type LinkOverrides = {
  status?: "PUBLISHED" | "DRAFT" | "ARCHIVED";
  publishedAt?: Date | null;
  isActive?: boolean;
  categoryId?: string;
  destinationType?: "EXTERNAL" | "INTERNAL" | "NONE";
  destinationUrl?: string | null;
  internalAnchor?: string | null;
};

describe.skipIf(!db)("trackable link resolution (local database)", () => {
  const prisma = db!.prisma;
  const ids: Record<string, string> = {};
  let activeCategoryId: string;
  let inactiveCategoryId: string;

  async function createLink(label: string, overrides: LinkOverrides = {}) {
    const link = await prisma.link.create({
      data: {
        slug: testSlug(`redirect-${label}`),
        categoryId: activeCategoryId,
        title: `Redirect ${label}`,
        destinationType: "EXTERNAL",
        destinationUrl: "https://example.test/landing",
        status: "PUBLISHED",
        isActive: true,
        sortOrder: 1,
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
        ...overrides,
      },
      select: { id: true },
    });

    ids[label] = link.id;

    return link.id;
  }

  beforeAll(async () => {
    const active = await prisma.category.create({
      data: { slug: testSlug("redirect-active"), name: "Redirect Active", sortOrder: 90, isActive: true },
      select: { id: true },
    });
    const inactive = await prisma.category.create({
      data: { slug: testSlug("redirect-inactive"), name: "Redirect Inactive", sortOrder: 91, isActive: false },
      select: { id: true },
    });

    activeCategoryId = active.id;
    inactiveCategoryId = inactive.id;

    await createLink("ok");
    await createLink("http", { destinationUrl: "http://example.test/plain" });
    await createLink("draft", { status: "DRAFT", publishedAt: null });
    await createLink("archived", { status: "ARCHIVED" });
    await createLink("inactive-link", { isActive: false });
    await createLink("inactive-category", { categoryId: inactiveCategoryId });
    await createLink("internal", { destinationType: "INTERNAL", destinationUrl: null, internalAnchor: "#kontak" });
    await createLink("none", { destinationType: "NONE", destinationUrl: null });
  });

  afterAll(async () => {
    if (!db) return;

    await prisma.link.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await prisma.category.deleteMany({ where: { id: { in: [activeCategoryId, inactiveCategoryId] } } });
    await db.dispose();
  });

  it("resolves only a fully eligible web destination", async () => {
    await expect(findTrackableLink(ids.ok)).resolves.toMatchObject({
      linkId: ids.ok,
      destinationUrl: "https://example.test/landing",
      title: "Redirect ok",
    });
    await expect(findTrackableLink(ids.http)).resolves.toMatchObject({
      destinationUrl: "http://example.test/plain",
    });
  });

  it("refuses every ineligible publication or activation state", async () => {
    for (const key of ["draft", "archived", "inactive-link", "inactive-category"]) {
      await expect(findTrackableLink(ids[key]), key).resolves.toBeNull();
    }
  });

  it("refuses destinations that are not an approved external web URL", async () => {
    for (const key of ["internal", "none"]) {
      await expect(findTrackableLink(ids[key]), key).resolves.toBeNull();
    }
  });

  it("rejects an unsafe destination scheme at the database boundary", async () => {
    // Defence in depth: storage refuses these before the resolver is reached.
    for (const destinationUrl of ["javascript:alert(1)", "data:text/html,<b>x</b>", "//evil.example/path", "   "]) {
      await expect(
        prisma.link.create({
          data: {
            slug: testSlug("redirect-unsafe"),
            categoryId: activeCategoryId,
            title: "Unsafe",
            destinationType: "EXTERNAL",
            destinationUrl,
            status: "PUBLISHED",
            isActive: true,
            sortOrder: 2,
            publishedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        }),
        destinationUrl,
      ).rejects.toThrow();
    }
  });

  it("returns null for an unknown id without throwing", async () => {
    await expect(findTrackableLink("33333333-3333-4333-8333-333333333333")).resolves.toBeNull();
  });
});
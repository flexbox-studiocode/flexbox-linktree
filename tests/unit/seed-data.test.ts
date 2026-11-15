import { describe, expect, it } from "vitest";

import { parseSiteSetting, siteSettingSchemas } from "@/features/content/schemas/site-setting";
import { publicAnchors } from "@/features/content/constants";
import { linkSchema } from "@/features/content/schemas/link";
import { seedCategories, seedPublishedAt, seedSiteSettings } from "../../prisma/seed-data";

const links = seedCategories.flatMap((category) => category.links);
const approvedAnchors = new Set<string>(Object.values(publicAnchors));

describe("seed dataset", () => {
  it("mirrors the approved Phase 2 directory", () => {
    expect(seedCategories.map((category) => category.slug)).toEqual(["studio-picks", "explore-more"]);
    expect(seedCategories.map((category) => category.name)).toEqual(["Pilihan studio", "Jelajahi lebih jauh"]);
    expect(links.map((link) => link.title)).toEqual([
      "Flexbox Design System",
      "Flexbox Lab",
      "Website Flexbox",
      "Sumber Daya",
      "Karya Digital",
      "Eksperimen Visual",
      "Terhubung dengan Kami",
      "Kolaborasi & Kemitraan",
    ]);
  });

  it("keeps unique slugs and a deterministic global ordering", () => {
    expect(new Set(seedCategories.map((category) => category.slug)).size).toBe(seedCategories.length);
    expect(new Set(links.map((link) => link.slug)).size).toBe(links.length);
    expect(links.map((link) => link.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("keeps exactly six unverified destinations non-interactive and tagged Segera", () => {
    const pending = links.filter((link) => link.href === undefined);

    expect(pending).toHaveLength(6);
    expect(pending.every((link) => link.tag === "Segera")).toBe(true);
  });

  it("publishes only the approved internal anchors", () => {
    const anchors = links.filter((link) => link.href !== undefined);

    expect(anchors.map((link) => link.slug)).toEqual(["terhubung", "kolaborasi"]);

    for (const link of anchors) {
      expect(link.href).toBe(publicAnchors.contact);
      expect(approvedAnchors.has(link.href!)).toBe(true);
    }
  });

  it("introduces no email address, domain, or social handle", () => {
    const serialized = JSON.stringify({ seedCategories, seedSiteSettings });

    expect(serialized).not.toMatch(/mailto:/i);
    expect(serialized).not.toMatch(/https?:\/\//i);
    expect(seedSiteSettings.contact.contactEmail).toBeNull();
    expect(seedSiteSettings.seo.canonicalUrl).toBeNull();
    expect(seedSiteSettings.seo.openGraphImage).toBeNull();
  });

  it("validates every seeded link against the link schema", () => {
    const categoryId = "00000000-0000-4000-8000-000000000001";
    const publishedAt = new Date(seedPublishedAt);

    for (const link of links) {
      const isInternal = link.href?.startsWith("#") === true;
      const parsed = linkSchema.safeParse({
        slug: link.slug,
        categoryId,
        title: link.title,
        description: link.description,
        icon: link.icon,
        tag: link.tag ?? null,
        destinationType: link.href ? (isInternal ? "INTERNAL" : "EXTERNAL") : "NONE",
        destinationUrl: link.href && !isInternal ? link.href : null,
        internalAnchor: isInternal ? link.href : null,
        status: "PUBLISHED",
        isActive: true,
        isFeatured: link.isFeatured ?? false,
        sortOrder: link.sortOrder,
        publishedAt,
      });

      expect(parsed.success, `seed link "${link.slug}" must be valid`).toBe(true);
    }
  });

  it("validates every seeded site setting against its typed schema", () => {
    expect(Object.keys(seedSiteSettings).sort()).toEqual(Object.keys(siteSettingSchemas).sort());

    for (const key of Object.keys(siteSettingSchemas) as Array<keyof typeof siteSettingSchemas>) {
      expect(
        parseSiteSetting(key, seedSiteSettings[key]),
        `seed setting "${key}" must be valid`,
      ).toEqual(seedSiteSettings[key]);
    }
  });
});

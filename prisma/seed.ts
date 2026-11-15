import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { publicCategories, siteContent } from "../src/features/public/content";

/**
 * Repeatable development seed.
 *
 * Usage: `pnpm db:seed` (also wired as the Prisma `migrations.seed` command).
 *
 * Everything is upserted by a stable natural key (category slug, link slug,
 * site-setting key), so running it twice creates no duplicates and it never
 * deletes records that the team created through the future CMS.
 *
 * Destinations come from the Phase 2 content module and are never invented.
 * The six unconfirmed links are seeded as PUBLISHED + `NONE` destination, which
 * is exactly the approved "Segera" non-interactive card behaviour.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const publishedAt = new Date("2026-01-01T00:00:00.000Z");

const settingValues = {
  general: {
    name: siteContent.name,
    wordmark: siteContent.wordmark,
    wordmarkSuffix: siteContent.wordmarkSuffix,
    supportingLabel: siteContent.supportingLabel,
  },
  navigation: {
    headerNavLabel: siteContent.headerNavLabel,
    contactNavLabel: siteContent.contactNavLabel,
    headerCtaLabel: siteContent.headerCtaLabel,
  },
  hero: {
    heroEyebrow: siteContent.heroEyebrow,
    heroTitle: siteContent.heroTitle,
    heroDescription: siteContent.heroDescription,
    heroCtaLabel: siteContent.heroCtaLabel,
  },
  directory: {
    directoryEyebrow: siteContent.directoryEyebrow,
    directoryTitle: siteContent.directoryTitle,
    directoryDescription: siteContent.directoryDescription,
  },
  contact: {
    contactEyebrow: siteContent.contactEyebrow,
    contactTitle: siteContent.contactTitle,
    contactDescription: siteContent.contactDescription,
    contactCtaLabel: siteContent.contactCtaLabel,
    contactPendingLabel: siteContent.contactPendingLabel,
    // Remains null until the owner confirms a real, monitored mailbox.
    contactEmail: null,
  },
  footer: {
    footerTagline: siteContent.footerTagline,
    copyrightName: siteContent.copyrightName,
  },
  seo: {
    title: "Flexbox Studio — Digital Hub",
    description:
      "Direktori digital Flexbox Studio: produk, proyek, sumber daya, komunitas, dan kontak dalam satu tempat.",
    // Canonical URL and Open Graph artwork stay null until verified values exist.
    canonicalUrl: null,
    openGraphImage: null,
  },
} as const;

async function main(): Promise<void> {
  for (const category of publicCategories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.title, sortOrder: category.sortOrder, isActive: true },
      create: {
        name: category.title,
        slug: category.slug,
        sortOrder: category.sortOrder,
        isActive: true,
      },
    });

    for (const item of category.links) {
      const isInternal = item.href?.startsWith("#") === true;
      const destination = item.href
        ? isInternal
          ? { destinationType: "INTERNAL" as const, destinationUrl: null, internalAnchor: item.href }
          : { destinationType: "EXTERNAL" as const, destinationUrl: item.href, internalAnchor: null }
        : { destinationType: "NONE" as const, destinationUrl: null, internalAnchor: null };

      const content = {
        categoryId: record.id,
        title: item.title,
        description: item.description,
        icon: item.icon,
        tag: item.tag ?? null,
        ...destination,
        status: "PUBLISHED" as const,
        isActive: true,
        isFeatured: item.isFeatured ?? false,
        sortOrder: item.sortOrder,
        publishedAt,
      };

      await prisma.link.upsert({
        where: { slug: item.id },
        update: content,
        create: { slug: item.id, ...content },
      });
    }
  }

  for (const [key, value] of Object.entries(settingValues)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  const linkCount = publicCategories.reduce((total, category) => total + category.links.length, 0);
  console.log(
    `Seed complete: ${publicCategories.length} categories, ${linkCount} links, ${Object.keys(settingValues).length} site settings.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

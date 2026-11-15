import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedCategories, seedPublishedAt, seedSiteSettings } from "./seed-data";

/**
 * Repeatable development seed.
 *
 * Usage: `pnpm db:seed` (also wired as the Prisma `migrations.seed` command).
 *
 * Everything is upserted by a stable natural key (category slug, link slug,
 * site-setting key), so running it twice creates no duplicates and it never
 * deletes records created elsewhere. The dataset lives in `prisma/seed-data.ts`
 * and is validated against the content schemas by `tests/unit/seed-data.test.ts`.
 *
 * Destinations are never invented: six links are seeded as PUBLISHED with a
 * `NONE` destination, which is precisely the approved `Segera` non-interactive
 * card behaviour, and two links keep their approved `#kontak` internal anchor.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const publishedAt = new Date(seedPublishedAt);

async function main(): Promise<void> {
  for (const category of seedCategories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: category.sortOrder, isActive: true },
      create: { name: category.name, slug: category.slug, sortOrder: category.sortOrder, isActive: true },
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
        where: { slug: item.slug },
        update: content,
        create: { slug: item.slug, ...content },
      });
    }
  }

  for (const [key, value] of Object.entries(seedSiteSettings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  const linkCount = seedCategories.reduce((total, category) => total + category.links.length, 0);
  console.log(
    `Seed complete: ${seedCategories.length} categories, ${linkCount} links, ${Object.keys(seedSiteSettings).length} site settings.`,
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

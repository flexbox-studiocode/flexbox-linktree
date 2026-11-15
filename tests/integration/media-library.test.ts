import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deleteMedia, updateMediaMetadata } from "@/features/media/service";
import { findMediaById, insertMediaAsset } from "@/features/media/repository";
import { openLocalDatabase, testSlug, type LocalDatabase } from "../helpers/db";

/**
 * Media metadata integration tests.
 *
 * The storage backend is not written to: these tests create metadata rows and
 * point a test link icon at one asset to prove the reference guard. Only rows
 * created here are removed.
 */
const db: LocalDatabase | null = openLocalDatabase();

describe.skipIf(!db)("media library service (local database)", () => {
  const prisma = db!.prisma;
  let actor: { adminId: string; actorEmail: string };
  const createdMediaIds: string[] = [];
  const createdCategoryIds: string[] = [];

  beforeAll(async () => {
    const normalizedEmail = `${testSlug("media-actor")}@example.test`;

    const admin = await prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        fullName: "Media Integration Actor",
        role: "SUPER_ADMIN",
        status: "DISABLED",
      },
      select: { id: true, normalizedEmail: true },
    });

    actor = { adminId: admin.id, actorEmail: admin.normalizedEmail };
  });

  afterAll(async () => {
    if (!db) return;

    await prisma.securityEvent.deleteMany({ where: { adminUserId: actor?.adminId } });
    await prisma.link.deleteMany({ where: { categoryId: { in: createdCategoryIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: createdMediaIds } } });
    await prisma.adminUser.deleteMany({ where: { id: actor?.adminId } });
    await db.dispose();
  });

  async function makeAsset(label: string) {
    const asset = await insertMediaAsset({
      originalName: `${label}.png`,
      storageKey: `media/${testSlug(label)}.png`,
      mimeType: "image/png",
      sizeBytes: 512,
      width: 16,
      height: 16,
      altText: null,
    });

    createdMediaIds.push(asset.id);

    return asset;
  }

  it("updates alt text and records an audit event", async () => {
    const asset = await makeAsset("alt");

    const updated = await updateMediaMetadata({ actor, mediaId: asset.id, altText: "  Logo Flexbox  " });

    expect(updated.altText).toBe("Logo Flexbox");

    const event = await prisma.securityEvent.findFirst({
      where: { targetId: asset.id, eventType: "MEDIA_UPDATED" },
      select: { eventType: true },
    });

    expect(event?.eventType).toBe("MEDIA_UPDATED");
  });

  it("clears alt text when the field is emptied", async () => {
    const asset = await makeAsset("clear");

    const updated = await updateMediaMetadata({ actor, mediaId: asset.id, altText: null });
    expect(updated.altText).toBeNull();
  });

  it("rejects an unknown media id", async () => {
    await expect(
      updateMediaMetadata({ actor, mediaId: "2b1f0f4c-0000-4000-8000-000000000000", altText: "x" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuses to delete an asset that a link still references", async () => {
    const asset = await makeAsset("referenced");
    const category = await prisma.category.create({
      data: { name: `QA ${testSlug("media-cat")}`, slug: testSlug("media-cat"), sortOrder: 900 },
      select: { id: true },
    });
    createdCategoryIds.push(category.id);

    await prisma.link.create({
      data: {
        slug: testSlug("media-link"),
        categoryId: category.id,
        title: "QA media reference",
        icon: asset.storageKey,
        destinationType: "NONE",
        status: "DRAFT",
        sortOrder: 900,
      },
    });

    await expect(deleteMedia({ actor, mediaId: asset.id })).rejects.toMatchObject({ code: "in_use" });

    const stillThere = await findMediaById(asset.id);
    expect(stillThere).not.toBeNull();
  });

  it("deletes an unreferenced asset and its metadata", async () => {
    const asset = await makeAsset("deletable");

    await deleteMedia({ actor, mediaId: asset.id });

    expect(await findMediaById(asset.id)).toBeNull();

    const event = await prisma.securityEvent.findFirst({
      where: { targetId: asset.id, eventType: "MEDIA_DELETED" },
      select: { eventType: true },
    });
    expect(event?.eventType).toBe("MEDIA_DELETED");
  });
});
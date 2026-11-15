import "server-only";

import { prisma } from "@/lib/prisma/client";

/**
 * Media metadata queries.
 *
 * Binary content lives in the storage backend; this module only reads and writes
 * the `media_assets` row. Every write is explicit-column so the caller cannot
 * accidentally persist a storage key or MIME type it did not validate.
 */

export type MediaAssetRow = {
  id: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const MEDIA_SELECT = {
  id: true,
  originalName: true,
  storageKey: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  altText: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function findMediaPage(input: {
  skip: number;
  take: number;
}): Promise<{ rows: MediaAssetRow[]; total: number; totalBytes: number }> {
  const [rows, total, aggregate] = await Promise.all([
    prisma.mediaAsset.findMany({
      select: MEDIA_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: input.skip,
      take: input.take,
    }),
    prisma.mediaAsset.count(),
    prisma.mediaAsset.aggregate({ _sum: { sizeBytes: true } }),
  ]);

  return { rows, total, totalBytes: aggregate._sum.sizeBytes ?? 0 };
}

export async function findMediaById(id: string): Promise<MediaAssetRow | null> {
  return prisma.mediaAsset.findUnique({ where: { id }, select: MEDIA_SELECT });
}

export async function findMediaByStorageKey(storageKey: string): Promise<MediaAssetRow | null> {
  return prisma.mediaAsset.findUnique({ where: { storageKey }, select: MEDIA_SELECT });
}

export async function insertMediaAsset(input: {
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
}): Promise<MediaAssetRow> {
  return prisma.mediaAsset.create({ data: input, select: MEDIA_SELECT });
}

export async function updateMediaAltText(id: string, altText: string | null): Promise<MediaAssetRow> {
  return prisma.mediaAsset.update({ where: { id }, data: { altText }, select: MEDIA_SELECT });
}

export async function deleteMediaAsset(id: string): Promise<void> {
  await prisma.mediaAsset.delete({ where: { id } });
}

/**
 * Finds content that still points at a media asset.
 *
 * Settings store absolute URLs, so a reference is either the raw storage key or
 * a URL that ends with it. `links.icon` is compared the same way. This is a
 * conservative check: a false positive blocks a delete, never the reverse.
 */
export async function findMediaReferences(storageKey: string): Promise<{ settings: string[]; links: string[] }> {
  const [settingsRows, links] = await Promise.all([
    prisma.siteSetting.findMany({ select: { key: true, value: true } }),
    prisma.link.findMany({
      where: { icon: { contains: storageKey } },
      select: { slug: true },
      take: 50,
    }),
  ]);

  const settings = settingsRows
    .filter((row) => JSON.stringify(row.value).includes(storageKey))
    .map((row) => row.key);

  return { settings, links: links.map((link) => link.slug) };
}
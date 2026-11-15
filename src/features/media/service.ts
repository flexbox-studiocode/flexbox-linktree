import "server-only";

import { randomUUID } from "node:crypto";

import { getStorageProvider } from "@/lib/storage";
import { recordSecurityEvent } from "@/features/auth/services/security-event";
import { invalidatePublicContent, type ActorContext } from "@/features/content/services/admin-content";
import {
  deleteMediaAsset,
  findMediaById,
  findMediaByStorageKey,
  findMediaPage,
  findMediaReferences,
  insertMediaAsset,
  updateMediaAltText,
  type MediaAssetRow,
} from "@/features/media/repository";
import { altTextSchema, MediaValidationError, validateMediaUpload } from "@/features/media/validation";

/**
 * Media library service.
 *
 * Uploads are validated by magic bytes before anything is written, then stored
 * through the provider interface. The database row is created only after the
 * provider confirms the write, and a failed insert removes the object again so
 * storage and metadata cannot drift apart.
 */

export type MediaErrorCode =
  | "invalid_input"
  | "not_found"
  | "in_use"
  | "storage_failure";

export class MediaAdminError extends Error {
  readonly code: MediaErrorCode;

  constructor(code: MediaErrorCode, message: string) {
    super(message);
    this.name = "MediaAdminError";
    this.code = code;
  }
}

/** Builds a collision-free key. The original file name never reaches storage. */
export function buildStorageKey(extension: string, now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `media/${year}/${month}/${randomUUID()}.${extension}`;
}

export function publicUrlForAsset(asset: Pick<MediaAssetRow, "storageKey">): string {
  return getStorageProvider().getPublicUrl(asset.storageKey) ?? `/media/${asset.storageKey}`;
}

export type MediaListItem = MediaAssetRow & { url: string };

export async function getMediaLibrary(input: { page: number; pageSize: number }): Promise<{
  items: MediaListItem[];
  total: number;
  totalBytes: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const { rows, total, totalBytes } = await findMediaPage({
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize,
  });

  return {
    items: rows.map((row) => ({ ...row, url: publicUrlForAsset(row) })),
    total,
    totalBytes,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
  };
}

export async function getMediaAssetForAdmin(id: string): Promise<MediaListItem | null> {
  const asset = await findMediaById(id);
  return asset ? { ...asset, url: publicUrlForAsset(asset) } : null;
}

export async function uploadMedia(input: {
  actor: ActorContext;
  fileName: string;
  declaredType: string;
  bytes: Uint8Array;
  altText?: string | null;
}): Promise<MediaListItem> {
  let validated;

  try {
    validated = validateMediaUpload({
      declaredType: input.declaredType,
      fileName: input.fileName,
      bytes: input.bytes,
      altText: input.altText ?? null,
    });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      throw new MediaAdminError("invalid_input", error.message);
    }

    throw error;
  }

  const storage = getStorageProvider();
  const storageKey = buildStorageKey(validated.extension);

  try {
    await storage.upload({ key: storageKey, body: input.bytes, contentType: validated.mimeType });
  } catch {
    throw new MediaAdminError("storage_failure", "Berkas gagal disimpan. Coba lagi.");
  }

  let asset: MediaAssetRow;

  try {
    asset = await insertMediaAsset({
      originalName: validated.originalName,
      storageKey,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      width: validated.width,
      height: validated.height,
      altText: validated.altText,
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }

  await recordSecurityEvent({
    eventType: "MEDIA_UPLOADED",
    adminUserId: input.actor.adminId,
    targetType: "media",
    targetId: asset.id,
    metadata: {
      actorEmail: input.actor.actorEmail,
      mediaId: asset.id,
      storageKey: asset.storageKey,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
    },
  });

  invalidatePublicContent();

  return { ...asset, url: publicUrlForAsset(asset) };
}

export async function updateMediaMetadata(input: {
  actor: ActorContext;
  mediaId: string;
  altText: string | null;
}): Promise<MediaListItem> {
  const existing = await findMediaById(input.mediaId);

  if (!existing) {
    throw new MediaAdminError("not_found", "Aset media tidak ditemukan.");
  }

  const parsed = altTextSchema.safeParse(input.altText);

  if (!parsed.success) {
    throw new MediaAdminError("invalid_input", "Teks alternatif maksimal 300 karakter.");
  }

  const asset = await updateMediaAltText(existing.id, parsed.data ? parsed.data : null);

  await recordSecurityEvent({
    eventType: "MEDIA_UPDATED",
    adminUserId: input.actor.adminId,
    targetType: "media",
    targetId: asset.id,
    metadata: {
      actorEmail: input.actor.actorEmail,
      mediaId: asset.id,
      storageKey: asset.storageKey,
      changedFields: "altText",
    },
  });

  invalidatePublicContent();

  return { ...asset, url: publicUrlForAsset(asset) };
}

export async function deleteMedia(input: { actor: ActorContext; mediaId: string }): Promise<{ id: string }> {
  const existing = await findMediaById(input.mediaId);

  if (!existing) {
    throw new MediaAdminError("not_found", "Aset media tidak ditemukan.");
  }

  const references = await findMediaReferences(existing.storageKey);

  if (references.settings.length > 0 || references.links.length > 0) {
    throw new MediaAdminError(
      "in_use",
      "Aset media masih dipakai oleh pengaturan situs atau tautan. Lepaskan referensinya terlebih dahulu.",
    );
  }

  await deleteMediaAsset(existing.id);
  await getStorageProvider().delete(existing.storageKey).catch(() => undefined);

  await recordSecurityEvent({
    eventType: "MEDIA_DELETED",
    adminUserId: input.actor.adminId,
    targetType: "media",
    targetId: existing.id,
    metadata: {
      actorEmail: input.actor.actorEmail,
      mediaId: existing.id,
      storageKey: existing.storageKey,
    },
  });

  invalidatePublicContent();

  return { id: existing.id };
}

/** Reads an object for the local serving route. Returns `null` when it is unknown. */
export async function readMediaObject(storageKey: string) {
  const asset = await findMediaByStorageKey(storageKey);

  if (!asset) {
    return null;
  }

  const object = await getStorageProvider().read(storageKey);

  return object ? { ...object, asset } : null;
}
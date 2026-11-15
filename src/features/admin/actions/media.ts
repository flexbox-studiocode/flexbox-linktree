"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAction } from "@/lib/auth/session";
import { deleteMedia, updateMediaMetadata, uploadMedia } from "@/features/media/service";
import { MAX_MEDIA_BYTES } from "@/features/media/validation";
import type { AdminFormState } from "@/features/admin/actions/form-state";
import { adminContentErrorState } from "@/features/admin/actions/errors";

/**
 * Media Server Actions.
 *
 * The uploaded file is untrusted: its declared type and extension are never
 * trusted, and `uploadMedia` re-derives the real type from magic bytes before
 * writing anything. The size limit is enforced once more here because
 * `FormData` is fully buffered by the framework.
 */

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function uploadMediaAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const file = formData.get("file");

  try {
    const admin = await requireAdminAction();

    if (!(file instanceof File) || file.size === 0) {
      return { status: "error", message: "Pilih berkas gambar terlebih dahulu." };
    }

    if (file.size > MAX_MEDIA_BYTES) {
      return { status: "error", message: "Ukuran berkas melebihi 5 MB." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const altText = text(formData, "altText").trim();

    const created = await uploadMedia({
      actor: { adminId: admin.id, actorEmail: admin.email },
      fileName: file.name,
      declaredType: file.type,
      bytes,
      altText: altText.length > 0 ? altText : null,
    });

    revalidatePath("/admin/media");
    return { status: "success", message: "Media diunggah.", createdId: created.id };
  } catch (error) {
    return adminContentErrorState(error, "Unggahan media gagal.");
  }
}

export async function updateMediaAltAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const mediaId = text(formData, "mediaId");
  const altText = text(formData, "altText").trim();

  try {
    const admin = await requireAdminAction();

    await updateMediaMetadata({
      actor: { adminId: admin.id, actorEmail: admin.email },
      mediaId,
      altText: altText.length > 0 ? altText : null,
    });

    revalidatePath("/admin/media");
    return { status: "success", message: "Teks alternatif disimpan." };
  } catch (error) {
    return adminContentErrorState(error, "Teks alternatif gagal disimpan.");
  }
}

export async function deleteMediaAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const mediaId = text(formData, "mediaId");

  try {
    const admin = await requireAdminAction();

    await deleteMedia({
      actor: { adminId: admin.id, actorEmail: admin.email },
      mediaId,
    });

    revalidatePath("/admin/media");
    return { status: "success", message: "Media dihapus." };
  } catch (error) {
    return adminContentErrorState(error, "Media gagal dihapus.");
  }
}
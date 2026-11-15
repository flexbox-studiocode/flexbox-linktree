"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAction } from "@/lib/auth/session";
import { siteSettingSchemas, type SiteSettingKey } from "@/features/content/schemas/site-setting";
import { updateSiteSetting } from "@/features/content/services/admin-settings";
import type { AdminFormState } from "@/features/admin/actions/form-state";
import { adminContentErrorState } from "@/features/admin/actions/errors";

/**
 * Website settings Server Action.
 *
 * The form submits one settings group at a time. Field names are fixed by
 * `siteSettingSchemas`, and any field the caller did not submit is read as
 * `null` so the Zod schema — not the browser — decides what is acceptable.
 * Arbitrary JSON, HTML, or CSS is never accepted.
 */

const NULLABLE_FIELDS = new Set(["contactEmail", "canonicalUrl", "openGraphImage"]);

export async function updateSettingAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const key = formData.get("settingKey");

  try {
    const admin = await requireAdminAction();

    if (typeof key !== "string" || !(key in siteSettingSchemas)) {
      return { status: "error", message: "Grup pengaturan tidak dikenal." };
    }

    const settingKey = key as SiteSettingKey;
    const shape = siteSettingSchemas[settingKey].shape as Record<string, unknown>;
    const value: Record<string, string | null> = {};

    for (const field of Object.keys(shape)) {
      const raw = formData.get(field);
      const text = typeof raw === "string" ? raw.trim() : "";

      value[field] = NULLABLE_FIELDS.has(field) && text.length === 0 ? null : text;
    }

    await updateSiteSetting({
      actor: { adminId: admin.id, actorEmail: admin.email },
      key: settingKey,
      value,
    });
  } catch (error) {
    return adminContentErrorState(error, "Pengaturan gagal disimpan.");
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");

  return { status: "success", message: "Pengaturan disimpan." };
}
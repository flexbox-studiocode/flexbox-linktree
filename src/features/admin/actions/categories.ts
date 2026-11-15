"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAction } from "@/lib/auth/session";
import {
  createCategory,
  deleteCategory,
  reassignAndDeleteCategory,
  reorderCategory,
  setCategoryActive,
  updateCategory,
} from "@/features/content/services/admin-content";
import type { AdminFormState } from "@/features/admin/actions/form-state";
import { adminContentErrorState } from "@/features/admin/actions/errors";

/** Category mutation Server Actions. Each action re-authorizes on the server. */

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function optionalText(formData: FormData, name: string): string | null {
  const value = text(formData, name).trim();
  return value.length > 0 ? value : null;
}

function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function integer(formData: FormData, name: string, fallback: number): number {
  const parsed = Number.parseInt(text(formData, name), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readDraft(formData: FormData) {
  return {
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    description: optionalText(formData, "description"),
    icon: optionalText(formData, "icon"),
    sortOrder: integer(formData, "sortOrder", 0),
    isActive: checkbox(formData, "isActive"),
  };
}

async function actor() {
  const admin = await requireAdminAction();
  return { adminId: admin.id, actorEmail: admin.email };
}

export async function createCategoryAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const created = await createCategory({ actor: await actor(), draft: readDraft(formData) });
    revalidatePath("/admin/categories");
    return { status: "success", message: "Kategori dibuat.", createdId: created.id };
  } catch (error) {
    return adminContentErrorState(error, "Kategori gagal dibuat.");
  }
}

export async function updateCategoryAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const categoryId = text(formData, "categoryId");

  try {
    await updateCategory({ actor: await actor(), categoryId, draft: readDraft(formData) });
    revalidatePath("/admin/categories");
    revalidatePath(`/admin/categories/${categoryId}`);
    return { status: "success", message: "Perubahan kategori disimpan." };
  } catch (error) {
    return adminContentErrorState(error, "Perubahan kategori gagal disimpan.");
  }
}

export async function toggleCategoryActiveAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const categoryId = text(formData, "categoryId");

  try {
    await setCategoryActive({ actor: await actor(), categoryId, isActive: checkbox(formData, "isActive") });
    revalidatePath("/admin/categories");
    return { status: "success", message: "Status kategori diperbarui." };
  } catch (error) {
    return adminContentErrorState(error, "Status kategori gagal diubah.");
  }
}

export async function reorderCategoryAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const categoryId = text(formData, "categoryId");
  const direction = text(formData, "direction") === "up" ? "up" : "down";

  try {
    const result = await reorderCategory({ actor: await actor(), categoryId, direction });
    revalidatePath("/admin/categories");
    return result.moved
      ? { status: "success", message: "Urutan kategori diperbarui." }
      : { status: "error", message: "Kategori sudah berada di urutan paling ujung." };
  } catch (error) {
    return adminContentErrorState(error, "Urutan kategori gagal diubah.");
  }
}

export async function deleteCategoryAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const categoryId = text(formData, "categoryId");
  const targetCategoryId = optionalText(formData, "targetCategoryId");

  try {
    if (targetCategoryId) {
      await reassignAndDeleteCategory({ actor: await actor(), categoryId, targetCategoryId });
      revalidatePath("/admin/categories");
      revalidatePath("/admin/links");
      return { status: "success", message: "Tautan dipindahkan dan kategori dihapus." };
    }

    await deleteCategory({ actor: await actor(), categoryId });
    revalidatePath("/admin/categories");
    return { status: "success", message: "Kategori dihapus." };
  } catch (error) {
    return adminContentErrorState(error, "Kategori gagal dihapus.");
  }
}
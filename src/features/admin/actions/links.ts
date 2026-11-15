"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAction } from "@/lib/auth/session";
import {
  ContentAdminError,
  createLink,
  deleteLink,
  reorderLink,
  setLinkActive,
  setLinkFeatured,
  transitionLinkStatus,
  updateLink,
} from "@/features/content/services/admin-content";
import type {
  LinkDestinationType,
  PublicationStatus,
} from "@/generated/prisma/enums";
import type { AdminFormState } from "@/features/admin/actions/form-state";
import { adminContentErrorState } from "@/features/admin/actions/errors";

/**
 * Link mutation Server Actions.
 *
 * Each action authorizes independently with `requireAdminAction()`: the protected
 * layout and `src/proxy.ts` never authorize a mutation. Values arrive from
 * `FormData` and are untrusted; the content service re-validates them with the
 * shared Zod schemas before touching the database.
 */

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

const DESTINATIONS: LinkDestinationType[] = ["EXTERNAL", "INTERNAL", "NONE"];
const STATUSES: PublicationStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

function readDraft(formData: FormData) {
  const destinationType = text(formData, "destinationType") as LinkDestinationType;
  const status = text(formData, "status") as PublicationStatus;

  if (!DESTINATIONS.includes(destinationType) || !STATUSES.includes(status)) {
    throw new ContentAdminError("invalid_input", "Tipe tujuan atau status publikasi tidak valid.");
  }

  return {
    slug: text(formData, "slug"),
    categoryId: text(formData, "categoryId"),
    title: text(formData, "title"),
    description: optionalText(formData, "description"),
    icon: optionalText(formData, "icon"),
    tag: optionalText(formData, "tag"),
    destinationType,
    destinationUrl: optionalText(formData, "destinationUrl"),
    internalAnchor: optionalText(formData, "internalAnchor"),
    status,
    isActive: checkbox(formData, "isActive"),
    isFeatured: checkbox(formData, "isFeatured"),
    sortOrder: integer(formData, "sortOrder", 0),
  };
}

async function actor() {
  const admin = await requireAdminAction();
  return { adminId: admin.id, actorEmail: admin.email };
}

export async function createLinkAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const created = await createLink({ actor: await actor(), draft: readDraft(formData) });
    revalidatePath("/admin/links");
    revalidatePath(`/admin/links/${created.id}`);
    return { status: "success", message: "Tautan dibuat.", createdId: created.id };
  } catch (error) {
    return adminContentErrorState(error, "Tautan gagal dibuat.");
  }
}

export async function updateLinkAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const linkId = text(formData, "linkId");

  try {
    await updateLink({ actor: await actor(), linkId, draft: readDraft(formData) });
    revalidatePath("/admin/links");
    revalidatePath(`/admin/links/${linkId}`);
    return { status: "success", message: "Perubahan tautan disimpan." };
  } catch (error) {
    return adminContentErrorState(error, "Perubahan tautan gagal disimpan.");
  }
}

export async function transitionLinkAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const linkId = text(formData, "linkId");
  const to = text(formData, "to") as PublicationStatus;

  if (!STATUSES.includes(to)) {
    return { status: "error", message: "Status publikasi tidak valid." };
  }

  try {
    await transitionLinkStatus({ actor: await actor(), linkId, to });
    revalidatePath("/admin/links");
    revalidatePath(`/admin/links/${linkId}`);
    return { status: "success", message: "Status publikasi diperbarui." };
  } catch (error) {
    return adminContentErrorState(error, "Status publikasi gagal diubah.");
  }
}

export async function toggleLinkActiveAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const linkId = text(formData, "linkId");

  try {
    await setLinkActive({ actor: await actor(), linkId, isActive: checkbox(formData, "isActive") });
    revalidatePath("/admin/links");
    revalidatePath(`/admin/links/${linkId}`);
    return { status: "success", message: "Status aktif tautan diperbarui." };
  } catch (error) {
    return adminContentErrorState(error, "Status aktif gagal diubah.");
  }
}

export async function toggleLinkFeaturedAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const linkId = text(formData, "linkId");

  try {
    await setLinkFeatured({ actor: await actor(), linkId, isFeatured: checkbox(formData, "isFeatured") });
    revalidatePath("/admin/links");
    revalidatePath(`/admin/links/${linkId}`);
    return { status: "success", message: "Status unggulan diperbarui." };
  } catch (error) {
    return adminContentErrorState(error, "Status unggulan gagal diubah.");
  }
}

export async function reorderLinkAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const linkId = text(formData, "linkId");
  const direction = text(formData, "direction") === "up" ? "up" : "down";

  try {
    const result = await reorderLink({ actor: await actor(), linkId, direction });
    revalidatePath("/admin/links");
    return result.moved
      ? { status: "success", message: "Urutan tautan diperbarui." }
      : { status: "error", message: "Tautan sudah berada di urutan paling ujung." };
  } catch (error) {
    return adminContentErrorState(error, "Urutan tautan gagal diubah.");
  }
}

export async function deleteLinkAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const linkId = text(formData, "linkId");

  try {
    await deleteLink({ actor: await actor(), linkId });
    revalidatePath("/admin/links");
    return { status: "success", message: "Tautan dihapus." };
  } catch (error) {
    return adminContentErrorState(error, "Tautan gagal dihapus.");
  }
}
"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAction } from "@/lib/auth/session";
import {
  changeAdministratorStatus,
  inviteAdministrator,
  revokeAdministratorInvitation,
} from "@/features/admin/services/admin-management";
import type { AdminAccountStatus } from "@/generated/prisma/enums";
import type { AdminFormState } from "@/features/admin/actions/form-state";
import { adminContentErrorState } from "@/features/admin/actions/errors";

/**
 * Administrator management Server Actions.
 *
 * These reuse the Phase 4 provisioning and lifecycle services. Self-lockout and
 * last-active-Super-Admin protection live in `admin-management.ts` and run inside
 * the lifecycle transaction, so they are not UI rules.
 */

const STATUSES: AdminAccountStatus[] = ["ACTIVE", "SUSPENDED", "DISABLED"];

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function inviteAdministratorAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const result = await inviteAdministrator({
      actor: { adminId: admin.id, actorEmail: admin.email },
      email: text(formData, "email"),
      fullName: text(formData, "fullName"),
    });

    revalidatePath("/admin/administrators");

    const deliveryNote = result.delivery.delivered
      ? result.delivery.developmentOnly
        ? " Undangan juga ditulis ke transport berkas pengembangan."
        : " Undangan dikirim melalui email."
      : " Email tidak terkirim; serahkan token berikut secara langsung.";

    return {
      status: "success",
      message: `Undangan dibuat dan berlaku sampai ${result.expiresAt.toISOString()}.${deliveryNote}`,
      token: result.token,
      createdId: result.invitationId,
    };
  } catch (error) {
    return adminContentErrorState(error, "Undangan gagal dibuat.");
  }
}

export async function revokeInvitationAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const admin = await requireAdminAction();

    const revoked = await revokeAdministratorInvitation({
      actor: { adminId: admin.id, actorEmail: admin.email },
      invitationId: text(formData, "invitationId"),
    });

    revalidatePath("/admin/administrators");

    return revoked
      ? { status: "success", message: "Undangan dibatalkan." }
      : { status: "error", message: "Undangan tidak ditemukan atau sudah selesai." };
  } catch (error) {
    return adminContentErrorState(error, "Undangan gagal dibatalkan.");
  }
}

export async function changeAdministratorStatusAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const nextStatus = text(formData, "nextStatus") as AdminAccountStatus;

  if (!STATUSES.includes(nextStatus)) {
    return { status: "error", message: "Status akun tidak didukung." };
  }

  try {
    const admin = await requireAdminAction();

    const result = await changeAdministratorStatus({
      actor: { adminId: admin.id, actorEmail: admin.email },
      adminUserId: text(formData, "adminUserId"),
      nextStatus,
    });

    revalidatePath("/admin/administrators");

    return {
      status: "success",
      message: `Status akun diubah dari ${result.previousStatus} ke ${result.nextStatus}. Sesi lama akun tersebut telah dicabut.`,
    };
  } catch (error) {
    return adminContentErrorState(error, "Status akun gagal diubah.");
  }
}
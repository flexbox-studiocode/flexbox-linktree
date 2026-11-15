"use server";

import { headers } from "next/headers";

import { LifecycleError, changeOwnPassword } from "@/features/auth/services/account-lifecycle";
import { requireAdminAction } from "@/lib/auth/session";
import { resolveSourceIdentifier } from "@/lib/security/client-source";
import {
  completePasswordReset,
  ResetError,
  requestPasswordReset,
  resetSourceBucket,
} from "@/features/auth/services/password-reset";
import type { FormState } from "./form-state";

const LIFECYCLE_MESSAGES: Record<LifecycleError["code"], string> = {
  not_found: "Akun administrator tidak ditemukan.",
  invalid_current_password: "Kata sandi saat ini tidak benar.",
  invalid_password: "Kata sandi baru tidak memenuhi kebijakan (minimal 12 karakter).",
  same_password: "Pilih kata sandi yang belum pernah digunakan.",
  invalid_transition: "Perubahan tidak diizinkan.",
};

const RESET_MESSAGES: Record<ResetError["code"], string> = {
  invalid_token: "Tautan pengaturan ulang tidak valid, sudah digunakan, atau sudah kedaluwarsa.",
  invalid_password: "Kata sandi baru tidak memenuhi kebijakan (minimal 12 karakter).",
};

/** Self-service password change (requires re-entry of current password). */
export async function changePasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const admin = await requireAdminAction();

    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return { status: "error", message: "Semua kolom kata sandi wajib diisi." };
    }

    if (newPassword !== confirmPassword) {
      return { status: "error", message: "Konfirmasi kata sandi tidak sama." };
    }

    await changeOwnPassword({
      adminUserId: admin.id,
      currentPassword,
      newPassword,
    });

    return {
      status: "success",
      message:
        "Kata sandi diperbarui. Semua sesi lain telah diakhiri; gunakan kata sandi baru pada perangkat lain.",
    };
  } catch (error) {
    if (error instanceof LifecycleError) {
      return { status: "error", message: LIFECYCLE_MESSAGES[error.code] ?? "Perubahan kata sandi gagal." };
    }

    console.error(`[auth] change-password failed (${error instanceof Error ? error.name : "UnknownError"})`);

    return { status: "error", message: "Perubahan kata sandi gagal. Coba lagi." };
  }
}

/** Password recovery request. Always reports the same outcome regardless of account existence. */
export async function requestPasswordResetAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const headerList = await headers();
  const sourceIdentifier = resolveSourceIdentifier(headerList);

  const outcome = await requestPasswordReset(
    { email: formData.get("email") },
    resetSourceBucket(sourceIdentifier),
  );

  if (outcome.status === "throttled") {
    return {
      status: "error",
      message: `Terlalu banyak permintaan. Coba lagi dalam ${outcome.retryAfterSeconds} detik.`,
    };
  }

  // Non-enumerating: identical whether or not the address exists.
  return {
    status: "success",
    message:
      "Jika alamat tersebut terdaftar, tautan pengaturan ulang telah dikirim. Periksa kotak masuk Anda.",
  };
}

/** Completes a password reset. Requires a valid token; password policy is enforced server-side. */
export async function completePasswordResetAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = formData.get("token");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof token !== "string" || typeof newPassword !== "string") {
    return { status: "error", message: "Token dan kata sandi baru wajib diisi." };
  }

  if (newPassword !== confirmPassword) {
    return { status: "error", message: "Konfirmasi kata sandi tidak sama." };
  }

  try {
    await completePasswordReset({ token, newPassword });

    return {
      status: "success",
      message: "Kata sandi berhasil diatur ulang. Gunakan kata sandi baru untuk masuk.",
    };
  } catch (error) {
    if (error instanceof ResetError) {
      return { status: "error", message: RESET_MESSAGES[error.code] ?? "Permintaan tidak valid." };
    }

    console.error(`[auth] complete-password-reset failed (${error instanceof Error ? error.name : "UnknownError"})`);

    return { status: "error", message: "Pengaturan ulang gagal. Tautan mungkin sudah tidak berlaku." };
  }
}

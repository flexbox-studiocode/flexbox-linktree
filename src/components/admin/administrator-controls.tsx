"use client";

import { useState } from "react";
import { useActionState } from "react";

import {
  changeAdministratorStatusAction,
  deleteAdministratorAction,
  inviteAdministratorAction,
  revokeInvitationAction,
} from "@/features/admin/actions/admins";
import { ADMIN_IDLE_STATE, type AdminFormState } from "@/features/admin/actions/form-state";
import {
  ConfirmButton,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  TokenNotice,
} from "@/components/admin/form-controls";

/**
 * Administrator provisioning controls.
 *
 * Invitations are still accepted through the operator CLI, so this form reports
 * the raw token exactly once for private delivery instead of exposing a public
 * acceptance route.
 */

export function InviteAdminForm() {
  const [state, formAction, isPending] = useActionState<AdminFormState, FormData>(
    inviteAdministratorAction,
    ADMIN_IDLE_STATE,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <TokenNotice token={state.token} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField autoComplete="off" label="Nama lengkap" name="fullName" required />
        <TextField autoComplete="off" inputMode="email" label="Alamat surel" name="email" required type="email" />
      </div>

      <p className="text-xs leading-5 text-[var(--muted)]">
        Undangan berlaku 72 jam dan hanya dapat dipakai sekali. Penerima mengaktifkan akun lewat terminal dengan
        <code className="mx-1 rounded bg-[var(--page)] px-1 font-mono">pnpm admin:accept-invite</code>.
      </p>

      <SubmitButton pendingLabel={isPending ? "Mengirim..." : undefined}>Buat undangan</SubmitButton>
    </form>
  );
}

export function RevokeInvitationForm({ invitationId }: { invitationId: string }) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(revokeInvitationAction, ADMIN_IDLE_STATE);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input name="invitationId" type="hidden" value={invitationId} />
      <ConfirmButton message="Batalkan undangan ini? Tautan aktivasi tidak akan berlaku lagi." pendingLabel="Membatalkan...">
        Batalkan undangan
      </ConfirmButton>
      {state.status !== "idle" ? (
        <span
          aria-live="polite"
          className={state.status === "error" ? "text-xs font-medium text-red-700" : "text-xs font-medium text-emerald-700"}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function AdminStatusForm({
  adminUserId,
  currentStatus,
}: {
  adminUserId: string;
  currentStatus: "INVITED" | "ACTIVE" | "SUSPENDED" | "DISABLED";
}) {
  const [state, formAction, isPending] = useActionState<AdminFormState, FormData>(
    changeAdministratorStatusAction,
    ADMIN_IDLE_STATE,
  );

  const options = [
    ...(currentStatus === "ACTIVE" ? [] : [{ value: "ACTIVE", label: "Aktifkan" }]),
    ...(currentStatus === "SUSPENDED" ? [] : [{ value: "SUSPENDED", label: "Tangguhkan" }]),
    ...(currentStatus === "DISABLED" ? [] : [{ value: "DISABLED", label: "Nonaktifkan" }]),
  ];

  if (options.length === 0) {
    return null;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input name="adminUserId" type="hidden" value={adminUserId} />
      <div className="min-w-44">
        <SelectField label="Ubah status" name="nextStatus" options={options} />
      </div>
      <SubmitButton pendingLabel={isPending ? "Menyimpan..." : undefined} variant="secondary">
        Terapkan
      </SubmitButton>
      {state.status !== "idle" ? (
        <p
          aria-live="polite"
          className={`basis-full text-xs font-medium ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Permanent account deletion.
 *
 * The Server Action and the service re-check the typed address, so this control
 * only reduces accidental clicks. It stays collapsed until the operator asks for
 * it, and the submit button stays disabled until the address matches exactly.
 */
export function DeleteAdminForm({
  adminUserId,
  accountEmail,
}: {
  adminUserId: string;
  accountEmail: string;
}) {
  const [state, formAction, isPending] = useActionState<AdminFormState, FormData>(
    deleteAdministratorAction,
    ADMIN_IDLE_STATE,
  );
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const matches = confirmation.trim().toLowerCase() === accountEmail.trim().toLowerCase();
  const fieldId = `delete-confirm-${adminUserId}`;

  if (state.status === "success") {
    return (
      <p aria-live="polite" className="text-xs font-medium text-emerald-700" role="status">
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        aria-expanded={false}
        className="min-h-11 text-xs font-semibold text-red-700 underline decoration-red-300 underline-offset-4 transition hover:text-red-800"
        onClick={() => setOpen(true)}
        type="button"
      >
        Hapus permanen
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full rounded-[var(--radius)] border border-red-200 bg-red-50 p-3">
      <input name="adminUserId" type="hidden" value={adminUserId} />
      <p className="text-xs leading-5 text-red-900">
        Penghapusan tidak dapat dibatalkan. Sesi, undangan yang menunggu, dan token pemulihan akun ini akan dicabut.
        Ketik alamat surel akun untuk mengonfirmasi.
      </p>
      <label className="mt-2 block text-xs font-semibold text-red-900" htmlFor={fieldId}>
        Alamat surel akun
      </label>
      <input
        autoComplete="off"
        className="mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-red-300 bg-white px-3 text-sm text-[var(--ink)] outline-none transition focus:border-red-600 focus:ring-4 focus:ring-red-100"
        id={fieldId}
        inputMode="email"
        name="confirmation"
        onChange={(event) => setConfirmation(event.target.value)}
        type="email"
        value={confirmation}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="min-h-11 rounded-[var(--radius)] bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!matches || isPending}
          type="submit"
        >
          {isPending ? "Menghapus..." : "Hapus permanen"}
        </button>
        <button
          className="min-h-11 rounded-[var(--radius)] border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 transition hover:bg-red-100"
          onClick={() => {
            setOpen(false);
            setConfirmation("");
          }}
          type="button"
        >
          Batal
        </button>
      </div>
      {state.status === "error" ? (
        <p aria-live="polite" className="mt-2 text-xs font-medium text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
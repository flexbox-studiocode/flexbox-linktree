"use client";

import { useActionState } from "react";

import {
  changeAdministratorStatusAction,
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
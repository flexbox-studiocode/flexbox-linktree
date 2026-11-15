"use client";

import { useActionState } from "react";

import { completePasswordResetAction } from "@/features/auth/actions/account";
import { IDLE_STATE } from "@/features/auth/actions/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/security/password-policy";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(completePasswordResetAction, IDLE_STATE);

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <input name="token" type="hidden" value={token} readOnly />
      <div>
        <label className="block text-sm font-semibold text-[var(--ink)]" htmlFor="reset-new-password">
          Kata sandi baru
        </label>
        <input
          autoComplete="new-password"
          className="mt-2 block min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] shadow-sm outline-none transition focus:border-[var(--blue-strong)] focus:ring-4 focus:ring-[var(--blue-soft)]"
          id="reset-new-password"
          minLength={PASSWORD_MIN_LENGTH}
          name="newPassword"
          required
          type="password"
        />
        <p className="mt-2 text-xs text-[var(--muted)]">Minimal {PASSWORD_MIN_LENGTH} karakter.</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-[var(--ink)]" htmlFor="reset-confirm-password">
          Ulangi kata sandi baru
        </label>
        <input
          autoComplete="new-password"
          className="mt-2 block min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] shadow-sm outline-none transition focus:border-[var(--blue-strong)] focus:ring-4 focus:ring-[var(--blue-soft)]"
          id="reset-confirm-password"
          minLength={PASSWORD_MIN_LENGTH}
          name="confirmPassword"
          required
          type="password"
        />
      </div>
      {state.status !== "idle" && state.message ? (
        <p
          aria-live="polite"
          className={
            state.status === "success"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
              : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
          }
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
      <button
        className="min-h-12 w-full rounded-xl bg-[var(--blue-strong)] px-6 text-sm font-bold text-white transition hover:bg-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Menyimpan…" : "Atur ulang kata sandi"}
      </button>
    </form>
  );
}

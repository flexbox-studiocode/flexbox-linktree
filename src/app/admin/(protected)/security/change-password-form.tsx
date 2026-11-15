"use client";

import { useActionState } from "react";

import { changePasswordAction } from "@/features/auth/actions/account";
import { IDLE_STATE } from "@/features/auth/actions/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/security/password-policy";

/**
 * Self-service password change.
 *
 * Client-side checks (required fields, matching confirmation) only improve
 * ergonomics; the password policy, current-password verification, session
 * revocation, and audit trail are enforced by the Server Action.
 */
export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, IDLE_STATE);

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <div>
        <label className="block text-sm font-semibold text-[var(--ink)]" htmlFor="currentPassword">
          Kata sandi saat ini
        </label>
        <input
          autoComplete="current-password"
          className="mt-2 block min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] shadow-sm outline-none transition focus:border-[var(--blue-strong)] focus:ring-4 focus:ring-[var(--blue-soft)]"
          id="currentPassword"
          name="currentPassword"
          required
          type="password"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-[var(--ink)]" htmlFor="newPassword">
            Kata sandi baru
          </label>
          <input
            autoComplete="new-password"
            className="mt-2 block min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] shadow-sm outline-none transition focus:border-[var(--blue-strong)] focus:ring-4 focus:ring-[var(--blue-soft)]"
            id="newPassword"
            minLength={PASSWORD_MIN_LENGTH}
            name="newPassword"
            required
            type="password"
          />
          <p className="mt-2 text-xs text-[var(--muted)]">Minimal {PASSWORD_MIN_LENGTH} karakter.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-[var(--ink)]" htmlFor="confirmPassword">
            Ulangi kata sandi baru
          </label>
          <input
            autoComplete="new-password"
            className="mt-2 block min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] shadow-sm outline-none transition focus:border-[var(--blue-strong)] focus:ring-4 focus:ring-[var(--blue-soft)]"
            id="confirmPassword"
            minLength={PASSWORD_MIN_LENGTH}
            name="confirmPassword"
            required
            type="password"
          />
        </div>
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
        className="min-h-12 rounded-xl bg-[var(--blue-strong)] px-6 text-sm font-bold text-white transition hover:bg-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Menyimpan…" : "Perbarui kata sandi"}
      </button>
    </form>
  );
}

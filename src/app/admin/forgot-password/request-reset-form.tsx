"use client";

import { useActionState } from "react";

import { requestPasswordResetAction } from "@/features/auth/actions/account";
import { IDLE_STATE } from "@/features/auth/actions/form-state";

/** Non-enumerating administrator password-recovery request form. */
export function RequestResetForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, IDLE_STATE);

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <div>
        <label className="block text-sm font-semibold text-[var(--ink)]" htmlFor="reset-email">
          Email akun administrator
        </label>
        <input
          autoComplete="email"
          className="mt-2 block min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] shadow-sm outline-none transition focus:border-[var(--blue-strong)] focus:ring-4 focus:ring-[var(--blue-soft)]"
          id="reset-email"
          name="email"
          required
          type="email"
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
        {isPending ? "Mengirim…" : "Kirim tautan pengaturan ulang"}
      </button>
    </form>
  );
}

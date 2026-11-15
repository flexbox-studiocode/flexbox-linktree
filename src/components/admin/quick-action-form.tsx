"use client";

import { useActionState } from "react";

import { ADMIN_IDLE_STATE, type AdminFormState } from "@/features/admin/actions/form-state";
import { ConfirmButton, SubmitButton } from "@/components/admin/form-controls";

/**
 * Compact inline form for single-step CMS mutations.
 *
 * Used for publish/archive transitions, activation toggles, reordering, deletes,
 * and account status changes. The Server Action re-authorizes and re-validates
 * every hidden value, so none of them are trusted because they came from a form.
 */

type Action = (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;

export function QuickActionForm({
  action,
  fields,
  label,
  variant = "secondary",
  confirm,
  pendingLabel,
  align = "start",
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  confirm?: string;
  pendingLabel?: string;
  align?: "start" | "end";
}) {
  const [state, formAction] = useActionState(action, ADMIN_IDLE_STATE);

  return (
    <form action={formAction} className={align === "end" ? "flex flex-col items-end gap-1" : "flex flex-col gap-1"}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      {confirm ? (
        <ConfirmButton message={confirm} pendingLabel={pendingLabel} variant={variant}>
          {label}
        </ConfirmButton>
      ) : (
        <SubmitButton pendingLabel={pendingLabel} variant={variant}>
          {label}
        </SubmitButton>
      )}
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
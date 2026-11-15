"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { ADMIN_IDLE_STATE, type AdminFormState } from "@/features/admin/actions/form-state";

/**
 * Presentational form controls shared by the CMS forms.
 *
 * These are Client Components only because they read submission state; they hold
 * no application state and never validate. Every rule is enforced by the Server
 * Action and the service layer behind it.
 */

const INPUT_CLASS =
  "mt-2 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--blue-strong)] focus:ring-4 focus:ring-[var(--blue-soft)]";

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">{children}</p>;
}

export function TextField({
  name,
  label,
  defaultValue,
  placeholder,
  hint,
  required,
  type = "text",
  inputMode,
  min,
  max,
  pattern,
  autoComplete,
  readOnly,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  hint?: ReactNode;
  required?: boolean;
  type?: string;
  inputMode?: "text" | "numeric" | "url" | "email";
  min?: number;
  max?: number;
  pattern?: string;
  autoComplete?: string;
  readOnly?: boolean;
}) {
  const id = `field-${name}`;

  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--ink)]" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={hint ? `${id}-hint` : undefined}
        autoComplete={autoComplete}
        className={INPUT_CLASS}
        defaultValue={defaultValue ?? undefined}
        id={id}
        inputMode={inputMode}
        max={max}
        min={min}
        name={name}
        pattern={pattern}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        type={type}
      />
      {hint ? <div id={`${id}-hint`}>{typeof hint === "string" ? <FieldHint>{hint}</FieldHint> : hint}</div> : null}
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  defaultValue,
  hint,
  rows = 3,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  hint?: string;
  rows?: number;
}) {
  const id = `field-${name}`;

  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--ink)]" htmlFor={id}>
        {label}
      </label>
      <textarea
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`${INPUT_CLASS} py-2`}
        defaultValue={defaultValue ?? undefined}
        id={id}
        name={name}
        rows={rows}
      />
      {hint ? (
        <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  hint,
  required,
  onChange,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
  required?: boolean;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  const id = `field-${name}`;

  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--ink)]" htmlFor={id}>
        {label}
      </label>
      <select
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={INPUT_CLASS}
        defaultValue={defaultValue}
        id={id}
        name={name}
        onChange={onChange}
        required={required}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function CheckboxField({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  const id = `field-${name}`;

  return (
    <div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-[var(--ink)]" htmlFor={id}>
        <input
          className="size-5 rounded border-[var(--line-strong)] text-[var(--blue-strong)] focus:ring-4 focus:ring-[var(--blue-soft)]"
          defaultChecked={defaultChecked}
          id={id}
          name={name}
          type="checkbox"
        />
        {label}
      </label>
      {hint ? <p className="ml-8 text-xs leading-5 text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function FormMessage({ state }: { state: AdminFormState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={
        state.status === "success"
          ? "rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          : "rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
      }
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

export function TokenNotice({ token }: { token?: string }) {
  if (!token) {
    return null;
  }

  return (
    <div className="rounded-[var(--radius)] border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">Token undangan (ditampilkan sekali)</p>
      <code className="mt-2 block break-all rounded bg-white px-3 py-2 font-mono text-xs text-[var(--ink)]">
        {token}
      </code>
      <p className="mt-2 text-xs leading-5 text-amber-900">
        Serahkan token ini secara langsung kepada anggota yang dituju. Token tidak disimpan dalam bentuk asli dan
        tidak akan ditampilkan lagi.
      </p>
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();

  const variantClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : variant === "secondary"
        ? "border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--blue-soft)]"
        : "bg-[var(--blue-strong)] hover:bg-[var(--ink)]";

  return (
    <button
      className={`min-h-11 rounded-[var(--radius)] px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${
        variant === "secondary" ? "" : "text-white"
      }`}
      disabled={pending}
      type="submit"
    >
      {pending ? (pendingLabel ?? "Menyimpan...") : children}
    </button>
  );
}

export function ConfirmButton({
  children,
  message,
  variant = "danger",
  pendingLabel,
}: {
  children: ReactNode;
  message: string;
  variant?: "primary" | "secondary" | "danger";
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  const variantClass =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : variant === "secondary"
        ? "border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--blue-soft)]"
        : "bg-[var(--blue-strong)] text-white hover:bg-[var(--ink)]";

  return (
    <button
      className={`min-h-11 rounded-[var(--radius)] px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass}`}
      disabled={pending}
      onClick={(event) => {
        // Destructive actions always require an explicit confirmation.
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      {pending ? (pendingLabel ?? "Memproses...") : children}
    </button>
  );
}

/**
 * Wraps a form with `useActionState` and renders the resulting message.
 *
 * The Server Action itself authorizes and validates; this wrapper only presents
 * the outcome and keeps the submitted values in place after an error.
 */
export function ActionForm({
  action,
  children,
  className = "space-y-5",
  hidden,
}: {
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  children: ReactNode;
  className?: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, ADMIN_IDLE_STATE);

  return (
    <form action={formAction} className={className} noValidate>
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (
            <input key={name} name={name} type="hidden" value={value} />
          ))
        : null}
      <FormMessage state={state} />
      <TokenNotice token={state.token} />
      {children}
    </form>
  );
}
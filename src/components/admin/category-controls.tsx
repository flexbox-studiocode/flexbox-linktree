"use client";

import { useActionState } from "react";

import { deleteCategoryAction, toggleCategoryActiveAction } from "@/features/admin/actions/categories";
import { ADMIN_IDLE_STATE, type AdminFormState } from "@/features/admin/actions/form-state";
import { ConfirmButton, FormMessage, SelectField } from "@/components/admin/form-controls";

/**
 * Category lifecycle controls.
 *
 * Deleting a category that still owns links requires choosing a destination
 * category, so links are never orphaned. The database `RESTRICT` constraint is
 * the last line of defence.
 */

export function CategoryDeleteForm({
  categoryId,
  categoryName,
  linkCount,
  alternatives,
}: {
  categoryId: string;
  categoryName: string;
  linkCount: number;
  alternatives: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(deleteCategoryAction, ADMIN_IDLE_STATE);

  const requiresTarget = linkCount > 0;

  return (
    <form action={formAction} className="space-y-4">
      <input name="categoryId" type="hidden" value={categoryId} />
      <FormMessage state={state} />

      {requiresTarget ? (
        <>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Kategori ini memiliki {linkCount} tautan. Pilih kategori tujuan; seluruh tautan dipindahkan sebelum
            kategori dihapus.
          </p>
          <SelectField
            label="Kategori tujuan"
            name="targetCategoryId"
            options={[{ value: "", label: "Pilih kategori tujuan..." }, ...alternatives.map((c) => ({ value: c.id, label: c.name }))]}
            required
          />
        </>
      ) : (
        <p className="text-sm leading-6 text-[var(--muted)]">
          Kategori ini tidak memiliki tautan dan dapat dihapus langsung.
        </p>
      )}

      <ConfirmButton
        message={`Hapus kategori "${categoryName}"${requiresTarget ? " beserta pemindahan tautannya" : ""}? Tindakan ini tidak dapat dibatalkan.`}
        pendingLabel="Menghapus..."
      >
        Hapus kategori
      </ConfirmButton>
    </form>
  );
}

export function CategoryActiveToggle({ categoryId, isActive }: { categoryId: string; isActive: boolean }) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(toggleCategoryActiveAction, ADMIN_IDLE_STATE);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input name="categoryId" type="hidden" value={categoryId} />
      <input name="isActive" type="hidden" value={isActive ? "" : "on"} />
      <button
        className="min-h-11 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--blue-soft)]"
        type="submit"
      >
        {isActive ? "Nonaktifkan" : "Aktifkan"}
      </button>
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
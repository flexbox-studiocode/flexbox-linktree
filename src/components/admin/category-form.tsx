"use client";

import { useActionState } from "react";

import {
  createCategoryAction,
  updateCategoryAction,
} from "@/features/admin/actions/categories";
import { ADMIN_IDLE_STATE, type AdminFormState } from "@/features/admin/actions/form-state";
import { CheckboxField, FieldHint, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/admin/form-controls";

export type CategoryFormValues = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
};

/** Category create/edit form. Slug uniqueness is enforced by the database. */
export function CategoryForm({ defaultValues }: { defaultValues?: CategoryFormValues }) {
  const isEdit = Boolean(defaultValues?.id);

  const [state, formAction] = useActionState<AdminFormState, FormData>(
    isEdit ? updateCategoryAction : createCategoryAction,
    ADMIN_IDLE_STATE,
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {isEdit ? <input name="categoryId" type="hidden" value={defaultValues?.id} /> : null}

      <FormMessage state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          defaultValue={defaultValues?.name ?? ""}
          label="Nama kategori"
          name="name"
          placeholder="Sumber Daya"
          required
        />
        <TextField
          defaultValue={defaultValues?.slug ?? ""}
          hint={<FieldHint>Huruf kecil, angka, tanda hubung. Kosongkan untuk dibuat otomatis dari nama.</FieldHint>}
          label="Slug"
          name="slug"
          placeholder="sumber-daya"
        />
      </div>

      <TextAreaField
        defaultValue={defaultValues?.description ?? undefined}
        hint="Opsional. Muncul sebagai pengantar singkat kategori."
        label="Deskripsi"
        name="description"
        rows={2}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          defaultValue={defaultValues?.icon ?? undefined}
          hint="Nama ikon opsional."
          label="Ikon"
          name="icon"
          placeholder="book-open"
        />
        <TextField
          defaultValue={String(defaultValues?.sortOrder ?? 0)}
          hint="Urutan kategori di halaman publik. 0 berarti otomatis di akhir."
          label="Urutan"
          min={0}
          name="sortOrder"
          type="number"
        />
      </div>

      <CheckboxField
        defaultChecked={defaultValues?.isActive ?? true}
        hint="Kategori nonaktif menyembunyikan seluruh tautan di dalamnya dari publik."
        label="Aktif"
        name="isActive"
      />

      <div className="border-t border-[var(--line)] pt-5">
        <SubmitButton pendingLabel="Menyimpan...">
          {isEdit ? "Simpan perubahan" : "Buat kategori"}
        </SubmitButton>
      </div>
    </form>
  );
}
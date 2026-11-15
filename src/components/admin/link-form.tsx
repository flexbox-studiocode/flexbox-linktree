"use client";

import { useActionState, useState } from "react";

import {
  createLinkAction,
  updateLinkAction,
} from "@/features/admin/actions/links";
import { ADMIN_IDLE_STATE, type AdminFormState } from "@/features/admin/actions/form-state";
import { CheckboxField, FieldHint, SelectField, TextAreaField, TextField } from "@/components/admin/form-controls";
import type { PublicationStatus, LinkDestinationType } from "@/generated/prisma/enums";
import { publicAnchors } from "@/features/content/constants";

export type LinkFormCategory = { id: string; name: string; slug: string; isActive: boolean };

export type LinkFormValues = {
  id?: string;
  slug: string;
  categoryId: string;
  title: string;
  description: string | null;
  icon: string | null;
  tag: string | null;
  destinationType: LinkDestinationType;
  destinationUrl: string | null;
  internalAnchor: string | null;
  status: PublicationStatus;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
};

type Props = {
  defaultValues?: LinkFormValues;
  categories: LinkFormCategory[];
  isEdit?: boolean;
};

function LinkFormInner({ defaultValues, categories, isEdit }: Props) {
  const [state, formAction, isPending] = useActionState<AdminFormState, FormData>(
    isEdit ? updateLinkAction : createLinkAction,
    ADMIN_IDLE_STATE,
  );

  const [destinationType, setDestinationType] = useState<LinkDestinationType>(
    defaultValues?.destinationType ?? "EXTERNAL",
  );

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name + (c.isActive ? "" : " (nonaktif)"),
  }));

  const statusOptions = [
    { value: "DRAFT", label: "Konsep" },
    { value: "PUBLISHED", label: "Terbit" },
    { value: "ARCHIVED", label: "Arsip" },
  ];

  const destinationOptions = [
    { value: "EXTERNAL", label: "Eksternal" },
    { value: "INTERNAL", label: "Internal" },
    { value: "NONE", label: "Nonaktif (segera)" },
  ];

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {isEdit && defaultValues?.id ? (
        <input name="linkId" type="hidden" value={defaultValues.id} />
      ) : null}

      {state.status !== "idle" && state.message ? (
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
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          defaultValue={defaultValues?.title ?? ""}
          label="Judul tautan"
          name="title"
          placeholder="Contoh: GitHub Flexbox"
          required
        />
        <TextField
          defaultValue={defaultValues?.slug ?? ""}
          hint={<FieldHint>Huruf kecil, angka, dan tanda hubung. Kosongkan untuk dibuat otomatis.</FieldHint>}
          label="Slug"
          name="slug"
          placeholder="github-flexbox"
        />
      </div>

      <SelectField
        defaultValue={defaultValues?.categoryId ?? ""}
        label="Kategori"
        name="categoryId"
        options={[{ value: "", label: "Pilih kategori..." }, ...categoryOptions]}
        required
      />

      <TextAreaField
        defaultValue={defaultValues?.description ?? undefined}
        hint="Opsional. Deskripsi singkat yang muncul di kartu tautan."
        label="Deskripsi"
        name="description"
        rows={2}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <TextField
          defaultValue={defaultValues?.icon ?? undefined}
          hint="Nama ikon opsional (Lucide)."
          label="Ikon"
          name="icon"
          placeholder="github"
        />
        <TextField
          defaultValue={defaultValues?.tag ?? undefined}
          hint="Label kecil, contoh: Baru, Wajib."
          label="Tag"
          name="tag"
          placeholder="Baru"
        />
        <TextField
          defaultValue={String(defaultValues?.sortOrder ?? 0)}
          hint="Posisi dalam kategori."
          label="Urutan"
          min={0}
          name="sortOrder"
          type="number"
        />
      </div>

      <SelectField
        defaultValue={defaultValues?.destinationType ?? "EXTERNAL"}
        label="Jenis tujuan"
        name="destinationType"
        options={destinationOptions}
        onChange={(e) => setDestinationType(e.target.value as LinkDestinationType)}
      />

      {destinationType === "EXTERNAL" && (
        <TextField
          defaultValue={defaultValues?.destinationUrl ?? undefined}
          inputMode="url"
          label="URL tujuan"
          name="destinationUrl"
          pattern="https?://.*"
          placeholder="https://github.com/flexbox"
          required
          type="url"
        />
      )}

      {destinationType === "INTERNAL" && (
        <SelectField
          defaultValue={defaultValues?.internalAnchor ?? ""}
          label="Anchor internal"
          name="internalAnchor"
          options={[
            { value: "", label: "Pilih anchor..." },
            ...Object.values(publicAnchors).map((anchor) => ({ value: anchor, label: anchor })),
          ]}
          required
        />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          defaultValue={defaultValues?.status ?? "DRAFT"}
          label="Status publikasi"
          name="status"
          options={statusOptions}
        />

        <div className="space-y-4">
          <CheckboxField
            defaultChecked={defaultValues?.isActive ?? true}
            hint="Tautan nonaktif tidak tampil di halaman publik walau status terbit."
            label="Aktif"
            name="isActive"
          />
          <CheckboxField
            defaultChecked={defaultValues?.isFeatured ?? false}
            hint="Tautan unggulan tampil lebih menonjol jika fitur diaktifkan."
            label="Unggulan"
            name="isFeatured"
          />
        </div>
      </div>

      <div className="flex gap-3 border-t border-[var(--line)] pt-5">
        <button
          className="min-h-11 rounded-[var(--radius)] bg-[var(--blue-strong)] px-6 text-sm font-bold text-white transition hover:bg-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Buat tautan"}
        </button>
      </div>
    </form>
  );
}

export function LinkForm(props: Props) {
  return <LinkFormInner {...props} />;
}
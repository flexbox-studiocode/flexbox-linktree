"use client";

import { useActionState } from "react";

import { updateSettingAction } from "@/features/admin/actions/settings";
import { ADMIN_IDLE_STATE, type AdminFormState } from "@/features/admin/actions/form-state";
import { FormMessage, SubmitButton, TextField } from "@/components/admin/form-controls";
import type { SettingsFormValues } from "@/features/content/settings-form";
import type { SiteSettingKey } from "@/features/content/schemas/site-setting";

/**
 * Website settings editor.
 *
 * One form per settings group. Field order and labels are defined here; the
 * accepted shape is defined by the Zod schema for that key on the server. There
 * is no raw HTML, script, or CSS field anywhere in this form.
 */

type FieldSpec = {
  name: string;
  label: string;
  hint?: string;
  type?: "text" | "url" | "email";
  multiline?: boolean;
};

type GroupSpec = {
  key: SiteSettingKey;
  title: string;
  description: string;
  fields: FieldSpec[];
};

const GROUPS: GroupSpec[] = [
  {
    key: "general",
    title: "Identitas situs",
    description: "Nama studio, wordmark header, dan label pendukung.",
    fields: [
      { name: "name", label: "Nama situs" },
      { name: "wordmark", label: "Wordmark" },
      { name: "wordmarkSuffix", label: "Akhiran wordmark" },
      { name: "supportingLabel", label: "Label pendukung" },
    ],
  },
  {
    key: "navigation",
    title: "Navigasi header",
    description: "Label navigasi dan tombol kontak di header publik.",
    fields: [
      { name: "headerNavLabel", label: "Label tautan direktori" },
      { name: "contactNavLabel", label: "Label tautan kontak" },
      { name: "headerCtaLabel", label: "Label tombol header" },
    ],
  },
  {
    key: "hero",
    title: "Hero",
    description: "Eyebrow, judul, deskripsi, dan label CTA hero.",
    fields: [
      { name: "heroEyebrow", label: "Eyebrow" },
      { name: "heroTitle", label: "Judul" },
      { name: "heroDescription", label: "Deskripsi", multiline: true },
      { name: "heroCtaLabel", label: "Label CTA" },
    ],
  },
  {
    key: "directory",
    title: "Direktori",
    description: "Judul dan pengantar bagian direktori.",
    fields: [
      { name: "directoryEyebrow", label: "Eyebrow" },
      { name: "directoryTitle", label: "Judul" },
      { name: "directoryDescription", label: "Deskripsi", multiline: true },
    ],
  },
  {
    key: "contact",
    title: "Kontak",
    description: "Pesan kontak dan alamat surel terverifikasi. Kosongkan surel untuk menampilkan status menunggu.",
    fields: [
      { name: "contactEyebrow", label: "Eyebrow" },
      { name: "contactTitle", label: "Judul" },
      { name: "contactDescription", label: "Deskripsi", multiline: true },
      { name: "contactCtaLabel", label: "Label CTA" },
      { name: "contactPendingLabel", label: "Label status menunggu" },
      { name: "contactEmail", label: "Alamat surel", type: "email", hint: "Kosongkan bila kanal kontak belum diverifikasi." },
    ],
  },
  {
    key: "footer",
    title: "Footer",
    description: "Tagline dan nama pemegang hak cipta.",
    fields: [
      { name: "footerTagline", label: "Tagline", multiline: true },
      { name: "copyrightName", label: "Nama hak cipta" },
    ],
  },
  {
    key: "seo",
    title: "SEO dan berbagi",
    description: "Metadata halaman publik. URL harus absolut dan menggunakan HTTP(S).",
    fields: [
      { name: "title", label: "Judul halaman" },
      { name: "description", label: "Deskripsi meta", multiline: true },
      { name: "canonicalUrl", label: "URL kanonik", type: "url", hint: "Kosongkan sampai domain produksi disetujui." },
      { name: "openGraphImage", label: "Gambar Open Graph", type: "url", hint: "URL absolut ke gambar publik." },
    ],
  },
];

function SettingsGroupForm({
  group,
  values,
}: {
  group: GroupSpec;
  values: Record<string, string | null>;
}) {
  const [state, formAction, isPending] = useActionState<AdminFormState, FormData>(
    updateSettingAction,
    ADMIN_IDLE_STATE,
  );

  return (
    <section
      aria-labelledby={`settings-${group.key}`}
      className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <h2 className="text-lg font-semibold text-[var(--ink)]" id={`settings-${group.key}`}>
        {group.title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{group.description}</p>

      <form action={formAction} className="mt-5 space-y-4" noValidate>
        <input name="settingKey" type="hidden" value={group.key} />
        <FormMessage state={state} />

        {group.fields.map((field) =>
          field.multiline ? (
            <div key={field.name}>
              <label className="block text-sm font-semibold text-[var(--ink)]" htmlFor={`${group.key}-${field.name}`}>
                {field.label}
              </label>
              <textarea
                className="mt-2 block w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--blue-strong)] focus:ring-4 focus:ring-[var(--blue-soft)]"
                defaultValue={values[field.name] ?? ""}
                id={`${group.key}-${field.name}`}
                name={field.name}
                rows={3}
              />
            </div>
          ) : (
            <TextField
              defaultValue={values[field.name] ?? ""}
              hint={field.hint}
              inputMode={field.type === "url" ? "url" : field.type === "email" ? "email" : "text"}
              key={field.name}
              label={field.label}
              name={field.name}
              type={field.type ?? "text"}
            />
          ),
        )}

        <div className="border-t border-[var(--line)] pt-4">
          <SubmitButton pendingLabel={isPending ? "Menyimpan..." : undefined}>Simpan {group.title.toLowerCase()}</SubmitButton>
        </div>
      </form>
    </section>
  );
}

export function SettingsForm({ values }: { values: SettingsFormValues }) {
  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <SettingsGroupForm group={group} key={group.key} values={values[group.key]} />
      ))}
    </div>
  );
}
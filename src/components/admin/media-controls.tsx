"use client";

import { useActionState, useRef, useState } from "react";

import {
  deleteMediaAction,
  updateMediaAltAction,
  uploadMediaAction,
} from "@/features/admin/actions/media";
import { ADMIN_IDLE_STATE, type AdminFormState } from "@/features/admin/actions/form-state";
import {
  ConfirmButton,
  FormMessage,
  SubmitButton,
  TextField,
} from "@/components/admin/form-controls";

/**
 * Media library controls.
 *
 * The browser `accept` list is a convenience filter only: the Server Action and
 * the validator reject anything whose real bytes are not an allowed image type.
 */

export function MediaUploadForm() {
  const [state, formAction] = useActionState<AdminFormState, FormData>(uploadMediaAction, ADMIN_IDLE_STATE);
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <div>
        <label className="block text-sm font-semibold text-[var(--ink)]" htmlFor="media-file">
          Berkas gambar
        </label>
        <input
          accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/x-icon"
          className="mt-2 block w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] file:mr-3 file:rounded file:border-0 file:bg-[var(--blue-soft)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--blue-strong)]"
          id="media-file"
          name="file"
          ref={fileInput}
          required
          type="file"
        />
        <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
          PNG, JPEG, GIF, WebP, AVIF, atau ICO. Maksimal 5 MB. SVG ditolak karena dapat memuat skrip.
        </p>
      </div>

      <TextField hint="Wajib untuk gambar yang menyampaikan informasi." label="Teks alternatif" name="altText" />

      <SubmitButton pendingLabel="Mengunggah...">Unggah media</SubmitButton>
    </form>
  );
}

export function MediaAltForm({ mediaId, altText }: { mediaId: string; altText: string | null }) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(updateMediaAltAction, ADMIN_IDLE_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input name="mediaId" type="hidden" value={mediaId} />
      <div className="min-w-56 flex-1">
        <TextField defaultValue={altText ?? ""} label="Teks alternatif" name="altText" />
      </div>
      <SubmitButton pendingLabel="Menyimpan..." variant="secondary">
        Simpan
      </SubmitButton>
      {state.status !== "idle" ? (
        <p
          aria-live="polite"
          className={state.status === "error" ? "text-xs font-medium text-red-700" : "text-xs font-medium text-emerald-700"}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function MediaDeleteForm({ mediaId, name }: { mediaId: string; name: string }) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(deleteMediaAction, ADMIN_IDLE_STATE);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input name="mediaId" type="hidden" value={mediaId} />
      <ConfirmButton
        message={`Hapus "${name}"? Berkas di penyimpanan ikut dihapus dan tindakan ini tidak dapat dibatalkan.`}
        pendingLabel="Menghapus..."
      >
        Hapus
      </ConfirmButton>
      {state.status !== "idle" ? (
        <p
          aria-live="polite"
          className={state.status === "error" ? "text-xs font-medium text-red-700" : "text-xs font-medium text-emerald-700"}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/** Copies the absolute media URL for use in a settings or link field. */
export function CopyMediaUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="min-h-9 rounded-[var(--radius)] border border-[var(--line-strong)] px-3 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--blue-soft)]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
      type="button"
    >
      {copied ? "Tersalin" : "Salin URL"}
    </button>
  );
}
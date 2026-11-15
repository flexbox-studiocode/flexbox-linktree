import Image from "next/image";

import { MediaAltForm, MediaDeleteForm, MediaUploadForm } from "@/components/admin/media-controls";
import { Card, EmptyState, PageHeader, Pagination, Stat } from "@/components/admin/ui";
import { first, parsePageParams } from "@/features/admin/params";
import { getMediaLibrary } from "@/features/media/service";
import { requireAdmin } from "@/lib/auth/session";
import { formatBytes, formatJakartaDateTime, toIsoString } from "@/lib/utils/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Media library. Files live in the storage backend; only metadata is in PostgreSQL. */
export default async function AdminMediaPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const { page, pageSize } = parsePageParams({ page: first(params.page), pageSize: first(params.pageSize) });
  const library = await getMediaLibrary({ page, pageSize });

  return (
    <div className="space-y-6">
      <PageHeader
        description="Unggahan divalidasi dari isi berkas, bukan dari ekstensi. Aset yang masih dipakai tidak dapat dihapus."
        eyebrow="Flexbox Studio · Media"
        title="Perpustakaan media"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Aset" value={library.total} />
        <Stat hint="Total berkas tersimpan" label="Ukuran" value={formatBytes(library.totalBytes)} />
        <Stat hint="Batas per berkas" label="Batas unggah" value="5 MB" />
      </div>

      <Card>
        <h2 className="text-base font-semibold text-[var(--ink)]">Unggah media</h2>
        <div className="mt-4">
          <MediaUploadForm />
        </div>
      </Card>

      {library.items.length === 0 ? (
        <EmptyState
          description="Belum ada aset. Unggah logo, favicon, atau gambar berbagi untuk digunakan di pengaturan situs."
          title="Perpustakaan kosong"
        />
      ) : (
        <ul className="space-y-3">
          {library.items.map((asset) => (
            <li key={asset.id}>
              <Card>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--page)]">
                    <Image
                      alt={asset.altText ?? ""}
                      className="object-contain"
                      fill
                      sizes="96px"
                      src={asset.url}
                      unoptimized
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-semibold text-[var(--ink)]">{asset.originalName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {asset.mimeType} · {formatBytes(asset.sizeBytes)}
                      {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""} · diunggah{" "}
                      <time dateTime={toIsoString(asset.createdAt)}>{formatJakartaDateTime(asset.createdAt)}</time>
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-[var(--muted)]">{asset.url}</p>

                    <div className="mt-3">
                      <MediaAltForm altText={asset.altText} mediaId={asset.id} />
                    </div>
                  </div>

                  <MediaDeleteForm mediaId={asset.id} name={asset.originalName} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Pagination basePath="/admin/media" page={library.page} pageCount={library.pageCount} params={{}} />
    </div>
  );
}
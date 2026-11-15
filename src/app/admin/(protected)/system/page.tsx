import { Card, PageHeader, StatusBadge } from "@/components/admin/ui";
import { getSystemStatus } from "@/features/admin/services/system-status";
import { requireAdmin } from "@/lib/auth/session";
import { formatJakartaDateTime } from "@/lib/utils/format";

/** Operational status and configuration health. */
export default async function SystemStatusPage() {
  await requireAdmin();

  const status = await getSystemStatus();

  return (
    <div className="space-y-6">
      <PageHeader
        description="Pemeriksaan konektivitas dan konfigurasi. Tidak ada rahasia yang dibaca atau ditampilkan di halaman ini."
        eyebrow="Flexbox Studio · Sistem"
        title="Status sistem"
      />

      <Card>
        <h2 className="text-base font-semibold text-[var(--ink)]">Runtime</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Node.js</dt>
            <dd className="mt-1 font-mono text-sm text-[var(--ink)]">{status.runtime.nodeVersion}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Lingkungan</dt>
            <dd className="mt-1 font-mono text-sm text-[var(--ink)]">{status.runtime.environment}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Driver media</dt>
            <dd className="mt-1 font-mono text-sm text-[var(--ink)]">{status.storage.driver}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Diperiksa</dt>
            <dd className="mt-1 text-sm text-[var(--muted)]">
              <time dateTime={status.runtime.generatedAt}>{formatJakartaDateTime(status.runtime.generatedAt)}</time>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-[var(--ink)]">Pemeriksaan sistem</h2>
        <dl className="mt-3 space-y-3">
          {status.checks.map((check) => (
            <div className="flex flex-wrap items-start justify-between gap-3" key={check.label}>
              <div className="min-w-0 flex-1">
                <dt className="text-sm font-semibold text-[var(--ink)]">{check.label}</dt>
                <dd className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{check.detail}</dd>
              </div>
              <StatusBadge value={check.state === "ok" ? "OK" : check.state === "warning" ? "WARNING" : "ERROR"} />
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-[var(--ink)]">Publikasi konten</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{status.publication.detail}</p>
        <div className="mt-3">
          <StatusBadge value={status.publication.ready ? "OK" : "ERROR"} />
          <span className="ml-2 text-sm text-[var(--ink)]">
            {status.publication.ready ? "Sistem siap menyajikan konten publik." : "Koneksi basis data tidak tersedia."}
          </span>
        </div>
      </Card>
    </div>
  );
}
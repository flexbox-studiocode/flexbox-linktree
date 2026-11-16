import Link from "next/link";

import { formatMetricValue } from "@/components/admin/analytics/metric-card";
import { Card, EmptyState, PageHeader, PrimaryLink, Stat, StatusBadge } from "@/components/admin/ui";
import { getDashboardSummary } from "@/features/admin/services/dashboard";
import type { MetricComparison } from "@/features/analytics/types";
import { requireAdmin } from "@/lib/auth/session";
import { formatBytes, formatJakartaDateTime, toIsoString } from "@/lib/utils/format";

/** Plain-language comparison text for the compact dashboard KPI cards. */
function comparisonHint(comparison: MetricComparison, previousRange: string): string {
  if (comparison.isNew) {
    return `periode baru dibanding ${previousRange}`;
  }

  if (comparison.changePercent === null || comparison.changePercent === 0) {
    return `tidak ada perubahan dibanding ${previousRange}`;
  }

  const direction = comparison.changePercent > 0 ? "naik" : "turun";

  return `${direction} ${Math.abs(comparison.changePercent)}% dibanding ${previousRange}`;
}

/** CMS dashboard. Every figure is derived from stored data; nothing is estimated. */
export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const summary = await getDashboardSummary();
  const { content, media, admins, analytics, recentLinks, recentEvents, attention } = summary;
  const previousRange = `${analytics.comparisonRange.fromDay} sampai ${analytics.comparisonRange.toDay}`;
  const topLinks = analytics.links.slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <PrimaryLink href="/admin/links/new">Tautan baru</PrimaryLink>
            <Link
              className="inline-flex min-h-11 items-center rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--blue-soft)]"
              href="/admin/settings"
            >
              Pengaturan situs
            </Link>
          </>
        }
        description={`Masuk sebagai ${admin.name}. Ringkasan di bawah berasal dari data yang tersimpan, bukan perkiraan.`}
        eyebrow="Flexbox Studio · CMS"
        title="Dasbor"
      />

      <section aria-labelledby="content-stats">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]" id="content-stats">
          Konten
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat hint={`${content.published} terbit`} label="Total tautan" value={content.links} />
          <Stat hint="Menunggu peninjauan" label="Konsep" value={content.drafts} />
          <Stat hint={`${content.inactiveLinks} nonaktif`} label="Diarsipkan" value={content.archived} />
          <Stat
            hint={`${content.activeCategories} aktif · ${content.inactiveCategories} nonaktif`}
            label="Kategori"
            value={content.categories}
          />
        </div>
      </section>

      <section aria-labelledby="ops-stats">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]" id="ops-stats">
          Media dan akses
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat hint={formatBytes(media.totalBytes)} label="Aset media" value={media.total} />
          <Stat hint={`${admins.superAdmins} Super Admin`} label="Administrator" value={admins.total} />
          <Stat hint="Dapat masuk sekarang" label="Akun aktif" value={admins.active} />
          <Stat hint="Belum mengaktifkan akun" label="Undangan" value={admins.invited} />
        </div>
      </section>

      <section aria-labelledby="analytics-stats">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]" id="analytics-stats">
            Analitik · {analytics.range.fromDay} sampai {analytics.range.toDay}
          </h2>
          <Link className="text-sm font-semibold text-[var(--blue-strong)] underline" href="/admin/analytics">
            Buka analitik
          </Link>
        </div>

        {!analytics.availability.enabled ? (
          <Card className="mt-3 border-amber-300 bg-amber-50">
            <h3 className="text-base font-semibold text-amber-900">Pengumpulan analitik nonaktif</h3>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              <code className="font-mono text-xs">ANALYTICS_HASH_SECRET</code> belum diatur pada lingkungan ini, sehingga
              tidak ada peristiwa yang disimpan. Kolektor sengaja menolak mencatat data alih-alih memakai kunci yang tidak
              semestinya; tidak ada angka perkiraan yang ditampilkan.
            </p>
          </Card>
        ) : !analytics.availability.hasEvents ? (
          <Card className="mt-3">
            <h3 className="text-base font-semibold text-[var(--ink)]">
              Belum ada peristiwa pada rentang {analytics.range.fromDay} sampai {analytics.range.toDay}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Kolektor aktif
              {analytics.availability.lastEventAt ? (
                <>
                  {" "}
                  dan peristiwa terakhir diterima{" "}
                  <time dateTime={toIsoString(analytics.availability.lastEventAt)}>
                    {formatJakartaDateTime(analytics.availability.lastEventAt)}
                  </time>{" "}
                  WIB
                </>
              ) : (
                " tetapi belum ada peristiwa yang diterima sama sekali"
              )}
              . Kunjungi halaman publik lalu klik salah satu tautan untuk menghasilkan data. Tidak ada angka perkiraan
              yang ditampilkan untuk mengisi kekosongan ini.
            </p>
          </Card>
        ) : (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                hint={comparisonHint(analytics.comparison.pageViews, previousRange)}
                label="Kunjungan halaman"
                value={formatMetricValue(analytics.totals.pageViews)}
              />
              <Stat
                hint={comparisonHint(analytics.comparison.linkClicks, previousRange)}
                label="Klik tautan"
                value={formatMetricValue(analytics.totals.linkClicks)}
              />
              <Stat
                hint={comparisonHint(analytics.comparison.sessions, previousRange)}
                label="Sesi"
                value={formatMetricValue(analytics.totals.sessions)}
              />
              <Stat
                hint="Perkiraan perangkat, bukan jumlah orang"
                label="Pengunjung unik"
                value={formatMetricValue(analytics.totals.uniqueVisitors)}
              />
            </div>

            {topLinks.length > 0 ? (
              <Card className="mt-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-[var(--ink)]">Tautan paling diklik</h3>
                  <Link className="text-sm font-semibold text-[var(--blue-strong)] underline" href="/admin/analytics">
                    Laporan lengkap
                  </Link>
                </div>
                <ul className="mt-2 divide-y divide-[var(--line)]">
                  {topLinks.map((row) => (
                    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5" key={row.linkId}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--ink)]">{row.title}</p>
                        <p className="truncate font-mono text-xs text-[var(--muted)]">
                          {row.slug ?? "slug tidak tercatat"}
                        </p>
                      </div>
                      <p className="text-sm tabular-nums text-[var(--ink)]">
                        {formatMetricValue(row.clicks)} klik
                        <span className="text-[var(--muted)]"> · {row.sharePercent}%</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        )}
      </section>

      {attention.length > 0 ? (
        <Card>
          <h2 className="text-base font-semibold text-[var(--ink)]">Perlu perhatian</h2>
          <ul className="mt-3 space-y-3">
            {attention.map((item) => (
              <li key={item.href + item.label} className="text-sm leading-6">
                <Link className="font-semibold text-[var(--blue-strong)] underline" href={item.href}>
                  {item.label}
                </Link>
                <span className="text-[var(--muted)]"> — {item.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <h2 className="text-base font-semibold text-[var(--ink)]">Perlu perhatian</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Tidak ada tautan, kategori, atau undangan yang menunggu tindakan.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--ink)]">Tautan terakhir diubah</h2>
            <Link className="text-sm font-semibold text-[var(--blue-strong)] underline" href="/admin/links">
              Semua tautan
            </Link>
          </div>

          {recentLinks.length === 0 ? (
            <div className="mt-4">
              <EmptyState description="Belum ada tautan. Mulai dengan membuat tautan pertama." title="Belum ada tautan" />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {recentLinks.map((link) => (
                <li className="flex flex-wrap items-center justify-between gap-2 py-3" key={link.id}>
                  <div className="min-w-0">
                    <Link
                      className="block truncate text-sm font-semibold text-[var(--ink)] hover:underline"
                      href={`/admin/links/${link.id}`}
                    >
                      {link.title}
                    </Link>
                    <p className="truncate font-mono text-xs text-[var(--muted)]">{link.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={link.status} />
                    <time className="text-xs text-[var(--muted)]" dateTime={toIsoString(link.updatedAt)}>
                      {formatJakartaDateTime(link.updatedAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--ink)]">Aktivitas administratif</h2>
            <Link className="text-sm font-semibold text-[var(--blue-strong)] underline" href="/admin/audit-logs">
              Log audit
            </Link>
          </div>

          {recentEvents.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Belum ada peristiwa tercatat.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {recentEvents.map((event) => (
                <li className="py-3" key={event.id}>
                  <p className="font-mono text-xs font-semibold text-[var(--ink)]">{event.eventType}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {event.actor ? `${event.actor.fullName} (${event.actor.email})` : "Sistem"} ·{" "}
                    <time dateTime={toIsoString(event.createdAt)}>{formatJakartaDateTime(event.createdAt)}</time>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
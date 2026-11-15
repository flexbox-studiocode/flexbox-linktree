import Link from "next/link";

import {
  DistributionList,
  MetricCard,
  formatMetricValue,
} from "@/components/admin/analytics/metric-card";
import { AnalyticsRangeControls } from "@/components/admin/analytics/range-controls";
import { TrendChart } from "@/components/admin/analytics/trend-chart";
import { Card, EmptyState, PageHeader, SecondaryLink, StatusBadge } from "@/components/admin/ui";
import { findLinkFilterOptions } from "@/features/analytics/repositories/aggregates";
import { parseAnalyticsQuery, analyticsQueryToSearchParams } from "@/features/analytics/schemas/filters";
import { getAnalyticsReport } from "@/features/analytics/services/query-analytics";
import { requireAdmin } from "@/lib/auth/session";
import { formatJakartaDateTime, toIsoString } from "@/lib/utils/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const GRANULARITY_LABEL = {
  hour: "per jam",
  day: "harian",
  week: "mingguan",
  month: "bulanan",
} as const;

/**
 * Advanced analytics dashboard.
 *
 * Server-rendered, read-only, and admin-gated twice: the protected layout already
 * redirected an anonymous visitor, and this page calls `requireAdmin()` itself
 * because a layout gate is not a data authorization boundary. Every figure comes
 * from `getAnalyticsReport()`; nothing is sampled, estimated, or placeholder.
 */
export default async function AdminAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const query = parseAnalyticsQuery(params);
  const [report, linkOptions] = await Promise.all([getAnalyticsReport(query), findLinkFilterOptions()]);

  const exportHref = `/admin/analytics/export?${analyticsQueryToSearchParams({
    range: report.range,
    filters: report.filters,
    linkId: report.linkId,
    granularity: report.range.granularity,
  }).toString()}`;

  const { totals, comparison, availability } = report;
  const selectedLink = report.linkId ? linkOptions.find((link) => link.id === report.linkId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<SecondaryLink href="/admin/analytics/export">Ekspor CSV</SecondaryLink>}
        description={`Data kunjungan dan klik tautan dari ${report.range.fromDay} sampai ${report.range.toDay} (${report.range.timeZone}). Metrik dihitung dari peristiwa yang benar-benar terekam, tanpa perkiraan atau sampel.`}
        eyebrow="Flexbox Studio · Analitik"
        title="Analitik lanjutan"
      />

      {!availability.enabled ? (
        <Card className="border-amber-300 bg-amber-50">
          <h2 className="text-base font-semibold text-amber-900">Pengumpulan analitik nonaktif</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            <code className="font-mono text-xs">ANALYTICS_HASH_SECRET</code> belum diatur pada lingkungan ini, sehingga
            tidak ada peristiwa yang disimpan. Semua angka di bawah akan nol sampai kunci diatur dan lalu lintas baru
            terekam. Tanpa kunci, kolektor sengaja menolak menyimpan data alih-alih memakai kunci yang tidak semestinya.
          </p>
        </Card>
      ) : null}

      {availability.enabled && !availability.hasEvents ? (
        <Card>
          <h2 className="text-base font-semibold text-[var(--ink)]">Belum ada peristiwa pada rentang ini</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Kolektor aktif
            {availability.lastEventAt ? (
              <>
                {" "}
                dan peristiwa terakhir diterima{" "}
                <time dateTime={toIsoString(availability.lastEventAt)}>{formatJakartaDateTime(availability.lastEventAt)}</time>{" "}
                WIB
              </>
            ) : (
              " tetapi belum ada peristiwa yang diterima sama sekali"
            )}
            . Pilih rentang lain, atau buka halaman publik lalu klik salah satu tautan untuk menghasilkan data. Tidak ada
            angka perkiraan yang ditampilkan untuk mengisi kekosongan ini.
          </p>
        </Card>
      ) : null}

      {report.degraded ? (
        <Card className="border-amber-300 bg-amber-50">
          <h2 className="text-base font-semibold text-amber-900">Sebagian parameter diabaikan</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Satu atau lebih nilai filter tidak valid, sehingga laporan memakai nilai bawaan. Periksa kembali tanggal,
            granularitas, dan pilihan filter pada alamat halaman.
          </p>
        </Card>
      ) : null}

      <AnalyticsRangeControls exportHref={exportHref} links={linkOptions} query={query} />

      {report.linkId ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--blue-soft)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--blue-strong)]">
            Difilter untuk satu tautan: {selectedLink ? `${selectedLink.title} (${selectedLink.slug})` : report.linkId}
          </p>
          {selectedLink ? (
            <Link className="text-sm font-semibold text-[var(--blue-strong)] underline" href={`/admin/links/${selectedLink.id}`}>
              Buka tautan
            </Link>
          ) : null}
          <Link
            className="ml-auto text-sm font-semibold text-[var(--blue-strong)] underline"
            href={`/admin/analytics?${analyticsQueryToSearchParams({ range: report.range, filters: report.filters }).toString()}`}
          >
            Hapus filter tautan
          </Link>
        </div>
      ) : null}

      <section aria-labelledby="analytics-totals">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]" id="analytics-totals">
          Ringkasan {GRANULARITY_LABEL[report.range.granularity]}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            comparison={comparison.pageViews}
            description="Jumlah kunjungan halaman yang diterima. Muat ulang dalam 30 detik pada halaman yang sama tidak dihitung dua kali."
            label="Kunjungan halaman"
            value={formatMetricValue(totals.pageViews)}
          />
          <MetricCard
            comparison={comparison.linkClicks}
            description="Jumlah klik tautan keluar yang terekam lewat pengalihan pelacakan di server."
            label="Klik tautan"
            value={formatMetricValue(totals.linkClicks)}
          />
          <MetricCard
            comparison={comparison.sessions}
            description="Sesi unik berdasarkan pseudonim sesi 30 menit tanpa aktivitas. Bukan jumlah orang."
            label="Sesi"
            value={formatMetricValue(totals.sessions)}
          />
          <MetricCard
            comparison={comparison.uniqueVisitors}
            description="Perkiraan peramban/perangkat unik, bukan jumlah orang. Satu orang di tiga perangkat terhitung tiga kali."
            label="Pengunjung unik (estimasi)"
            value={formatMetricValue(totals.uniqueVisitors)}
          />
          <MetricCard
            comparison={comparison.uniqueLinkClicks}
            description="Pasangan tautan dan sesi yang unik per hari. Sesi yang mengklik tautan sama pada dua hari terhitung dua kali."
            label="Klik tautan unik"
            value={formatMetricValue(totals.uniqueLinkClicks)}
          />
          <MetricCard
            description="Total klik tautan dibagi total kunjungan halaman. Bukan rasio konversi per tautan karena tidak ada angka tayangan per tautan."
            hint="Rasio ini sengaja tidak disingkat menjadi “CTR”."
            label="Klik per kunjungan halaman"
            value={report.clicksPerPageView === null ? "—" : `${report.clicksPerPageView}%`}
          />
        </div>
      </section>

      <section aria-labelledby="analytics-trend">
        <h2 className="sr-only" id="analytics-trend">
          Tren
        </h2>
        <TrendChart
          granularity={report.range.granularity}
          points={report.trend}
          title={`Tren ${GRANULARITY_LABEL[report.range.granularity]}`}
        />
      </section>

      <section aria-labelledby="analytics-links">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]" id="analytics-links">
            Tautan populer
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Diurutkan menurut klik, lalu judul, lalu id agar urutan selalu sama.
          </p>
        </div>

        {report.links.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              description="Belum ada klik tautan pada rentang ini. Tabel peringkat tidak diisi dengan data contoh."
              title="Belum ada klik tautan"
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">Peringkat tautan menurut klik pada rentang terpilih</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="px-4 py-3 font-semibold" scope="col">
                    #
                  </th>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    Tautan
                  </th>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    Status saat ini
                  </th>
                  <th className="px-4 py-3 text-right font-semibold" scope="col">
                    Klik
                  </th>
                  <th className="px-4 py-3 text-right font-semibold" scope="col">
                    Klik unik
                  </th>
                  <th className="px-4 py-3 text-right font-semibold" scope="col">
                    Porsi
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.links.map((row) => (
                  <tr className="border-b border-[var(--line)] last:border-0" key={row.linkId}>
                    <td className="px-4 py-3 text-xs tabular-nums text-[var(--muted)]">{row.rank}</td>
                    <th className="px-4 py-3 font-medium" scope="row">
                      <Link
                        className="text-[var(--ink)] underline decoration-[var(--line-strong)] underline-offset-2 hover:text-[var(--blue-strong)]"
                        href={`/admin/analytics?${analyticsQueryToSearchParams({
                          range: report.range,
                          filters: report.filters,
                          linkId: row.linkId,
                        }).toString()}`}
                      >
                        {row.title}
                      </Link>
                      <span className="mt-0.5 block truncate font-mono text-xs font-normal text-[var(--muted)]">
                        {row.slug ?? "slug tidak tercatat"}
                        {row.category ? ` · ${row.category}` : ""}
                      </span>
                    </th>
                    <td className="px-4 py-3">
                      {row.isDeleted ? (
                        <span className="text-xs font-semibold text-[var(--muted)]">Tautan dihapus</span>
                      ) : (
                        <StatusBadge value={row.currentStatus} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--ink)]">{row.clicks}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">{row.uniqueClicks}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">{row.sharePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="analytics-distributions">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]" id="analytics-distributions">
          Distribusi audiens
        </h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <DistributionList
            emptyLabel="Belum ada peristiwa perangkat pada rentang ini."
            entries={report.devices}
            title="Perangkat"
            total={totals.pageViews + totals.linkClicks}
          />
          <DistributionList
            emptyLabel="Belum ada peristiwa peramban pada rentang ini."
            entries={report.browsers}
            title="Peramban"
            total={totals.pageViews + totals.linkClicks}
          />
          <DistributionList
            emptyLabel="Belum ada peristiwa sistem operasi pada rentang ini."
            entries={report.operatingSystems}
            title="Sistem operasi"
            total={totals.pageViews + totals.linkClicks}
          />
          <DistributionList
            emptyLabel="Belum ada peristiwa sumber rujukan pada rentang ini."
            entries={report.referrers}
            title="Sumber rujukan"
            total={totals.pageViews + totals.linkClicks}
          />
        </div>
      </section>

      <Card>
        <h2 className="text-base font-semibold text-[var(--ink)]">Cara membaca laporan ini</h2>
        <dl className="mt-3 grid gap-4 text-sm leading-6 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-[var(--ink)]">Zona waktu</dt>
            <dd className="text-[var(--muted)]">
              Hari laporan dimulai pukul 00.00 {report.range.timeZone} dan berakhir pada 23.59.59 WIB. Batas hari
              dikonversi ke UTC sebelum dikirim ke basis data.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--ink)]">Periode pembanding</dt>
            <dd className="text-[var(--muted)]">
              Perubahan persentase membandingkan {report.comparisonRange.fromDay} sampai{" "}
              {report.comparisonRange.toDay}, yaitu rentang sebelumnya dengan panjang yang sama. Dua periode kosong
              menampilkan “tidak ada perubahan”, bukan angka tak hingga.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--ink)]">Pengunjung unik</dt>
            <dd className="text-[var(--muted)]">
              Dihitung dari pseudonim peramban yang disimpan sebagai digest berkunci. Angka ini perkiraan perangkat,
              bukan orang, dan tidak pernah digabungkan dengan data pribadi.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--ink)]">Yang tidak diukur</dt>
            <dd className="text-[var(--muted)]">
              Rasio pentalan (bounce rate) tidak dilaporkan: tidak ada sinyal keterlibatan yang dapat
              dipertanggungjawabkan. Alamat IP, User-Agent mentah, dan URL rujukan lengkap tidak pernah disimpan.
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
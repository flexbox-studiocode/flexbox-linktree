import { NextResponse, type NextRequest } from "next/server";

import { AuthorizationError } from "@/features/auth/services/authorization";
import { parseAnalyticsQuery } from "@/features/analytics/schemas/filters";
import { getAnalyticsReport } from "@/features/analytics/services/query-analytics";
import { csvRow, toCsvDocument } from "@/features/analytics/utils/csv";
import { requireAdminAction } from "@/lib/auth/session";

/**
 * Aggregate CSV export for the analytics dashboard (`/admin/analytics/export`).
 *
 * Contract:
 *  - authorized with `requireAdminAction()`, never with the page layout's redirect,
 *  - built from the same `getAnalyticsReport()` call as the screen, so the file can
 *    never disagree with the rendered report,
 *  - aggregate rows only: no event ids, no visitor identifiers, no raw request data,
 *  - every cell that starts with a spreadsheet formula trigger is prefixed with an
 *    apostrophe, so a link title such as `=HYPERLINK(...)` cannot execute,
 *  - row counts are bounded, so a crafted query cannot produce an unbounded file.
 */

const MAX_LINK_ROWS = 1_000;
const MAX_TREND_ROWS = 400;

const row = csvRow;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdminAction();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return new NextResponse("Tidak diizinkan.", {
        status: 401,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }

    throw error;
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const query = parseAnalyticsQuery(params);
  const report = await getAnalyticsReport(query);

  const lines: string[] = [
    row(["bagian", "dimensi", "nilai", "jumlah", "jumlah_unik", "persentase"]),
    row(["meta", "periode_mulai", report.range.fromDay]),
    row(["meta", "periode_selesai", report.range.toDay]),
    row(["meta", "zona_waktu", report.range.timeZone]),
    row(["meta", "granularitas", report.range.granularity]),
    row(["meta", "pembanding_mulai", report.comparisonRange.fromDay]),
    row(["meta", "pembanding_selesai", report.comparisonRange.toDay]),
    row(["meta", "filter_tautan", report.linkId ?? "semua"]),
    row(["meta", "dibuat_pada", new Date().toISOString()]),
    row(["meta", "pengumpulan_aktif", report.availability.enabled ? "ya" : "tidak"]),
  ];

  for (const [key, value] of Object.entries(report.filters)) {
    if (value) {
      lines.push(row(["meta", `filter_${key}`, value]));
    }
  }

  lines.push(
    row(["ringkasan", "kunjungan_halaman", "Kunjungan halaman", report.totals.pageViews]),
    row(["ringkasan", "klik_tautan", "Klik tautan", report.totals.linkClicks]),
    row(["ringkasan", "sesi", "Sesi", report.totals.sessions]),
    row(["ringkasan", "pengunjung_unik_estimasi", "Pengunjung unik (estimasi)", report.totals.uniqueVisitors]),
    row(["ringkasan", "klik_tautan_unik", "Klik tautan unik", report.totals.uniqueLinkClicks]),
    row([
      "ringkasan",
      "klik_per_kunjungan_halaman",
      "Klik per kunjungan halaman",
      report.clicksPerPageView ?? "",
    ]),
  );

  for (const point of report.trend.slice(0, MAX_TREND_ROWS)) {
    lines.push(row(["tren", point.bucket, "kunjungan_halaman", point.pageViews]));
    lines.push(row(["tren", point.bucket, "klik_tautan", point.linkClicks]));
    lines.push(row(["tren", point.bucket, "sesi_harian", point.sessions]));
  }

  for (const link of report.links.slice(0, MAX_LINK_ROWS)) {
    lines.push(
      row([
        "tautan",
        link.linkId,
        link.title,
        link.clicks,
        link.uniqueClicks,
        link.sharePercent,
      ]),
      row(["tautan_meta", link.linkId, "slug", link.slug ?? ""]),
      row(["tautan_meta", link.linkId, "status_saat_ini", link.currentStatus]),
      row(["tautan_meta", link.linkId, "kategori", link.category ?? ""]),
    );
  }

  const distributions: Array<[string, typeof report.devices]> = [
    ["perangkat", report.devices],
    ["peramban", report.browsers],
    ["sistem_operasi", report.operatingSystems],
    ["sumber_rujukan", report.referrers],
  ];

  for (const [dimension, entries] of distributions) {
    for (const entry of entries) {
      lines.push(row(["distribusi", dimension, entry.value, entry.count, "", entry.sharePercent]));
    }
  }

  const filename = `analitik-${report.range.fromDay}_${report.range.toDay}.csv`;

  return new NextResponse(toCsvDocument(lines), {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "text/csv; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
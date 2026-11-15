import Link from "next/link";

import { analyticsQueryToSearchParams, type AnalyticsQuery } from "@/features/analytics/schemas/filters";

/**
 * Date-range and dimension controls.
 *
 * A plain GET form: no client JavaScript is required to change a report, filter
 * values survive navigation, and every control is a native labelled input that a
 * keyboard and a screen reader already understand. Preset ranges are real links,
 * so they are reachable from the "skip to content" path without a submit.
 */

const PRESETS: Array<{ value: string; label: string }> = [
  { value: "today", label: "Hari ini" },
  { value: "yesterday", label: "Kemarin" },
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
  { value: "90d", label: "90 hari" },
];

const DEVICE_OPTIONS = ["DESKTOP", "MOBILE", "TABLET", "OTHER", "UNKNOWN"];
const BROWSER_OPTIONS = ["CHROME", "SAFARI", "FIREFOX", "EDGE", "OTHER", "UNKNOWN"];
const OS_OPTIONS = ["WINDOWS", "MACOS", "LINUX", "ANDROID", "IOS", "OTHER", "UNKNOWN"];
const REFERRER_OPTIONS = ["DIRECT", "SEARCH", "SOCIAL", "REFERRAL", "CAMPAIGN", "INTERNAL", "UNKNOWN"];

const SELECT_CLASS =
  "mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)]";
const INPUT_CLASS =
  "mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]";

function presetHref(preset: string, query: AnalyticsQuery): string {
  const search = analyticsQueryToSearchParams({ range: query.range, filters: query.filters, linkId: query.linkId });
  search.set("range", preset);

  if (preset !== "custom") {
    search.delete("from");
    search.delete("to");
  }

  return `/admin/analytics?${search.toString()}`;
}

export function AnalyticsRangeControls({
  query,
  exportHref,
  links = [],
}: {
  query: AnalyticsQuery;
  exportHref: string;
  /** Optional per-link drill-down choices; omitted renders no link selector. */
  links?: Array<{ id: string; title: string; slug: string }>;
}) {
  const { range, filters } = query;

  return (
    <section aria-labelledby="analytics-filters" className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]" id="analytics-filters">
          Rentang dan filter
        </h2>
        <Link
          className="inline-flex min-h-11 items-center rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--blue-soft)]"
          href={exportHref}
        >
          Ekspor CSV (agregat)
        </Link>
      </div>

      <div className="mt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Periode</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const active = range.preset === preset.value;

            return (
              <li key={preset.value}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--blue-strong)] px-4 text-sm font-semibold text-white"
                      : "inline-flex min-h-11 items-center rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--blue-soft)]"
                  }
                  href={presetHref(preset.value, query)}
                >
                  {preset.label}
                </Link>
              </li>
            );
          })}
          <li>
            <span
              className={
                range.preset === "custom"
                  ? "inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--blue-strong)] px-4 text-sm font-semibold text-white"
                  : "inline-flex min-h-11 items-center rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] px-4 text-sm font-semibold text-[var(--muted)]"
              }
            >
              Kustom
            </span>
          </li>
        </ul>
      </div>

      <form className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" method="get">
        <input name="range" type="hidden" value="custom" />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="analytics-from">
            Dari tanggal (WIB)
          </label>
          <input
            className={INPUT_CLASS}
            defaultValue={range.fromDay}
            id="analytics-from"
            name="from"
            type="date"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="analytics-to">
            Sampai tanggal (WIB)
          </label>
          <input className={INPUT_CLASS} defaultValue={range.toDay} id="analytics-to" name="to" type="date" />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="analytics-granularity">
            Granularitas
          </label>
          <select className={SELECT_CLASS} defaultValue={range.granularity} id="analytics-granularity" name="granularity">
            <option value="day">Harian</option>
            <option value="week">Mingguan</option>
            <option value="month">Bulanan</option>
            <option value="hour">Per jam (maks. 2 hari)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="analytics-device">
            Perangkat
          </label>
          <select className={SELECT_CLASS} defaultValue={filters.device ?? ""} id="analytics-device" name="device">
            <option value="">Semua</option>
            {DEVICE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="analytics-browser">
            Peramban
          </label>
          <select className={SELECT_CLASS} defaultValue={filters.browser ?? ""} id="analytics-browser" name="browser">
            <option value="">Semua</option>
            {BROWSER_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="analytics-os">
            Sistem operasi
          </label>
          <select className={SELECT_CLASS} defaultValue={filters.os ?? ""} id="analytics-os" name="os">
            <option value="">Semua</option>
            {OS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="analytics-referrer">
            Sumber rujukan
          </label>
          <select className={SELECT_CLASS} defaultValue={filters.referrer ?? ""} id="analytics-referrer" name="referrer">
            <option value="">Semua</option>
            {REFERRER_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        {links.length > 0 ? (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="analytics-link">
              Tautan
            </label>
            <select className={SELECT_CLASS} defaultValue={query.linkId ?? ""} id="analytics-link" name="link">
              <option value="">Semua tautan</option>
              {links.map((link) => (
                <option key={link.id} value={link.id}>
                  {link.title} ({link.slug})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-3">
          <button
            className="min-h-11 rounded-[var(--radius)] bg-[var(--blue-strong)] px-5 text-sm font-bold text-white transition hover:bg-[var(--ink)]"
            type="submit"
          >
            Terapkan
          </button>
          <Link
            className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-[var(--blue-strong)] underline"
            href="/admin/analytics"
          >
            Reset
          </Link>
          <p className="ml-auto self-center text-xs text-[var(--muted)]">
            Tanggal mengikuti zona waktu {range.timeZone}. Rentang maksimum 400 hari.
          </p>
        </div>
      </form>
    </section>
  );
}
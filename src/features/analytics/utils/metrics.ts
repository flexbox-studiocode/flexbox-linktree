import type { MetricComparison } from "@/features/analytics/types";

/**
 * Reporting arithmetic shared by the dashboard and the CSV export.
 *
 * Kept free of database imports so the zero-behaviour rules can be unit tested
 * without a PostgreSQL connection. The service re-exports these functions; the UI
 * never computes a comparison or a share on its own.
 */

export function percent(part: number, whole: number): number {
  if (whole <= 0) {
    return 0;
  }

  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Percentage change with the documented zero behaviour: two empty periods render
 * as "no change" (`null`), a previous period of zero with current activity renders
 * as "new", and no division ever produces `Infinity` or `NaN`.
 */
export function computeComparison(current: number, previous: number): MetricComparison {
  if (previous === 0) {
    return { current, previous, changePercent: null, isNew: current > 0 };
  }

  return {
    current,
    previous,
    changePercent: Math.round(((current - previous) / previous) * 1000) / 10,
    isNew: false,
  };
}

export type TrendBucketInput = {
  day: string;
  pageViews: number;
  linkClicks: number;
  sessions: number;
};

export type TrendBucket = {
  bucket: string;
  label: string;
  pageViews: number;
  linkClicks: number;
  sessions: number;
};

/**
 * Fills gaps so a chart never jumps over a quiet day, then merges days into the
 * requested bucket. Sessions stay a sum of per-day distinct counts, which is why
 * the UI labels the series "sesi harian" rather than implying a cross-day distinct
 * visitor count.
 */
export function aggregateTrendBuckets(params: {
  series: TrendBucketInput[];
  fromDay: string;
  toDay: string;
  granularity: "hour" | "day" | "week" | "month";
  keyOfDay: (day: string) => string;
  enumerateDays: (from: string, to: string) => string[];
}): TrendBucket[] {
  const byDay = new Map(params.series.map((row) => [row.day, row]));

  if (params.granularity === "hour") {
    return params.series.map((row) => ({
      bucket: row.day,
      label: row.day,
      pageViews: row.pageViews,
      linkClicks: row.linkClicks,
      sessions: row.sessions,
    }));
  }

  const buckets = new Map<string, { pageViews: number; linkClicks: number; sessions: number }>();

  for (const day of params.enumerateDays(params.fromDay, params.toDay)) {
    const key = params.granularity === "day" ? day : params.keyOfDay(day);
    const current = buckets.get(key) ?? { pageViews: 0, linkClicks: 0, sessions: 0 };
    const row = byDay.get(day);

    if (row) {
      current.pageViews += row.pageViews;
      current.linkClicks += row.linkClicks;
      current.sessions += row.sessions;
    }

    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([bucket, totals]) => ({ bucket, label: bucket, ...totals }));
}
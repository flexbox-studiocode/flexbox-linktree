import "server-only";

import {
  countRollupTotal,
  findCurrentLinkStates,
  findDailySeries,
  findDistribution,
  findLinkAggregates,
  findWindowTotals,
  isFilteredQuery,
  type QueryScope,
  type Totals,
  type Window,
} from "@/features/analytics/repositories/aggregates";
import { getAnalyticsCollectionHealth } from "@/features/analytics/repositories/events";
import type { AnalyticsQuery } from "@/features/analytics/schemas/filters";
import type {
  AnalyticsAvailability,
  AnalyticsGranularity,
  AnalyticsRange,
  MetricComparison,
} from "@/features/analytics/types";
import { addDays, dayKeyDistance, dayKeyOf, endOfDayExclusiveUtc, enumerateDays, isoWeekBucket, monthBucket, startOfDayUtc } from "@/features/analytics/utils/time";
import { analyticsHashingEnabled } from "@/features/analytics/utils/hash";
import {
  aggregateTrendBuckets,
  computeComparison,
  percent,
} from "@/features/analytics/utils/metrics";

export { computeComparison } from "@/features/analytics/utils/metrics";

/**
 * Reporting service.
 *
 * Composes the repository aggregates into the exact shapes the dashboard and the
 * CSV export render. All comparison and share arithmetic lives here so the UI
 * never invents a number and the export cannot disagree with the screen.
 */

export type AnalyticsComparison = {
  pageViews: MetricComparison;
  linkClicks: MetricComparison;
  sessions: MetricComparison;
  uniqueVisitors: MetricComparison;
  uniqueLinkClicks: MetricComparison;
};

export type TrendPoint = {
  /** Bucket key: `YYYY-MM-DD` for day granularity, ISO week start, `YYYY-MM`. */
  bucket: string;
  label: string;
  pageViews: number;
  linkClicks: number;
  sessions: number;
};

export type PopularLinkRow = {
  linkId: string;
  title: string;
  slug: string | null;
  category: string | null;
  clicks: number;
  uniqueClicks: number;
  sharePercent: number;
  rank: number;
  /** Current stored state, or `DELETED` when the link no longer exists. */
  currentStatus: string;
  isActive: boolean;
  isDeleted: boolean;
};

export type DistributionEntry = { value: string; count: number; sharePercent: number };

export type AnalyticsReport = {
  range: AnalyticsRange;
  comparisonRange: { fromDay: string; toDay: string };
  filters: AnalyticsQuery["filters"];
  /** Present when the whole report is narrowed to a single link. */
  linkId?: string;
  filtered: boolean;
  degraded: boolean;
  availability: AnalyticsAvailability;
  totals: Totals;
  comparison: AnalyticsComparison;
  clicksPerPageView: number | null;
  trend: TrendPoint[];
  links: PopularLinkRow[];
  devices: DistributionEntry[];
  browsers: DistributionEntry[];
  operatingSystems: DistributionEntry[];
  referrers: DistributionEntry[];
};

export const EMPTY_TOTALS: Totals = {
  pageViews: 0,
  linkClicks: 0,
  sessions: 0,
  uniqueVisitors: 0,
  uniqueLinkClicks: 0,
};

function comparisonWindow(range: AnalyticsRange): { fromDay: string; toDay: string; window: Window } {
  const dayCount = dayKeyDistance(range.fromDay, range.toDay) + 1;
  const toDay = addDays(range.fromDay, -1);
  const fromDay = addDays(toDay, -(dayCount - 1));

  return {
    fromDay,
    toDay,
    window: {
      start: startOfDayUtc(fromDay, range.timeZone),
      endExclusive: endOfDayExclusiveUtc(toDay, range.timeZone),
    },
  };
}

/** Fills gaps so a chart never jumps over a quiet day. See `aggregateTrendBuckets`. */
export function buildTrend(params: {
  series: Array<{ day: string; pageViews: number; linkClicks: number; sessions: number }>;
  fromDay: string;
  toDay: string;
  granularity: AnalyticsGranularity;
}): TrendPoint[] {
  return aggregateTrendBuckets({
    ...params,
    keyOfDay: (day) =>
      params.granularity === "week" ? isoWeekBucket(day) : params.granularity === "month" ? monthBucket(day) : day,
    enumerateDays,
  });
}

/**
 * Builds a complete report. Never throws for "no data": an empty period returns
 * zeroed totals and empty distributions, which the dashboard renders as an
 * explicit empty state rather than fabricated activity.
 */
export async function getAnalyticsReport(query: AnalyticsQuery): Promise<AnalyticsReport> {
  const { range, filters, linkId } = query;
  const window: Window = { start: range.start, endExclusive: range.endExclusive };
  const previous = comparisonWindow(range);
  const scope: QueryScope = { filters, ...(linkId ? { linkId } : {}) };

  const [totals, previousTotals, series, linkAggregates, devices, browsers, operatingSystems, referrers, health] =
    await Promise.all([
      findWindowTotals(window, scope),
      findWindowTotals(previous.window, scope),
      findDailySeries({ window, fromDay: range.fromDay, toDay: range.toDay, scope }),
      findLinkAggregates({ window, fromDay: range.fromDay, toDay: range.toDay, scope }),
      findDistribution({ window, fromDay: range.fromDay, toDay: range.toDay, dimension: "DEVICE", scope }),
      findDistribution({ window, fromDay: range.fromDay, toDay: range.toDay, dimension: "BROWSER", scope }),
      findDistribution({ window, fromDay: range.fromDay, toDay: range.toDay, dimension: "OS", scope }),
      findDistribution({ window, fromDay: range.fromDay, toDay: range.toDay, dimension: "REFERRER", scope }),
      getAnalyticsCollectionHealth(),
    ]);

  const ranked = [...linkAggregates].sort(
    (left, right) =>
      right.clicks - left.clicks ||
      (left.title ?? "").localeCompare(right.title ?? "") ||
      left.linkId.localeCompare(right.linkId),
  );

  const currentStates = await findCurrentLinkStates(ranked.map((row) => row.linkId));

  const links: PopularLinkRow[] = ranked.map((row, index) => {
    const state = currentStates.get(row.linkId);

    return {
      linkId: row.linkId,
      title: row.title ?? state?.title ?? "(tanpa judul)",
      slug: row.slug ?? state?.slug ?? null,
      category: state?.categoryName ?? row.category ?? null,
      clicks: row.clicks,
      uniqueClicks: row.uniqueClicks,
      sharePercent: percent(row.clicks, totals.linkClicks),
      rank: index + 1,
      currentStatus: state?.status ?? "DELETED",
      isActive: state?.isActive ?? false,
      isDeleted: !state,
    };
  });

  const withShare = (rows: Array<{ value: string; count: number }>): DistributionEntry[] => {
    const total = rows.reduce((sum, row) => sum + row.count, 0);

    return rows.map((row) => ({ ...row, sharePercent: percent(row.count, total) }));
  };

  return {
    range,
    comparisonRange: { fromDay: previous.fromDay, toDay: previous.toDay },
    filters,
    ...(linkId ? { linkId } : {}),
    filtered: isFilteredQuery(filters, linkId),
    degraded: query.degraded,
    availability: {
      enabled: analyticsHashingEnabled(),
      hasEvents: health.lastEventAt !== null && totals.pageViews + totals.linkClicks > 0,
      lastEventAt: health.lastEventAt,
    },
    totals,
    comparison: {
      pageViews: computeComparison(totals.pageViews, previousTotals.pageViews),
      linkClicks: computeComparison(totals.linkClicks, previousTotals.linkClicks),
      sessions: computeComparison(totals.sessions, previousTotals.sessions),
      uniqueVisitors: computeComparison(totals.uniqueVisitors, previousTotals.uniqueVisitors),
      uniqueLinkClicks: computeComparison(totals.uniqueLinkClicks, previousTotals.uniqueLinkClicks),
    },
    clicksPerPageView:
      totals.pageViews > 0 ? Math.round((totals.linkClicks / totals.pageViews) * 1000) / 10 : null,
    trend: buildTrend({ series, fromDay: range.fromDay, toDay: range.toDay, granularity: range.granularity }),
    links,
    devices: withShare(devices),
    browsers: withShare(browsers),
    operatingSystems: withShare(operatingSystems),
    referrers: withShare(referrers),
  };
}

/** Reconciliation helper used by tests and the operations CLI. */
export async function getRollupTotals(fromDay: string, toDay: string) {
  const [pageViews, linkClicks] = await Promise.all([
    countRollupTotal("PAGE_VIEW", fromDay, toDay),
    countRollupTotal("LINK_CLICK", fromDay, toDay),
  ]);

  return { pageViews, linkClicks };
}

/** Today in the reporting timezone, for "last collected" labels. */
export function reportingDayOf(instant: Date, timeZone?: string): string {
  return dayKeyOf(instant, timeZone);
}
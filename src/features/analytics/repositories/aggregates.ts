import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { AnalyticsEventType, AnalyticsDimension } from "@/generated/prisma/enums";
import type { AnalyticsDimensionFilters } from "@/features/analytics/schemas/filters";
import { dayKeyToDate } from "@/features/analytics/utils/time";
import { prisma } from "@/lib/prisma/client";

/**
 * Analytics reporting queries.
 *
 * Two paths exist on purpose:
 *
 *  - **Rollup path** (no dimension filter): reads `analytics_daily_metrics` and
 *    `analytics_link_metrics`, so a dashboard render never scans raw events.
 *  - **Filtered path** (device/browser/OS/referrer filter active): uses
 *    PostgreSQL `GROUP BY` over the indexed raw table. Aggregating every filter
 *    combination into the rollup table would multiply its row count, so a
 *    filtered report trades a bounded index scan for correctness.
 *
 * Neither path loads event rows into JavaScript. Distinct counts are single
 * `COUNT(DISTINCT …)` statements with `::int` casts, because node-postgres
 * returns `int8` as a string.
 */

export type Totals = {
  pageViews: number;
  linkClicks: number;
  sessions: number;
  uniqueVisitors: number;
  uniqueLinkClicks: number;
};

export type Window = { start: Date; endExclusive: Date };

/** `linkId` narrows every query to the events attributed to one link. */
export type QueryScope = {
  filters: AnalyticsDimensionFilters;
  linkId?: string;
};

function eventFilterSql(scope: QueryScope): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [];
  const { filters } = scope;

  if (filters.device) parts.push(Prisma.sql`AND "device_type" = ${filters.device}::"analytics_device_type"`);
  if (filters.browser) parts.push(Prisma.sql`AND "browser_family" = ${filters.browser}::"analytics_browser_family"`);
  if (filters.os) parts.push(Prisma.sql`AND "os_family" = ${filters.os}::"analytics_os_family"`);
  if (filters.referrer) parts.push(Prisma.sql`AND "referrer_category" = ${filters.referrer}::"analytics_referrer_category"`);
  if (scope.linkId) parts.push(Prisma.sql`AND "link_id" = ${scope.linkId}::uuid`);

  return parts;
}

function whereSql(window: Window, scope: QueryScope): Prisma.Sql {
  const filters = eventFilterSql(scope);
  // `Prisma.join([])` throws, so an unfiltered query must not call it at all.
  const filterSql = filters.length > 0 ? Prisma.sql` ${Prisma.join(filters, " ")}` : Prisma.empty;

  return Prisma.sql`WHERE "occurred_at" >= ${window.start.toISOString()}::timestamp AND "occurred_at" < ${window.endExclusive.toISOString()}::timestamp${filterSql}`;
}

function hasDimensionFilter(scope: QueryScope): boolean {
  const { filters } = scope;

  return Boolean(filters.device || filters.browser || filters.os || filters.referrer || scope.linkId);
}

export function isFilteredQuery(filters: AnalyticsDimensionFilters, linkId?: string): boolean {
  return hasDimensionFilter({ filters, ...(linkId ? { linkId } : {}) });
}

/** Raw event counts for the selected window, including distinct estimates. */
export async function findWindowTotals(window: Window, scope: QueryScope): Promise<Totals> {
  const [pageViews, linkClicks] = await Promise.all([
    prisma.analyticsEvent.count({ where: { occurredAt: { gte: window.start, lt: window.endExclusive }, eventType: "PAGE_VIEW", ...toPrismaFilters(scope) } }),
    prisma.analyticsEvent.count({ where: { occurredAt: { gte: window.start, lt: window.endExclusive }, eventType: "LINK_CLICK", ...toPrismaFilters(scope) } }),
  ]);

  const rows = await prisma.$queryRaw<Array<{ sessions: number; visitors: number }>>(Prisma.sql`
    SELECT
      COUNT(DISTINCT "session_key_hash")::int AS sessions,
      COUNT(DISTINCT "visitor_key_hash")::int AS visitors
    FROM "analytics_events"
    ${whereSql(window, scope)}
  `);

  const uniqueLinkClickRows = await prisma.$queryRaw<Array<{ unique_clicks: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS unique_clicks
    FROM (
      SELECT DISTINCT "link_id", "session_key_hash", "day"
      FROM "analytics_events"
      ${whereSql(window, scope)}
      AND "event_type" = 'LINK_CLICK'
      AND "session_key_hash" IS NOT NULL
    ) AS unique_pairs
  `);

  return {
    pageViews,
    linkClicks,
    sessions: rows[0]?.sessions ?? 0,
    uniqueVisitors: rows[0]?.visitors ?? 0,
    uniqueLinkClicks: uniqueLinkClickRows[0]?.unique_clicks ?? 0,
  };
}

function toPrismaFilters(scope: QueryScope) {
  const { filters } = scope;

  return {
    ...(filters.device ? { deviceType: filters.device } : {}),
    ...(filters.browser ? { browserFamily: filters.browser } : {}),
    ...(filters.os ? { osFamily: filters.os } : {}),
    ...(filters.referrer ? { referrerCategory: filters.referrer } : {}),
    ...(scope.linkId ? { linkId: scope.linkId } : {}),
  };
}

export type DaySeriesRow = {
  day: string;
  pageViews: number;
  linkClicks: number;
  sessions: number;
};

/** Per-day page views/clicks (rollup path) plus distinct sessions (raw count). */
export async function findDailySeries(params: {
  window: Window;
  fromDay: string;
  toDay: string;
  scope: QueryScope;
}): Promise<DaySeriesRow[]> {
  const sessionsByDay = await prisma.$queryRaw<Array<{ day: Date; sessions: number }>>(Prisma.sql`
    SELECT "day", COUNT(DISTINCT "session_key_hash")::int AS sessions
    FROM "analytics_events"
    ${whereSql(params.window, params.scope)}
    GROUP BY "day"
    ORDER BY "day" ASC
  `);

  const sessionMap = new Map<string, number>();

  for (const row of sessionsByDay) {
    sessionMap.set(row.day.toISOString().slice(0, 10), row.sessions);
  }

  const daily = await prisma.analyticsDailyMetric.groupBy({
    by: ["day", "eventType"],
    where: {
      dimension: "TOTAL",
      day: { gte: dayKeyToDate(params.fromDay), lte: dayKeyToDate(params.toDay) },
    },
    _sum: { count: true },
  });

  const totalsByDay = new Map<string, { pageViews: number; linkClicks: number }>();

  for (const row of daily) {
    const key = row.day.toISOString().slice(0, 10);
    const current = totalsByDay.get(key) ?? { pageViews: 0, linkClicks: 0 };
    const count = row._sum.count ?? 0;

    if (row.eventType === "PAGE_VIEW") current.pageViews += count;
    else current.linkClicks += count;

    totalsByDay.set(key, current);
  }

  if (hasDimensionFilter(params.scope)) {
    const filtered = await prisma.analyticsEvent.groupBy({
      by: ["day", "eventType"],
      where: {
        occurredAt: { gte: params.window.start, lt: params.window.endExclusive },
        ...toPrismaFilters(params.scope),
      },
      _count: { _all: true },
    });

    totalsByDay.clear();

    for (const row of filtered) {
      const key = row.day.toISOString().slice(0, 10);
      const current = totalsByDay.get(key) ?? { pageViews: 0, linkClicks: 0 };
      const count = row._count._all;

      if (row.eventType === "PAGE_VIEW") current.pageViews += count;
      else current.linkClicks += count;

      totalsByDay.set(key, current);
    }
  }

  return Array.from(totalsByDay.entries())
    .map(([day, totals]) => ({
      day,
      pageViews: totals.pageViews,
      linkClicks: totals.linkClicks,
      sessions: sessionMap.get(day) ?? 0,
    }))
    .sort((left, right) => (left.day < right.day ? -1 : left.day > right.day ? 1 : 0));
}

export type LinkAggregateRow = {
  linkId: string;
  title: string | null;
  slug: string | null;
  category: string | null;
  clicks: number;
  uniqueClicks: number;
};

/** Click totals per link, plus distinct session/day pairs per link. */
export async function findLinkAggregates(params: {
  window: Window;
  fromDay: string;
  toDay: string;
  scope: QueryScope;
}): Promise<LinkAggregateRow[]> {
  const uniqueRows = await prisma.$queryRaw<Array<{ link_id: string; unique_clicks: number }>>(Prisma.sql`
    SELECT "link_id"::text AS link_id, COUNT(*)::int AS unique_clicks
    FROM (
      SELECT DISTINCT "link_id", "session_key_hash", "day"
      FROM "analytics_events"
      ${whereSql(params.window, params.scope)}
      AND "event_type" = 'LINK_CLICK'
      AND "session_key_hash" IS NOT NULL
    ) AS unique_pairs
    GROUP BY "link_id"
  `);

  const uniqueByLink = new Map(uniqueRows.map((row) => [row.link_id, row.unique_clicks]));

  if (hasDimensionFilter(params.scope)) {
    const grouped = await prisma.analyticsEvent.groupBy({
      by: ["linkId"],
      where: {
        eventType: "LINK_CLICK",
        occurredAt: { gte: params.window.start, lt: params.window.endExclusive },
        ...toPrismaFilters(params.scope),
      },
      _count: { _all: true },
      _max: {
        linkTitleSnapshot: true,
        linkSlugSnapshot: true,
        linkCategorySnapshot: true,
      },
    });

    return grouped
      .filter((row): row is typeof row & { linkId: string } => Boolean(row.linkId))
      .map((row) => ({
        linkId: row.linkId,
        title: row._max.linkTitleSnapshot,
        slug: row._max.linkSlugSnapshot,
        category: row._max.linkCategorySnapshot,
        clicks: row._count._all,
        uniqueClicks: uniqueByLink.get(row.linkId) ?? 0,
      }));
  }

  const grouped = await prisma.analyticsLinkMetric.groupBy({
    by: ["linkId"],
    where: { day: { gte: dayKeyToDate(params.fromDay), lte: dayKeyToDate(params.toDay) } },
    _sum: { clicks: true },
    _max: {
      linkTitleSnapshot: true,
      linkSlugSnapshot: true,
      linkCategorySnapshot: true,
    },
  });

  return grouped.map((row) => ({
    linkId: row.linkId,
    title: row._max.linkTitleSnapshot,
    slug: row._max.linkSlugSnapshot,
    category: row._max.linkCategorySnapshot,
    clicks: row._sum.clicks ?? 0,
    uniqueClicks: uniqueByLink.get(row.linkId) ?? 0,
  }));
}

export type DistributionRow = { value: string; count: number };

/**
 * Distribution over all accepted events (page views and clicks), grouped by one
 * normalized dimension. `TOTAL` rollup rows are never part of a distribution.
 */
export async function findDistribution(params: {
  window: Window;
  fromDay: string;
  toDay: string;
  dimension: Exclude<AnalyticsDimension, "TOTAL">;
  scope: QueryScope;
}): Promise<DistributionRow[]> {
  if (hasDimensionFilter(params.scope)) {
    const column =
      params.dimension === "DEVICE"
        ? "deviceType"
        : params.dimension === "BROWSER"
          ? "browserFamily"
          : params.dimension === "OS"
            ? "osFamily"
            : "referrerCategory";

    const grouped = await prisma.analyticsEvent.groupBy({
      by: [column],
      where: {
        occurredAt: { gte: params.window.start, lt: params.window.endExclusive },
        ...toPrismaFilters(params.scope),
      },
      _count: { _all: true },
    });

    return grouped
      .map((row) => ({
        value: String(row[column as keyof typeof row] ?? "UNKNOWN"),
        count: row._count._all,
      }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
  }

  const grouped = await prisma.analyticsDailyMetric.groupBy({
    by: ["dimensionValue"],
    where: {
      dimension: params.dimension,
      day: { gte: dayKeyToDate(params.fromDay), lte: dayKeyToDate(params.toDay) },
    },
    _sum: { count: true },
  });

  return grouped
    .map((row) => ({ value: row.dimensionValue, count: row._sum.count ?? 0 }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

/**
 * Link choices for the dashboard's per-link filter.
 *
 * Bounded and alphabetical so the selector stays usable; the ranked table is the
 * intended way to drill into a high-traffic link, this list only covers links that
 * still exist. Deleted links remain reachable by their existing report URL.
 */
export async function findLinkFilterOptions(limit = 200): Promise<Array<{ id: string; title: string; slug: string }>> {
  const rows = await prisma.link.findMany({
    orderBy: [{ title: "asc" }],
    take: Math.min(Math.max(limit, 1), 500),
    select: { id: true, title: true, slug: true },
  });

  return rows.map((row) => ({ id: row.id, title: row.title, slug: row.slug }));
}

/** Current link rows for the ranked table, so status is never guessed. */
export async function findCurrentLinkStates(linkIds: string[]) {
  if (linkIds.length === 0) {
    return new Map<string, { id: string; slug: string; title: string; status: string; isActive: boolean; categoryName: string }>();
  }

  const rows = await prisma.link.findMany({
    where: { id: { in: linkIds } },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      isActive: true,
      category: { select: { name: true } },
    },
  });

  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status as string,
        isActive: row.isActive,
        categoryName: row.category.name,
      },
    ]),
  );
}

/** Confirms the rollup event count matches raw events, for the reconciliation test. */
export async function countRollupTotal(eventType: AnalyticsEventType, fromDay: string, toDay: string): Promise<number> {
  const rows = await prisma.analyticsDailyMetric.aggregate({
    where: {
      dimension: "TOTAL",
      eventType,
      day: { gte: dayKeyToDate(fromDay), lte: dayKeyToDate(toDay) },
    },
    _sum: { count: true },
  });

  return rows._sum.count ?? 0;
}
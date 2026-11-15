import { z } from "zod";

import {
  addDays,
  compareDayKeys,
  dayKeyDistance,
  dayKeyOf,
  endOfDayExclusiveUtc,
  isDayKey,
  REPORTING_TIME_ZONE,
  startOfDayUtc,
} from "@/features/analytics/utils/time";
import type {
  AnalyticsGranularity,
  AnalyticsRange,
  AnalyticsRangePreset,
} from "@/features/analytics/types";

/**
 * Server-side parsing of analytics dashboard filters.
 *
 * `searchParams` are untrusted request input. Every value is validated and
 * bounded before it reaches a query: presets are an allowlist, custom dates must
 * be real `YYYY-MM-DD` calendar days, the span is capped, and dimension filters
 * must be known enum labels. Invalid input never throws — the service falls back
 * to the documented default (last 7 days) and reports which fields were ignored.
 */

export const MAX_RANGE_DAYS = 400;
export const MAX_HOURLY_SPAN_DAYS = 2;

export const rangePresetSchema = z.enum(["today", "yesterday", "7d", "30d", "90d", "custom"]);
export const granularitySchema = z.enum(["hour", "day", "week", "month"]);

export const analyticsDimensionFilterSchema = z.strictObject({
  device: z.enum(["DESKTOP", "MOBILE", "TABLET", "OTHER", "UNKNOWN"]).optional(),
  browser: z.enum(["CHROME", "SAFARI", "FIREFOX", "EDGE", "OTHER", "UNKNOWN"]).optional(),
  os: z.enum(["WINDOWS", "MACOS", "LINUX", "ANDROID", "IOS", "OTHER", "UNKNOWN"]).optional(),
  referrer: z
    .enum(["DIRECT", "SEARCH", "SOCIAL", "REFERRAL", "CAMPAIGN", "INTERNAL", "UNKNOWN"])
    .optional(),
});

export type AnalyticsDimensionFilters = z.infer<typeof analyticsDimensionFilterSchema>;

export type AnalyticsQuery = {
  range: AnalyticsRange;
  filters: AnalyticsDimensionFilters;
  linkId?: string;
  /** True when at least one supplied parameter was rejected and ignored. */
  degraded: boolean;
};

const PRESET_LENGTH: Record<Exclude<AnalyticsRangePreset, "custom">, number> = {
  today: 1,
  yesterday: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function pick(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function resolveGranularity(
  requested: string | undefined,
  dayCount: number,
  degraded: { value: boolean },
): AnalyticsGranularity {
  const parsed = granularitySchema.safeParse(requested);

  if (!parsed.success) {
    if (requested) {
      degraded.value = true;
    }

    return dayCount <= 1 ? "hour" : "day";
  }

  if (parsed.data === "hour" && dayCount > MAX_HOURLY_SPAN_DAYS) {
    // Hourly buckets over a long window would render unreadable labels and a huge
    // series, so the request degrades to daily instead of being rejected.
    degraded.value = true;

    return "day";
  }

  return parsed.data;
}

/**
 * Builds the reporting window.
 *
 * `now` is injectable so tests can pin the clock. Presets are resolved in the
 * reporting timezone, not UTC: "today" means the current Jakarta day, which is
 * why a UTC-based boundary would be wrong for 7 hours every day.
 */
export function resolveAnalyticsRange(input: {
  preset?: string;
  from?: string;
  to?: string;
  granularity?: string;
  now?: Date;
  timeZone?: string;
}): { range: AnalyticsRange; degraded: boolean } {
  const timeZone = input.timeZone ?? REPORTING_TIME_ZONE;
  const now = input.now ?? new Date();
  const today = dayKeyOf(now, timeZone);
  const degraded = { value: false };

  const presetParse = rangePresetSchema.safeParse(input.preset);

  if (input.preset && !presetParse.success) {
    degraded.value = true;
  }

  let preset: AnalyticsRangePreset = presetParse.success ? presetParse.data : "7d";
  let fromDay: string;
  let toDay: string;

  if (preset === "custom") {
    const from = input.from?.trim();
    const to = input.to?.trim();

    if (!from || !to || !ISO_DAY.test(from) || !ISO_DAY.test(to) || !isDayKey(from) || !isDayKey(to)) {
      degraded.value = true;
      preset = "7d";
      toDay = today;
      fromDay = addDays(today, -6);
    } else if (compareDayKeys(from, to) > 0) {
      // Swapped bounds are corrected rather than rejected: the intent is clear and
      // the correction is visible in the URL after the redirect-free render.
      degraded.value = true;
      fromDay = to;
      toDay = from;
    } else if (dayKeyDistance(from, to) + 1 > MAX_RANGE_DAYS) {
      degraded.value = true;
      toDay = to;
      fromDay = addDays(to, -(MAX_RANGE_DAYS - 1));
    } else {
      fromDay = from;
      toDay = to;
    }
  } else {
    const length = PRESET_LENGTH[preset];

    if (preset === "yesterday") {
      toDay = addDays(today, -1);
      fromDay = toDay;
    } else if (preset === "today") {
      fromDay = today;
      toDay = today;
    } else {
      fromDay = addDays(today, -(length - 1));
      toDay = today;
    }
  }

  const dayCount = dayKeyDistance(fromDay, toDay) + 1;
  const granularity = resolveGranularity(input.granularity, dayCount, degraded);

  return {
    range: {
      preset,
      fromDay,
      toDay,
      start: startOfDayUtc(fromDay, timeZone),
      endExclusive: endOfDayExclusiveUtc(toDay, timeZone),
      granularity,
      timeZone,
    },
    degraded: degraded.value,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAnalyticsQuery(params: Record<string, string | string[] | undefined>): AnalyticsQuery {
  const { range, degraded: rangeDegraded } = resolveAnalyticsRange({
    preset: pick(params.range),
    from: pick(params.from),
    to: pick(params.to),
    granularity: pick(params.granularity),
  });

  const rawFilters = {
    device: pick(params.device)?.toUpperCase(),
    browser: pick(params.browser)?.toUpperCase(),
    os: pick(params.os)?.toUpperCase(),
    referrer: pick(params.referrer)?.toUpperCase(),
  };

  const suppressEmpty = Object.fromEntries(
    Object.entries(rawFilters).filter(([, value]) => value !== undefined),
  );

  const parsedFilters = analyticsDimensionFilterSchema.safeParse(suppressEmpty);
  const filters: AnalyticsDimensionFilters = parsedFilters.success ? parsedFilters.data : {};
  const filtersDegraded = !parsedFilters.success && Object.keys(suppressEmpty).length > 0;

  const rawLinkId = pick(params.link);
  const linkId = rawLinkId && UUID.test(rawLinkId) ? rawLinkId : undefined;
  const linkDegraded = Boolean(rawLinkId) && !linkId;

  return {
    range,
    filters,
    ...(linkId ? { linkId } : {}),
    degraded: rangeDegraded || filtersDegraded || linkDegraded,
  };
}

/** Serializes the query back into dashboard links. */
export function analyticsQueryToSearchParams(query: {
  range: AnalyticsRange;
  filters: AnalyticsDimensionFilters;
  linkId?: string;
  granularity?: string;
}): URLSearchParams {
  const search = new URLSearchParams();
  search.set("range", query.range.preset === "custom" ? "custom" : query.range.preset);

  if (query.range.preset === "custom") {
    search.set("from", query.range.fromDay);
    search.set("to", query.range.toDay);
  }

  if (query.granularity) {
    search.set("granularity", query.granularity);
  }

  for (const [key, value] of Object.entries(query.filters)) {
    if (value) {
      search.set(key, value);
    }
  }

  if (query.linkId) {
    search.set("link", query.linkId);
  }

  return search;
}
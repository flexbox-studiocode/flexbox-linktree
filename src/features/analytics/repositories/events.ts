import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { Prisma as PrismaTypes } from "@/generated/prisma/client";
import type {
  AnalyticsBrowserFamily,
  AnalyticsDeviceType,
  AnalyticsDimension,
  AnalyticsEventType,
  AnalyticsOsFamily,
  AnalyticsReferrerCategory,
} from "@/generated/prisma/enums";
import type { RecordEventInput, RecordEventResult } from "@/features/analytics/types";
import { dateToDayKey, dayKeyOf, dayKeyToDate, REPORTING_TIME_ZONE } from "@/features/analytics/utils/time";
import { prisma } from "@/lib/prisma/client";

/**
 * Analytics event persistence and same-transaction rollups.
 *
 * The API deliberately accepts the narrow domain input rather than an arbitrary
 * Prisma create object. That prevents a controller from accidentally persisting
 * raw headers or a client-provided destination later. Unique `dedupeKey`
 * violations are normal control flow: they mean a beacon retry or refresh was
 * already recorded and must not inflate a counter.
 */

function isDuplicateError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toEventEnums(input: RecordEventInput): {
  eventType: AnalyticsEventType;
  deviceType: AnalyticsDeviceType;
  browserFamily: AnalyticsBrowserFamily;
  osFamily: AnalyticsOsFamily;
  referrerCategory: AnalyticsReferrerCategory;
} {
  return {
    eventType: input.eventType,
    deviceType: input.deviceType,
    browserFamily: input.browserFamily,
    osFamily: input.osFamily,
    referrerCategory: input.referrerCategory,
  };
}

type Transaction = PrismaTypes.TransactionClient;

async function incrementDailyMetric(
  tx: Transaction,
  input: {
    day: Date;
    eventType: AnalyticsEventType;
    dimension: AnalyticsDimension;
    dimensionValue: string;
  },
): Promise<void> {
  await tx.analyticsDailyMetric.upsert({
    where: {
      day_eventType_dimension_dimensionValue: {
        day: input.day,
        eventType: input.eventType,
        dimension: input.dimension,
        dimensionValue: input.dimensionValue,
      },
    },
    create: { ...input, count: 1 },
    update: { count: { increment: 1 } },
  });
}

/** Writes the fixed, low-cardinality rollup dimensions for one accepted event. */
async function incrementDailyRollups(
  tx: Transaction,
  input: RecordEventInput,
  day: Date,
): Promise<void> {
  const enums = toEventEnums(input);
  const dimensions: Array<{ dimension: AnalyticsDimension; dimensionValue: string }> = [
    { dimension: "TOTAL", dimensionValue: "ALL" },
    { dimension: "DEVICE", dimensionValue: enums.deviceType },
    { dimension: "BROWSER", dimensionValue: enums.browserFamily },
    { dimension: "OS", dimensionValue: enums.osFamily },
    { dimension: "REFERRER", dimensionValue: enums.referrerCategory },
  ];

  await Promise.all(
    dimensions.map((dimension) =>
      incrementDailyMetric(tx, { day, eventType: enums.eventType, ...dimension }),
    ),
  );
}

async function incrementLinkRollup(tx: Transaction, input: RecordEventInput, day: Date): Promise<void> {
  if (input.eventType !== "LINK_CLICK" || !input.link) {
    return;
  }

  await tx.analyticsLinkMetric.upsert({
    where: { day_linkId: { day, linkId: input.link.linkId } },
    create: {
      day,
      linkId: input.link.linkId,
      linkSlugSnapshot: input.link.linkSlugSnapshot,
      linkTitleSnapshot: input.link.linkTitleSnapshot,
      linkCategorySnapshot: input.link.linkCategorySnapshot,
      clicks: 1,
    },
    update: {
      clicks: { increment: 1 },
      // Snapshots intentionally stay as the first known identity for a given
      // (day, link) rather than being overwritten by later editorial changes.
    },
  });
}

/**
 * Creates the raw event then its daily rollups atomically.
 *
 * A duplicate does not enter the transaction body after `create` fails, so its
 * rollups cannot be incremented accidentally. Any non-duplicate error rolls
 * back both the event and all rollups, preserving reconciliation invariants.
 */
export async function recordAnalyticsEvent(input: RecordEventInput): Promise<RecordEventResult> {
  const dayKey = dayKeyOf(input.occurredAt, REPORTING_TIME_ZONE);
  const day = dayKeyToDate(dayKey);
  const enums = toEventEnums(input);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.analyticsEvent.create({
        data: {
          eventType: enums.eventType,
          occurredAt: input.occurredAt,
          day,
          visitorKeyHash: input.visitorKeyHash,
          sessionKeyHash: input.sessionKeyHash,
          dedupeKey: input.dedupeKey,
          linkId: input.link?.linkId ?? null,
          linkSlugSnapshot: input.link?.linkSlugSnapshot ?? null,
          linkTitleSnapshot: input.link?.linkTitleSnapshot ?? null,
          linkCategorySnapshot: input.link?.linkCategorySnapshot ?? null,
          deviceType: enums.deviceType,
          browserFamily: enums.browserFamily,
          osFamily: enums.osFamily,
          referrerCategory: enums.referrerCategory,
          campaignSource: input.campaign.campaignSource,
          campaignMedium: input.campaign.campaignMedium,
          campaignName: input.campaign.campaignName,
        },
      });

      await incrementDailyRollups(tx, input, day);
      await incrementLinkRollup(tx, input, day);
    });

    return "recorded";
  } catch (error) {
    if (isDuplicateError(error)) {
      return "duplicate";
    }

    throw error;
  }
}

/** Small read used by the dashboard status card; never returns raw event data. */
export async function getAnalyticsCollectionHealth(): Promise<{ lastEventAt: Date | null }> {
  const event = await prisma.analyticsEvent.findFirst({
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });

  return { lastEventAt: event?.occurredAt ?? null };
}

/** Count used by cleanup and diagnostics; date column means no timezone ambiguity. */
export async function countAnalyticsEventsBefore(dayExclusive: string): Promise<number> {
  return prisma.analyticsEvent.count({ where: { day: { lt: dayKeyToDate(dayExclusive) } } });
}

/**
 * Bounded raw-event delete. PostgreSQL has no portable Prisma `deleteMany take`,
 * so ids are selected in a narrow indexed query before deletion. Repeating this
 * call is idempotent and each invocation touches at most `batchSize` rows.
 */
export async function deleteAnalyticsEventsBefore(params: {
  dayExclusive: string;
  batchSize: number;
}): Promise<number> {
  const ids = await prisma.analyticsEvent.findMany({
    where: { day: { lt: dayKeyToDate(params.dayExclusive) } },
    orderBy: { occurredAt: "asc" },
    take: Math.min(Math.max(params.batchSize, 1), 10_000),
    select: { id: true },
  });

  if (ids.length === 0) {
    return 0;
  }

  const result = await prisma.analyticsEvent.deleteMany({ where: { id: { in: ids.map((row) => row.id) } } });

  return result.count;
}

export async function deleteDailyMetricsBefore(params: { dayExclusive: string; batchSize: number }): Promise<number> {
  const ids = await prisma.analyticsDailyMetric.findMany({
    where: { day: { lt: dayKeyToDate(params.dayExclusive) } },
    orderBy: { day: "asc" },
    take: Math.min(Math.max(params.batchSize, 1), 10_000),
    select: { id: true },
  });

  if (ids.length === 0) return 0;

  return (await prisma.analyticsDailyMetric.deleteMany({ where: { id: { in: ids.map((row) => row.id) } } })).count;
}

export async function deleteLinkMetricsBefore(params: { dayExclusive: string; batchSize: number }): Promise<number> {
  const ids = await prisma.analyticsLinkMetric.findMany({
    where: { day: { lt: dayKeyToDate(params.dayExclusive) } },
    orderBy: { day: "asc" },
    take: Math.min(Math.max(params.batchSize, 1), 10_000),
    select: { id: true },
  });

  if (ids.length === 0) return 0;

  return (await prisma.analyticsLinkMetric.deleteMany({ where: { id: { in: ids.map((row) => row.id) } } })).count;
}

/** Exposed for tests that assert event-day materialization. */
export function analyticsDayOf(value: Date): string {
  return dateToDayKey(dayKeyToDate(dayKeyOf(value, REPORTING_TIME_ZONE)));
}
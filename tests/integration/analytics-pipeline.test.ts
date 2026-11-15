import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseAnalyticsQuery } from "@/features/analytics/schemas/filters";
import {
  countRollupTotal,
  findDistribution,
  findLinkAggregates,
  findWindowTotals,
} from "@/features/analytics/repositories/aggregates";
import { recordAnalyticsEvent } from "@/features/analytics/repositories/events";
import { getAnalyticsReport } from "@/features/analytics/services/query-analytics";
import { deleteAnalyticsEventsBefore } from "@/features/analytics/repositories/events";
import { runAnalyticsCleanup } from "@/features/analytics/services/retention";
import { startOfDayUtc, endOfDayExclusiveUtc } from "@/features/analytics/utils/time";
import { openLocalDatabase, testSlug, type LocalDatabase } from "../helpers/db";

/**
 * End-to-end analytics pipeline against the local PostgreSQL database.
 *
 * The test writes events onto two deliberately archival days (`2020-05-04` and
 * `2020-05-05`) so it never disturbs the "today" dashboard, then removes exactly
 * those rows again. It asserts the two documented invariants:
 *
 *  - an event and its rollups are written atomically,
 *  - rollup totals reconcile with raw event counts.
 *
 * It also proves that click history survives link deletion, and that a dimension
 * filter switches the report to the raw path without changing the definition of a
 * click.
 */

const db: LocalDatabase | null = openLocalDatabase();

const DAY = "2020-05-04";
const NEXT_DAY = "2020-05-05";
const NOON = new Date("2020-05-04T05:00:00.000Z");
const NEXT_NOON = new Date("2020-05-05T05:00:00.000Z");

function digest(label: string): string {
  // Any 64-char hex value is a valid stored digest; the report never decrypts it.
  return label.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/gi, "a");
}

describe.skipIf(!db)("analytics pipeline (local database)", () => {
  const prisma = db!.prisma;
  const linkA = "11111111-1111-4111-8111-111111111111";
  let deletedLinkId: string;

  const event = (
    overrides: Partial<Parameters<typeof recordAnalyticsEvent>[0]> = {},
  ): Parameters<typeof recordAnalyticsEvent>[0] => ({
    eventType: "PAGE_VIEW",
    occurredAt: NOON,
    visitorKeyHash: digest("visitor-1"),
    sessionKeyHash: digest("session-1"),
    dedupeKey: null,
    deviceType: "DESKTOP",
    browserFamily: "CHROME",
    osFamily: "WINDOWS",
    referrerCategory: "DIRECT",
    campaign: { campaignSource: null, campaignMedium: null, campaignName: null },
    ...overrides,
  });

  const click = (overrides: Partial<Parameters<typeof recordAnalyticsEvent>[0]> = {}) =>
    event({
      eventType: "LINK_CLICK",
      link: {
        linkId: linkA,
        linkSlugSnapshot: "studio-work",
        linkTitleSnapshot: "Studio Work",
        linkCategorySnapshot: "Pilihan studio",
      },
      ...overrides,
    });

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { slug: testSlug("analytics-category"), name: "Analytics QA", sortOrder: 99 },
      select: { id: true },
    });

    const deleted = await prisma.link.create({
      data: {
        slug: testSlug("analytics-deleted"),
        categoryId: category.id,
        title: "Riwayat yang dihapus",
        destinationType: "EXTERNAL",
        destinationUrl: "https://example.test/deleted",
        status: "PUBLISHED",
        isActive: true,
        sortOrder: 1,
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      select: { id: true },
    });

    deletedLinkId = deleted.id;

    await recordAnalyticsEvent(
      click({
        visitorKeyHash: digest("visitor-deleted"),
        sessionKeyHash: digest("session-deleted"),
        dedupeKey: digest("dedupe-deleted"),
        link: {
          linkId: deletedLinkId,
          linkSlugSnapshot: "analytics-deleted",
          linkTitleSnapshot: "Riwayat yang dihapus",
          linkCategorySnapshot: "Analytics QA",
        },
      }),
    );

    await prisma.link.delete({ where: { id: deletedLinkId } });
  });

  afterAll(async () => {
    if (!db) return;

    await prisma.analyticsEvent.deleteMany({ where: { day: { gte: new Date("2020-05-01"), lte: new Date("2020-05-31") } } });
    await prisma.analyticsDailyMetric.deleteMany({
      where: { day: { gte: new Date("2020-05-01"), lte: new Date("2020-05-31") } },
    });
    await prisma.analyticsLinkMetric.deleteMany({
      where: { day: { gte: new Date("2020-05-01"), lte: new Date("2020-05-31") } },
    });
    await db.dispose();
  });

  it("records an event and its rollups atomically", async () => {
    expect(
      await recordAnalyticsEvent(
        event({
          sessionKeyHash: digest("session-1"),
          visitorKeyHash: digest("visitor-1"),
          dedupeKey: digest("dedupe-page-1"),
        }),
      ),
    ).toBe("recorded");

    expect(await prisma.analyticsEvent.count({ where: { day: new Date(DAY), sessionKeyHash: digest("session-1") } })).toBe(1);
    expect(await countRollupTotal("PAGE_VIEW", DAY, DAY)).toBe(1);
  });

  it("discards a duplicate inside the same dedupe window without incrementing rollups", async () => {
    expect(
      await recordAnalyticsEvent(
        event({
          dedupeKey: digest("dedupe-page-1"),
          occurredAt: new Date("2020-05-04T05:00:20.000Z"),
        }),
      ),
    ).toBe("duplicate");

    expect(await countRollupTotal("PAGE_VIEW", DAY, DAY)).toBe(1);
  });

  it("records a second session, a click, and a duplicate click", async () => {
    expect(
      await recordAnalyticsEvent(
        event({
          sessionKeyHash: digest("session-2"),
          visitorKeyHash: digest("visitor-2"),
          dedupeKey: digest("dedupe-page-2"),
        }),
      ),
    ).toBe("recorded");

    expect(await recordAnalyticsEvent(click({ dedupeKey: digest("dedupe-click-1") }))).toBe("recorded");
    expect(await recordAnalyticsEvent(click({ dedupeKey: digest("dedupe-click-1") }))).toBe("duplicate");

    // One click from the fixture link created in `beforeAll`, plus this one.
    expect(await countRollupTotal("LINK_CLICK", DAY, DAY)).toBe(2);
  });

  it("reconcilies rollups with raw events for the reported window", async () => {
    const window = { start: startOfDayUtc(DAY), endExclusive: endOfDayExclusiveUtc(DAY) };
    const totals = await findWindowTotals(window, { filters: {} });

    expect(totals).toEqual({
      pageViews: 2,
      linkClicks: 2,
      sessions: 3,
      uniqueVisitors: 3,
      uniqueLinkClicks: 2,
    });

    expect(await countRollupTotal("PAGE_VIEW", DAY, DAY)).toBe(totals.pageViews);
    expect(await countRollupTotal("LINK_CLICK", DAY, DAY)).toBe(totals.linkClicks);
  });

  it("keeps click history after the link row is deleted", async () => {
    const report = await getAnalyticsReport(parseAnalyticsQuery({ range: "custom", from: DAY, to: DAY }));

    const historical = report.links.find((row) => row.linkId === deletedLinkId);

    expect(historical).toBeDefined();
    expect(historical?.isDeleted).toBe(true);
    expect(historical?.clicks).toBe(1);
    expect(historical?.title).toBe("Riwayat yang dihapus");
  });

  it("counts a click once per link and session, resetting on a new day", async () => {
    expect(await recordAnalyticsEvent(click({ dedupeKey: digest("dedupe-click-2"), occurredAt: NEXT_NOON }))).toBe(
      "recorded",
    );
    expect(
      await recordAnalyticsEvent(
        click({ dedupeKey: digest("dedupe-click-3"), occurredAt: NEXT_NOON, sessionKeyHash: digest("session-2") }),
      ),
    ).toBe("recorded");

    const aggregates = await findLinkAggregates({
      window: { start: startOfDayUtc(DAY), endExclusive: endOfDayExclusiveUtc(NEXT_DAY) },
      fromDay: DAY,
      toDay: NEXT_DAY,
      scope: { filters: {} },
    });

    const row = aggregates.find((entry) => entry.linkId === linkA);

    expect(row?.clicks).toBe(3);
    // A (link, session, day) triple is the unique unit, so the same session
    // clicking on two different days counts twice.
    expect(row?.uniqueClicks).toBe(3);
  });

  it("narrows every query when a dimension filter is active", async () => {
    const window = { start: startOfDayUtc(DAY), endExclusive: endOfDayExclusiveUtc(DAY) };
    const desktop = await findWindowTotals(window, { filters: { device: "DESKTOP" } });
    const mobile = await findWindowTotals(window, { filters: { device: "MOBILE" } });

    expect(desktop.pageViews).toBe(2);
    expect(mobile.pageViews).toBe(0);

    const browsers = await findDistribution({
      window,
      fromDay: DAY,
      toDay: DAY,
      dimension: "BROWSER",
      scope: { filters: { device: "DESKTOP" } },
    });

    expect(browsers).toContainEqual({ value: "CHROME", count: 4 });
  });

  it("builds a zeroed report instead of inventing data for an empty period", async () => {
    const report = await getAnalyticsReport(parseAnalyticsQuery({ range: "custom", from: "2019-01-01", to: "2019-01-02" }));

    expect(report.totals.pageViews).toBe(0);
    expect(report.totals.linkClicks).toBe(0);
    expect(report.links).toEqual([]);
    expect(report.devices).toEqual([]);
    expect(report.clicksPerPageView).toBeNull();
  });

  it("computes retention cutoffs in the reporting timezone and deletes nothing on a dry run", async () => {
    const dry = await runAnalyticsCleanup({
      dryRun: true,
      now: new Date("2026-11-15T00:00:00.000Z"),
      rawRetentionDays: 90,
      aggregateRetentionDays: 400,
    });

    expect(dry).toMatchObject({
      dryRun: true,
      today: "2026-11-15",
      rawCutoffDay: "2026-08-17",
      aggregateCutoffDay: "2025-10-11",
      rawEventsDeleted: 0,
      dailyMetricsDeleted: 0,
      linkMetricsDeleted: 0,
      batchesRun: 0,
    });
  });

  it("deletes raw events in a bounded, idempotent pass", async () => {
    const first = await deleteAnalyticsEventsBefore({ dayExclusive: "2020-05-05", batchSize: 100 });

    expect(first).toBeGreaterThan(0);

    const second = await deleteAnalyticsEventsBefore({ dayExclusive: "2020-05-05", batchSize: 100 });

    expect(second).toBe(0);
  });
});
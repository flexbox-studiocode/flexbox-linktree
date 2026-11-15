import "server-only";

import {
  deleteAnalyticsEventsBefore,
  deleteDailyMetricsBefore,
  deleteLinkMetricsBefore,
} from "@/features/analytics/repositories/events";
import { addDays, dayKeyOf } from "@/features/analytics/utils/time";

/**
 * Analytics retention.
 *
 * A repeatable, bounded, idempotent maintenance operation. It is *only* invoked
 * by the operator CLI (`pnpm analytics:cleanup`) or by a scheduler that runs that
 * CLI. Nothing in the application calls it on boot, during `next dev`, or from an
 * in-process timer.
 *
 * Raw events expire before rollups: the long-range trend and the historical link
 * ranking therefore survive the raw window, which is the documented trade-off.
 */

export const DEFAULT_RAW_RETENTION_DAYS = 90;
export const DEFAULT_AGGREGATE_RETENTION_DAYS = 400;
export const DEFAULT_BATCH_SIZE = 2_000;
export const DEFAULT_MAX_BATCHES = 25;

const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3_650;

function readDays(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < MIN_RETENTION_DAYS || parsed > MAX_RETENTION_DAYS) {
    return fallback;
  }

  return parsed;
}

export type RetentionConfig = {
  rawRetentionDays: number;
  aggregateRetentionDays: number;
  batchSize: number;
  maxBatches: number;
};

export function resolveRetentionConfig(overrides: Partial<RetentionConfig> = {}): RetentionConfig {
  return {
    rawRetentionDays:
      overrides.rawRetentionDays ??
      readDays(process.env.ANALYTICS_RAW_RETENTION_DAYS, DEFAULT_RAW_RETENTION_DAYS),
    aggregateRetentionDays:
      overrides.aggregateRetentionDays ??
      readDays(process.env.ANALYTICS_AGGREGATE_RETENTION_DAYS, DEFAULT_AGGREGATE_RETENTION_DAYS),
    batchSize: overrides.batchSize ?? DEFAULT_BATCH_SIZE,
    maxBatches: overrides.maxBatches ?? DEFAULT_MAX_BATCHES,
  };
}

export type CleanupResult = {
  dryRun: boolean;
  today: string;
  rawCutoffDay: string;
  aggregateCutoffDay: string;
  rawEventsDeleted: number;
  dailyMetricsDeleted: number;
  linkMetricsDeleted: number;
  batchesRun: number;
  /** True when the batch budget ran out and the next run must continue. */
  incomplete: boolean;
};

/**
 * Deletes rows older than the configured horizons in bounded batches.
 *
 * A dry run performs the same cutoff computation and reports zero deletions
 * without touching a row, so an operator can rehearse the exact horizon.
 */
export async function runAnalyticsCleanup(
  options: { dryRun?: boolean; now?: Date } & Partial<RetentionConfig> = {},
): Promise<CleanupResult> {
  const config = resolveRetentionConfig(options);
  const today = dayKeyOf(options.now ?? new Date());
  const rawCutoffDay = addDays(today, -config.rawRetentionDays);
  const aggregateCutoffDay = addDays(today, -config.aggregateRetentionDays);
  const dryRun = options.dryRun ?? false;

  const result: CleanupResult = {
    dryRun,
    today,
    rawCutoffDay,
    aggregateCutoffDay,
    rawEventsDeleted: 0,
    dailyMetricsDeleted: 0,
    linkMetricsDeleted: 0,
    batchesRun: 0,
    incomplete: false,
  };

  if (dryRun) {
    return result;
  }

  for (let batch = 0; batch < config.maxBatches; batch += 1) {
    const [events, daily, links] = await Promise.all([
      deleteAnalyticsEventsBefore({ dayExclusive: rawCutoffDay, batchSize: config.batchSize }),
      deleteDailyMetricsBefore({ dayExclusive: aggregateCutoffDay, batchSize: config.batchSize }),
      deleteLinkMetricsBefore({ dayExclusive: aggregateCutoffDay, batchSize: config.batchSize }),
    ]);

    result.rawEventsDeleted += events;
    result.dailyMetricsDeleted += daily;
    result.linkMetricsDeleted += links;
    result.batchesRun += 1;

    if (events === 0 && daily === 0 && links === 0) {
      return result;
    }
  }

  // The budget was exhausted with work remaining. A later invocation continues
  // from the same cutoffs; nothing is left half-written because each batch is a
  // single DELETE statement.
  result.incomplete = true;

  return result;
}
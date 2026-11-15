import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

import { prisma } from "@/lib/prisma/client";
import { runAnalyticsCleanup, resolveRetentionConfig } from "@/features/analytics/services/retention";

/**
 * Analytics retention CLI.
 *
 * Intended to be executed by a VPS cron job or a Coolify scheduled task, for
 * example once per day:
 *
 *   0 3 * * *  cd /srv/flexbox-linktree && pnpm analytics:cleanup >> /var/log/flexbox-analytics.log 2>&1
 *
 * Options:
 *   --dry-run               report the horizon and delete nothing
 *   --batch-size=<n>        rows per delete statement (default 2000)
 *   --max-batches=<n>       statement budget per run (default 25)
 *   --raw-days=<n>          override ANALYTICS_RAW_RETENTION_DAYS
 *   --aggregate-days=<n>    override ANALYTICS_AGGREGATE_RETENTION_DAYS
 *
 * The command is idempotent: running it twice in a row deletes nothing the
 * second time. It never removes rollups that are still inside their own horizon
 * and it never touches content, authentication, or audit data.
 */

function flagValue(argv: string[], name: string): number | undefined {
  const prefix = `--${name}=`;
  const raw = argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const config = resolveRetentionConfig({
    batchSize: flagValue(argv, "batch-size"),
    maxBatches: flagValue(argv, "max-batches"),
    rawRetentionDays: flagValue(argv, "raw-days"),
    aggregateRetentionDays: flagValue(argv, "aggregate-days"),
  });

  const result = await runAnalyticsCleanup({ dryRun, ...config });

  console.log("Analytics retention cleanup complete.");
  console.log(`  mode                 : ${result.dryRun ? "dry run (nothing deleted)" : "apply"}`);
  console.log(`  today (Asia/Jakarta) : ${result.today}`);
  console.log(`  raw cutoff day       : ${result.rawCutoffDay} (${config.rawRetentionDays} days)`);
  console.log(`  rollup cutoff day    : ${result.aggregateCutoffDay} (${config.aggregateRetentionDays} days)`);
  console.log(`  raw events removed   : ${result.rawEventsDeleted}`);
  console.log(`  daily rollups removed: ${result.dailyMetricsDeleted}`);
  console.log(`  link rollups removed : ${result.linkMetricsDeleted}`);
  console.log(`  batches executed     : ${result.batchesRun}`);

  if (result.incomplete) {
    console.log("  note                 : batch budget reached; run again to continue.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(`Cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
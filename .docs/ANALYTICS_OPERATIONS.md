# Analytics Operations — Phase 6

**Product:** Flexbox Linktree / Flexbox Studio Digital Hub
**Language:** English
**Companion documents:** `.docs/ANALYTICS_SPECIFICATION.md`, `.docs/ANALYTICS_PRIVACY.md`, `.docs/LOCAL_DEVELOPMENT.md`.

## 1. Configuration

| Variable | Required | Default | Effect |
|---|---|---|---|
| `ANALYTICS_HASH_SECRET` | Production: yes | none | HMAC key for visitor/session/dedupe digests. Unset in production disables collection. |
| `ANALYTICS_RAW_RETENTION_DAYS` | No | `90` | Raw `analytics_events` retention. Accepted range 1–3650; an invalid value falls back to the default. |
| `ANALYTICS_AGGREGATE_RETENTION_DAYS` | No | `400` | Daily and per-link rollup retention. Must stay larger than the raw horizon. |

Generate the secret once per environment:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Store it in `.env.local` locally and in the hosting secret store for staging/production.
Never commit it, never reuse it across environments, and never place it in a
`NEXT_PUBLIC_*` variable.

Outside production, a missing `ANALYTICS_HASH_SECRET` falls back to `NEXTAUTH_SECRET` so a
local run works. Production has no fallback: the collector records nothing and the dashboard
shows the disabled banner.

## 2. Deployment checklist

1. `pnpm install --frozen-lockfile`
2. `pnpm db:migrate:deploy` (applies the analytics migrations; additive only)
3. `pnpm db:generate`
4. Set `ANALYTICS_HASH_SECRET` in the environment before starting the app.
5. `pnpm build`
6. `pnpm start` (or the container image)
7. Open `/admin/analytics` as a `SUPER_ADMIN` and confirm the availability banner is absent.
8. Visit the public page and follow one external card; the "klik tautan" card must increment
   within one request, because rollups are written in the same transaction as the event.

Rollbacks must not delete analytics tables: the feature is additive and older application
versions simply ignore them.

## 3. Secret rotation

Rotating `ANALYTICS_HASH_SECRET` is a supported privacy operation. It is **not** a routine
task, because it resets distinct-visitor and distinct-session counts from the rotation
moment.

1. Announce the rotation and the metric discontinuity.
2. Set the new secret and restart the application.
3. Optionally delete rows written under the old key if their pseudonyms must not be linkable
   to the same period: `DELETE FROM analytics_events WHERE occurred_at < '<rotation instant>'`.
   Rollups contain no identifier and are safe to keep.
4. Record the rotation date in the operations log so a later reader can explain the step in
   the trend chart.

Never rotate the key to "fix" a suspicious number. Investigate first; rotation destroys the
evidence.

## 4. Retention cleanup

The application never deletes analytics data by itself. Cleanup is an explicit, bounded,
idempotent command:

```bash
pnpm analytics:cleanup --dry-run
pnpm analytics:cleanup
```

Options:

| Flag | Default | Meaning |
|---|---|---|
| `--dry-run` | off | Computes and prints the cutoffs, deletes nothing |
| `--batch-size=<n>` | `2000` | Rows per delete statement |
| `--max-batches=<n>` | `25` | Statement budget for this invocation |
| `--raw-days=<n>` | env / `90` | Override the raw horizon |
| `--aggregate-days=<n>` | env / `400` | Override the rollup horizon |

Each run prints the Jakarta "today", both cutoff days, the deletion counts, and how many
batches ran. If the batch budget is exhausted with work remaining, the command prints
`batch budget reached; run again to continue` and exits successfully. Re-running is safe:
the cutoffs are recomputed from the current day, and each batch is a single indexed
`DELETE`.

### Scheduling

Linux (VPS/Coolify), daily at 03:00 Jakarta time:

```cron
0 3 * * * cd /srv/flexbox-linktree && pnpm analytics:cleanup >> /var/log/flexbox-analytics.log 2>&1
```

Windows Task Scheduler, daily:

```powershell
powershell -NoProfile -Command "Set-Location 'D:\Kiandra Gagah\Projek Gabut\flexbox-linktree'; pnpm analytics:cleanup"
```

Alert on a non-zero exit code and on three consecutive runs that report
`raw events removed: 0` while raw rows clearly exist (a symptom of a broken database
connection rather than an empty table).

## 5. Reconciliation

Run these after a deployment or when a number looks wrong. Both identities must hold for any
period inside the raw retention window.

```sql
-- 1. Daily rollup totals must match raw events.
SELECT d.event_type, SUM(d.count) AS rollup, (
  SELECT COUNT(*) FROM analytics_events e
  WHERE e.event_type = d.event_type
    AND e.day BETWEEN DATE '2026-11-01' AND DATE '2026-11-15'
) AS raw
FROM analytics_daily_metrics d
WHERE d.dimension = 'TOTAL'
  AND d.day BETWEEN DATE '2026-11-01' AND DATE '2026-11-15'
GROUP BY d.event_type;

-- 2. Link rollups must match raw clicks.
SELECT (
  SELECT SUM(clicks) FROM analytics_link_metrics
  WHERE day BETWEEN DATE '2026-11-01' AND DATE '2026-11-15'
) AS rollup_clicks, (
  SELECT COUNT(*) FROM analytics_events
  WHERE event_type = 'LINK_CLICK'
    AND day BETWEEN DATE '2026-11-01' AND DATE '2026-11-15'
) AS raw_clicks;
```

A mismatch means a rollup write was lost and is a defect. Do not "repair" the rollup table by
hand; capture the numbers, then restore from a backup or accept the gap explicitly in the
operations log.

Expected reconciliation noise: none. Events and rollups are written in one transaction.

## 6. Health signals

| Signal | Meaning | Action |
|---|---|---|
| Dashboard shows "Pengumpulan analitik nonaktif" | `ANALYTICS_HASH_SECRET` missing in production | Set the secret, restart |
| "Belum ada peristiwa pada rentang ini" with a recent `lastEventAt` | The selected range has no traffic | Widen the range; no action |
| `lastEventAt` older than expected | Collector failing, bot filter too aggressive, or no traffic | Check application logs for `[analytics] ... collection failed`, then verify the beacon request in the browser network panel |
| Rollup total ≠ raw count | Lost rollup write | See section 5 |
| Clicks work but no click events | `/go` analytics path failing | Check logs for `redirect lookup failed`; the redirect itself still works |

The collector logs only the event type and the error **name**. It never logs a payload, a
User-Agent, a URL, or an identifier. Do not add such logging during an incident; use the
database and the dashboard instead.

## 7. Capacity and cost

- Raw events: one row per accepted page view or click, plus one dedupe index entry.
- Daily rollups: at most 5 dimensions × 2 event types per day for `TOTAL`/device/browser/OS/
  referrer labels, so roughly 60 rows per day (~22k rows per year).
- Link rollups: one row per clicked link per day.
- Query cost: the unfiltered dashboard reads rollups and two distinct-count statements. A
  filtered report scans the indexed raw table for the selected window, which is bounded by
  the 400-day range cap and the raw retention horizon.

At microsite volume (thousands of events per month) no partitioning, archival tier, or
separate analytics database is justified.

## 8. Backup and restore

Analytics tables are ordinary PostgreSQL tables. A database backup covers them. When
restoring an older dump, remember that restoring raw events older than the retention horizon
re-introduces data the operator previously intended to delete: run `pnpm analytics:cleanup`
immediately after a restore and note it in the operations log.

## 9. Incident playbooks

### 9.1 Suspected metric inflation

1. Compare `analytics_events` counts per `session_key_hash` and per `day` for the affected
   period.
2. Check `referrer_category` and `browser_family` for a single dominant, implausible client.
3. If a bot evaded the filter, add a signature to `BOT_SIGNATURES` in
   `src/features/analytics/utils/normalize.ts`, deploy, and document the affected period.
4. Do not delete raw rows to make the chart look better. Mark the period as anomalous in the
   operations log.

### 9.2 Collector outage

Collection failure never breaks the public page or a redirect. Confirm the redirect still
works, then fix the collector. Events during the outage are lost; there is no replay queue in
Phase 6. Record the outage window so a later reader can explain the dip.

### 9.3 Secret leak

1. Rotate `ANALYTICS_HASH_SECRET` immediately (section 3).
2. Treat all stored pseudonyms as compromised and unlinkable.
3. Review who had access to the environment; the key alone does not expose content or
   accounts.
4. Document the rotation time.

## 10. Local verification commands

```bash
pnpm db:migrate:deploy
pnpm db:generate
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm analytics:cleanup --dry-run
```

`pnpm analytics:cleanup --dry-run` is the only cleanup form that is safe on a development
database you still want to inspect.
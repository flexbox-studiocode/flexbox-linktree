# QA and Test Report — Phase 7

All results below come from commands executed in this phase on the owner's
Windows development workstation. Nothing in this report is inferred from file
presence.

## 1. Environment

| Item | Value |
|---|---|
| Node.js | v26.13.0 |
| pnpm | 12.18.0 |
| PostgreSQL | 17.12 (`postgres:17-alpine`, host binding `127.0.0.1:5433`) |
| Chrome (QA scripts) | 157.0.8103.79 (local channel) |
| Application server under test | `pnpm build` + `pnpm start` on port 3100 |
| Branch | `main` |

## 2. Automated suites

| # | Command | Result |
|---|---|---|
| 1 | `pnpm lint` | Passed, zero warnings/errors |
| 2 | `pnpm typecheck` | Passed |
| 3 | `pnpm test` | 28 files / 303 tests passed (unit + local-database integration) |
| 4 | `pnpm build` | Passed; Next.js 16.4.6 production build |
| 5 | `pnpm db:validate` | Prisma schema valid |
| 6 | `pnpm db:generate` | Client generated |
| 7 | `pnpm db:migrate:deploy` (status) | 10 migrations applied, none pending |
| 8 | `pnpm db:check` | Database reachable |
| 9 | `pnpm audit --audit-level=low` | No known vulnerabilities (see `DEPENDENCY_SECURITY.md`) |
| 10 | `pnpm db:backup` | Backup + SHA-256 sidecar produced |
| 11 | `pnpm db:restore:verify` | PASS — 14/14 tables, row counts, migration ledger match |
| 12 | `pnpm qa:e2e` | Passed (17 checks, 1 data-dependent skip) |
| 13 | `pnpm perf:smoke` | Passed — 0 failures across 100 requests |
| 14 | `node scripts/a11y-audit.mjs` | Passed — no contrast, target-size, landmark, or heading defects |
| 15 | `node scripts/a11y-interaction.mjs` | Passed — 200% zoom, anchor offset, tab order |
| 16 | `node scripts/visual-qa.mjs` | Passed — 7 viewports, no overflow, no console or network errors |

Test-suite composition: unit tests cover schemas, mappers, URL policy, password
policy and hashing, callback URL handling, proxy gate, analytics normalization and
reporting, seed data shape, collector request guards, and draft rules.
Integration tests run against a real PostgreSQL database and cover admin
authentication, authorization, provisioning, lifecycle, content mutations,
analytics pipeline and redirect, the content repository, and the media library.
Each integration suite creates rows with `test-` slugs and deletes them
afterwards; seeded content is not modified.

## 3. Release journey (`pnpm qa:e2e`)

Executed against the production build on `http://127.0.0.1:3100`.

```text
PASS public page returns 200
PASS public page title present — Flexbox Studio — Digital Hub
PASS exactly one h1
PASS published directory cards render — count 8
SKIP tracking redirect journey — no published external destinations in the current dataset
PASS unknown link ID is not redirected (no open redirect) — status 404
PASS unauthenticated /admin does not render the CMS — status 307 location /admin/login
PASS login page returns 200
PASS login page is private-cache
PASS login page is noindex
PASS login page sends CSP
PASS login form is present
PASS login page has no password value pre-filled
PASS collector accepts a same-origin page view — status 204
PASS collector ignores a cross-site page view — status 204
PASS no browser console errors
PASS no failed requests
```

The skipped check is honest: all eight seeded directory entries currently have
`destinationType = NONE`, so they render as non-interactive "Segera" cards and no
`/go/<id>` anchor exists to follow. The redirect contract itself is verified by
`tests/integration/analytics-redirect.test.ts` (eligible link redirects; every
ineligible publication/activation state refused; unsafe schemes rejected) and by
the unknown-ID 404 check above. Once owners confirm destinations, this E2E check
starts asserting the real redirect without a code change.

## 4. Performance baseline (`pnpm perf:smoke`)

50 requests per target, concurrency 10, local production server on loopback:

```text
public-page: requests=50 failures=0 statuses=200 p50=23.7ms p95=58.8ms max=88.7ms
analytics-collector: requests=50 failures=0 statuses=204 p50=14.4ms p95=17.1ms max=28.4ms
```

Interpretation: this is a functional latency smoke, not a capacity benchmark.
Loopback removes network latency and there is no concurrent admin workload,
large media library, or production data volume. It establishes that the public
path answers in tens of milliseconds and that the collector is not a bottleneck
at microsite volume. Re-baseline after staging is available.

## 5. Analytics integrity

Read-only reconciliation on the local database (full available range):

```text
 event_type | rollup | raw
------------+--------+-----
 PAGE_VIEW  |      4 |   4
 LINK_CLICK |      1 |   1

 rollup_clicks | raw_clicks
---------------+------------
             1 |          1
```

Rollups and raw events agree. The integration suite additionally proves:

- an event and its rollups are written atomically, including duplicate rejection
  inside the dedupe window,
- link click history survives deletion of the link row (snapshot columns),
- dimension filters narrow both rollups and raw queries consistently,
- an empty period produces a zeroed report rather than invented data,
- retention dry-run computes Jakarta-timezone cutoffs and deletes nothing,
- bounded deletion is idempotent (second pass deletes 0 rows).

## 6. Accessibility and visual verification

`a11y-audit` (production build):

- one `h1`, ordered headings, one `main`, labelled navigation and footer,
- no unnamed links, no contrast failures, no sub-24px touch targets,
- `lang="id"`, title and description present,
- reduced-motion honored (`scroll-behavior: auto`, card transition ~0s).

`a11y-interaction`:

- 200% zoom at 640×450 CSS viewport: no horizontal overflow, no clipped
  elements, two-column card layout retained,
- anchor navigation clears the sticky header (`direktori`, `kontak`),
- tab order begins with the skip link and includes every visible interactive
  element.

`visual-qa` at 320, 390, 600, 768, 1024, 1280, and 1440 px:

- no horizontal overflow at any width,
- one `h1` per page, 8 cards rendered, two-column layout from 600 px,
- Anton display font and Manrope body font loaded,
- zero console errors and zero failed requests.

Screenshots were written to `.qa-screens/` (ignored by Git) so the owner's
existing `screenshots/` directory was left untouched.

## 7. Failure-injection review

- **Analytics failure must not break a redirect.** `/go/[linkId]` starts
  collection but races it against a 1.5 s timeout and catches lookup/collection
  errors; the redirect response is constructed before collection resolves.
  Verified by source review and the redirect integration suite's error paths.
- **Analytics failure must not break the page.** The beacon is fire-and-forget,
  and the collector returns 204 for every rejection path (content type, origin,
  rate limit, oversized body, invalid JSON, invalid schema).
- **Cache invalidation must not fail a committed mutation.**
  `invalidatePublicContent()` swallows cache errors; the mutation result is
  already persisted.
- **Database outage during login** fails closed (throttle read throws; no
  session is issued). Documented in `SECURITY_REVIEW.md`.

## 8. Known test gaps

1. No automated load or soak test; `perf:smoke` is a functional latency sample.
2. Browser QA scripts require a local Chrome channel and a running server, so
   they are documented commands, not CI steps. CI covers lint, types, tests,
   build, audit, and secret scanning.
3. No real outbound email is sent in tests; the development file transport is
   asserted, and production mail remains an owner decision.
4. The E2E redirect happy path is data-dependent and currently skipped; the
   redirect logic itself is covered by integration tests.
5. No cross-browser matrix (Firefox/Safari); Chrome is the only automated
   browser.

None of these gaps blocks the release decision; each is either acceptable for a
single-admin microsite or explicitly deferred to Phase 8.
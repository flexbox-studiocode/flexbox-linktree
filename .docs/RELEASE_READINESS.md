# Release Readiness — Phase 7

Final assessment for the Phase 7 exit: quality, security, and release
readiness. Written after the executed checks in this phase, not from file
presence.

## 1. Decision

**READY WITH DOCUMENTED LIMITATIONS**

The application and its operational tooling satisfy the Phase 7 exit criteria:
all critical acceptance checks pass, automated verification is green in CI and
locally, and every known limitation is recorded rather than hidden. Phase 8 may
begin preparation.

This is **not** a production deployment approval. Four owner/infrastructure
items remain open and are listed in §6. None of them is an application defect.

## 2. Release candidate

| Item | Value |
|---|---|
| Branch | `main` |
| Milestone commits | A `64db763`, B `385ef83`, C `3debc93`, D `5bf651c`, E `94dd75c`, F `0dcd308`, G `21fa72b`, CI fix `8994021` |
| CI | Run 7 on `8994021`: **success** (both jobs) |
| Remote | `https://github.com/flexbox-studiocode/flexbox-linktree.git` |
| Migrations | 10 applied, none pending |
| Schema change this phase | None |

## 3. Verification evidence

| Area | Evidence | Result |
|---|---|---|
| Lint / types | `pnpm lint`, `pnpm typecheck` | Passed |
| Unit + integration | `pnpm test` — 28 files, 303 tests | Passed |
| CI parity | fresh `flexbox_linktree_citest` DB: migrate deploy + seed + 303 tests | Passed |
| Production build | `pnpm build` | Passed |
| Dependency audit | `pnpm audit --audit-level=low` | No known vulnerabilities |
| Secret scan | `node scripts/secret-scan.mjs` | 248 files, no findings |
| Security headers | live probe on `pnpm start` | CSP, HSTS, nosniff, frame deny, referrer, permissions, COOP/CORP, private CMS cache |
| Application hardening | 4 defects fixed, each with tests | Verified |
| Backup + restore | `pnpm db:backup`, `pnpm db:restore:verify` | 14/14 tables, counts, migration ledger match |
| E2E journey | `pnpm qa:e2e` | 17 checks pass, 1 data-dependent skip |
| Performance smoke | `pnpm perf:smoke` | 100 requests, 0 failures; p95 65.6 ms public, 22.1 ms collector |
| Analytics reconciliation | rollup vs raw SQL | Equal |
| Accessibility | `qa:a11y` both scripts | No defects |
| Visual QA | 7 viewports | No overflow, no console/network errors |
| Production preflight | `pnpm config:check` | Dev clean; production correctly blocked on missing prod config |
| CI pipeline | GitHub Actions run 7 | Success |

Detailed evidence lives in `.docs/PHASE_7_BASELINE.md`,
`.docs/DEPENDENCY_SECURITY.md`, `.docs/SECURITY_REVIEW.md`,
`.docs/DATABASE_BACKUP_RECOVERY.md`, `.docs/QA_TEST_REPORT.md`, and
`.docs/PRODUCTION_CONFIGURATION.md`.

## 4. What changed in Phase 7

- Added a GitHub Actions pipeline with an ephemeral PostgreSQL 17 service:
  frozen install, schema validation/generation, migration deploy, seed, lint,
  typecheck, test, build, production audit, and tracked-file secret scan.
- Removed the only dependency advisory (dev-only `minimatch`) with a narrow
  pnpm override; applied compatible patch upgrades; documented deferred majors.
- Hardened the application: HTTP security headers and private CMS cache headers,
  bounded collector body read, collector same-origin check, dummy Argon2
  verification for unknown accounts, and missing featured-link cache
  invalidation.
- Added real backup and isolated restore verification with SHA-256 sidecars and
  a recovery runbook.
- Added a production release journey, latency smoke, and a production
  configuration preflight.
- Corrected system-status reporting and added analytics and site-configuration
  checks.
- Updated documentation so no stale Phase 5/6 status remains.

## 5. Accepted limitations

1. **CSP allows `'unsafe-inline'` for script and style.** Required by the App
   Router's inline bootstrap data and the approved inline critical styles.
   Nonce-based CSP conflicts with the current cached rendering model. Tightening
   is Phase 8 work; residual risk is recorded in `SECURITY_REVIEW.md`.
2. **No MFA.** Single-password administrator access with database-backed
   throttling. Roadmap post-launch improvement.
3. **Database-backed throttling fails closed.** A database outage blocks sign-in
   instead of bypassing the throttle.
4. **Collector origin check has a compatibility fallback.** Requests with
   neither `Origin` nor `Sec-Fetch-Site` are accepted; the collector has no
   side effects beyond analytics writes and cookies, and body/schema/rate limits
   still apply.
5. **Browser QA is local-only.** `qa:visual`, `qa:a11y`, `qa:e2e`, and
   `perf:smoke` need a running server and local Chrome, so CI does not run them.
   CI covers everything that is environment-independent.
6. **Performance evidence is a loopback smoke, not a capacity benchmark.**
   Re-baseline on staging.
7. **No cross-browser automation.** Chrome is the only automated browser.
8. **E2E redirect happy path is skipped with current content.** All eight seeded
   entries have `destinationType = NONE`, so no `/go/<id>` anchor exists. The
   redirect logic is covered by integration tests and the unknown-ID no-open-
   redirect check.

## 6. Phase 8 blockers (owner/infrastructure)

These must be resolved before production traffic. They do not block starting
Phase 8.

1. **Transactional email provider.** `getAdminMailer()` supports only the
   development file transport. Production password recovery and invitations
   cannot be delivered. Highest-priority functional gap.
2. **Infrastructure.** No VPS, Coolify, domain, TLS, private PostgreSQL, S3
   bucket, or staging environment exists yet.
3. **Owner content decisions.** Confirmed directory destinations (six pending),
   public contact channel, analytics/privacy disclosure, and final domain.
4. **Operational policy.** Agreed RPO/RTO, off-host encrypted backup target, and
   on-call/incident owner.

## 7. Phase 8 handoff

Order of work:

1. Provision VPS, firewall, SSH keys, and Coolify; create staging environment.
2. Provision private PostgreSQL 17 and S3-compatible storage; set production
   secrets from a secret manager, never from the repository.
3. Integrate a real mail provider and test invitation + recovery delivery.
4. Deploy staging from `main`; run `pnpm db:migrate:deploy`, `pnpm config:check
   --production`, `pnpm qa:e2e`, `pnpm qa:a11y`, `pnpm qa:visual`,
   `pnpm perf:smoke`, `pnpm db:backup`, `pnpm db:restore:verify`.
5. Confirm published-only public content, safe redirects, security headers, and
   analytics reconciliation on staging.
6. Provision the first Super Admin through the protected CLI, disable bootstrap,
   and verify revocation and recovery flows.
7. Schedule off-host backups and monitoring; record RPO/RTO and incident owner.
8. Obtain explicit owner approval before production traffic and DNS cutover.

## 8. Rollback position

- Application: redeploy the previous known-good commit; no destructive
  migration exists in this phase.
- Database: restore the verified pre-release backup into a new database, then
  redeploy the matching application release. Never restore over the live
  database with `--clean`.
- Media: object storage must use versioning or independent backup; a database
  restore alone does not restore files.
- Full procedure: `.docs/DATABASE_BACKUP_RECOVERY.md`.

## 9. Statement

Phase 7 is complete. The repository is ready for Phase 8 preparation with the
documented limitations above. No production deployment, infrastructure change,
or credential provisioning is authorized by this assessment.
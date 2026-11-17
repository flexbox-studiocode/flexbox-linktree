# Phase 7 Baseline — Quality, Security, and Release Readiness

**Recorded:** 2026-11-17
**Branch:** `main`
**Starting commit:** `bdd311e` (`docs(roadmap): mark phases 5 and 6 complete in the progress summary`)
**Remote:** `https://github.com/flexbox-studiocode/flexbox-linktree`

This document records the repository and environment state inspected before Phase 7
changes were made. It is evidence, not a plan: values below were read from the working
tree and from executed commands.

## 1. Repository state at start

| Item | Value |
|---|---|
| Current branch | `main`, tracking `origin/main` |
| Starting SHA | `bdd311e` |
| Remote state | Up to date after `git fetch origin` |
| Modified tracked file | `.gitignore` — owner-added `.agents/`, `.claude/`, `.windsurf/` ignores (preserved) |
| Untracked owner files | `screenshots/`, `skills-lock.json`, local `*.dump` backups, local logs (all preserved; dumps/logs are git-ignored) |
| Earlier tracked state | `git ls-files` contains no `.env.local`, database dump, private key, or generated Prisma client |

The owner's working-tree changes were not staged, reverted, or reformatted. Phase 7 adds
new files and additive edits only.

## 2. Toolchain observed

| Tool | Version |
|---|---|
| Node.js | v26.13.0 |
| pnpm | 12.18.0 (`packageManager` pin) |
| Docker | 29.8.2 |
| Docker Compose | v5.5.1 |
| PostgreSQL container | `flexbox-linktree-db`, `postgres:17-alpine`, healthy, `127.0.0.1:5433` |
| Next.js | 16.4.6 |
| React | 19.3.0 |
| Prisma | 7.10.1 (`prisma7.config.ts`, `@prisma/adapter-pg`) |
| Auth.js / NextAuth | 4.24.15, Credentials provider, JWT sessions |
| Vitest | 5.1.0 |
| TypeScript | 5.9.3 |

`.nvmrc` contains `26`; `package.json` requires Node `>=24.0.0` and pnpm `>=12.18.0`.

## 3. Migrations at start

`pnpm exec prisma migrate status` reported **10 migrations found; database schema up to date**.

1. `20261114114846_init`
2. `20261115061934_add_content_cms_foundation`
3. `20261115081603_add_admin_identity_security`
4. `20261115081700_add_admin_identity_checks`
5. `20261115110654_add_cms_audit_events`
6. `20261115142019_add_analytics_events`
7. `20261115142500_add_analytics_checks`
8. `20261115143000_add_analytics_event_day`
9. `20261115161000_relax_lifecycle_clock_skew`
10. `20261115170000_add_admin_account_deleted_event`

No Phase 7 migration was required. All Phase 7 work is application, test, CI, and
operation documentation.

## 4. Existing quality commands

| Command | Purpose | Baseline result |
|---|---|---|
| `pnpm install --frozen-lockfile` | Lockfile reproducibility | Passed; lockfile verified |
| `pnpm lint` | ESLint 9 | Passed, no findings |
| `pnpm typecheck` | `tsc --noEmit` | Passed |
| `pnpm test` | Vitest unit + local PostgreSQL integration | Passed: 27 files, 286 tests |
| `pnpm build` | Next.js production build | Passed; `.next/BUILD_ID` written |
| `pnpm db:validate` | Prisma schema validation | Valid |
| `pnpm db:generate` | Prisma Client generation | Generated to `src/generated/prisma` |
| `pnpm exec prisma migrate status` | Migration history check | Up to date |
| `pnpm db:check` | Connectivity/read-write check | OK; `system_checks` table reachable |
| `pnpm qa:a11y` | Playwright/Chrome public accessibility audit | Requires running server |
| `pnpm qa:visual` | Playwright/Chrome public visual QA | Requires running server |

Integration tests run only when `DATABASE_URL` points at `localhost`, `127.0.0.1`, or
`::1` (`tests/helpers/db.ts`). CI must provide an ephemeral PostgreSQL service for the
suite to execute rather than skip.

## 5. Documented production prerequisites (pre-Phase 7)

- `.env.local` / hosting secret store: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`,
  `RATE_LIMIT_SECRET`, `ANALYTICS_HASH_SECRET`.
- Production media: `MEDIA_STORAGE_DRIVER=s3` plus `S3_BUCKET`, `S3_REGION`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_ENDPOINT`, `S3_PUBLIC_URL`.
- `TRUST_PROXY_HEADERS=true` only behind a proxy that overwrites forwarded headers.
- `ADMIN_MAIL_TRANSPORT` has no production provider. The file transport refuses to run in
  production, so production password recovery and invitations are not operable yet.
- Production deployment target: Flexbox-owned VPS, Coolify, PostgreSQL with persistent
  volume, S3-compatible media, off-site backups (Phase 8, not started).
- Production domain, public contact address, and six unconfirmed link destinations remain
  owner content decisions. They must not be invented.

## 6. Known unfinished roadmap decisions

| Item | Owner decision still required |
|---|---|
| Production domain | Blocks canonical URL, `metadataBase`, Open Graph image URL, sitemap |
| Contact address | Blocks live contact CTA; currently a pending label |
| Six link destinations | Stored as `destinationType = NONE` and render as "Segera" |
| Final public copy | Copy is seeded and CMS-editable; owner approval not recorded |
| Privacy notice / analytics disclosure | Drafted policy does not replace owner legal review |
| Transactional email provider | Not selected or configured |
| S3-compatible provider and credentials | Not selected or configured |
| MFA | Deliberately deferred; no approved authenticator workflow |

## 7. Baseline discrepancies found

| Discrepancy | Resolution |
|---|---|
| `README.md` still described Phase 5 as the current milestone and listed analytics as unimplemented. | Updated in Milestone A to reflect Phase 6 completion and Phase 7 status. |
| `README.md` script table omitted `pnpm analytics:cleanup`. | Added in Milestone A. |
| Documentation table omitted analytics documents. | Added in Milestone A. |
| `pnpm qa:a11y` and `pnpm qa:visual` cover the public page only; authenticated CMS screens had journey-based verification in Phase 6. | Recorded as a limitation; Phase 7 adds a repeatable admin/analytics journey where feasible. |
| No `.github/workflows` existed. | CI added in Milestone B. |
| No dependency, security review, backup/restore, QA, or release-readiness documents existed. | Added by Phase 7 milestones C–H. |

## 8. Traceability method

A requirement is marked **Verified** only when source code and an executed check (test,
build, browser audit, HTTP probe, or database query) support it. File presence alone is
not evidence. Results and exact commands are recorded in `.docs/QA_TEST_REPORT.md`.
# Phase 8I Build & Runtime Readiness Report

Audit date: 2026-11-21
Repository: `flexbox-studiocode/flexbox-linktree`
Branch: `main`
Target runtime: Node.js 24 / pnpm 12.18.0 / Next.js 16.4.6 / PostgreSQL 17
Production status: **NOT DEPLOYED**

## Executive status

| Area | Status | Result |
|---|---|---|
| Repository and source audit | PASS | Source, Prisma, auth, mail, media, health, and build configuration reviewed. |
| Node/pnpm compatibility | PASS | Node `v24.22.3` and pnpm `12.18.0` ran in a disposable container. |
| Dependency install | PASS | `pnpm install --frozen-lockfile` passed supply-chain validation. |
| Schema and test database validation | PASS | Generate, migrations, seed, and validation passed only against a disposable PostgreSQL 17 database. |
| Lint and typecheck | PASS | Both completed without errors. |
| Test suite | PASS | 28 test files and 303 tests passed. |
| Production build | PASS | `pnpm build` passed with `NODE_ENV=production`; 26 routes generated. |
| Runtime smoke test | PASS | `pnpm start` ran without Resend variables; `/api/health` returned database/storage `ok` against the disposable test setup. |
| Production configuration preflight | BLOCKED | Correctly rejects localhost DB and missing production mail transport in the synthetic production fixture. |
| Coolify application state | BLOCKED | Resource exists and is configured, but API reports `exited:unhealthy` while no container exists and deployment history is empty. This must be reconciled before staging. |
| Staging readiness | BLOCKED | No isolated staging resource/database/media mount has been deployed or approved yet. |

**Final Phase 8I status: BLOCKED FOR PHASE 8J — build/runtime checks pass, but isolated staging configuration and the stale Coolify application state require owner/platform action.**

## 1. Repository audit

The repository was checked on `main` against the current `origin` revision before
the changes in this report. The working tree had no pre-existing staged changes.

Reviewed areas:

- `package.json`, `pnpm-lock.yaml`, engines, package manager, and scripts.
- `next.config.ts`, App Router layout, metadata, route map, and production
  headers.
- `prisma/schema.prisma`, `prisma7.config.ts`, and all committed migrations.
- Environment validation in `scripts/config-check.mjs`.
- Auth.js credentials flow, Argon2id password handling, authorization gates,
  invitation, and recovery services.
- Resend mail transport and failure handling.
- Local media storage abstraction, file validation, key/path safety, and
  `/api/health` database/storage checks.
- Nixpacks/Coolify deployment settings and deployment documentation.

The project declares `pnpm@12.18.0`, Node.js `>=24.0.0`, Next.js `16.4.6`,
React `19.3.1`, Prisma `7.10.1`, and `@prisma/adapter-pg` with the PostgreSQL
driver. Prisma 7 configuration and generated-client conventions are in use.

## 2. Safe repository changes

The following non-secret changes were made and are pending commit review:

- `.nvmrc`: changed the deployment/CI runtime from `26` to `24`.
- `src/app/global-error.tsx`: added a self-contained client error boundary with
  its own HTML/body and a generic message. It does not render error details,
  digests, tokens, or provider context.
- `README.md`, `.docs/Tech-Stack.md`, and
  `.docs/LOCAL_DEVELOPMENT.md`: clarified Node 24 as the deployment target,
  while retaining Node 26 as the owner's valid local runtime.
- This report.

The standalone error boundary follows the current Next.js requirement that a
root global error UI define its own `<html>` and `<body>` tags. See the
[Next.js error-handling documentation](https://nextjs.org/docs/app/getting-started/error-handling).

## 3. Build and validation evidence

All commands below ran inside a disposable `node:24-bookworm` container with
pnpm 12.18.0 installed inside that container only. The host VPS Node.js/pnpm
installation was not changed.

### Passed checks

```text
Node.js: v24.22.3
pnpm:    12.18.0
pnpm install --frozen-lockfile: PASS
pnpm db:generate:              PASS (Prisma Client 7.10.1)
pnpm db:migrate:deploy:        PASS (temporary PostgreSQL 17 only)
pnpm db:seed:                  PASS (temporary PostgreSQL 17 only)
pnpm db:validate:              PASS
pnpm config:check:             PASS (development rules, 0 errors, 0 warnings)
pnpm lint:                     PASS
pnpm typecheck:                PASS
pnpm test:                     PASS (28 files, 303 tests)
pnpm build:                    PASS (NODE_ENV=production)
pnpm start:                    PASS (temporary runtime)
GET /api/health:               PASS (database ok, storage ok in temporary setup)
```

The disposable PostgreSQL database used a loopback-only host port `55432` and
was stopped after the test. No production database migration, seed, or data
write was performed. The temporary test database and port listener are absent
after the run.

An earlier build attempt used `NODE_ENV=development` and failed during
`/_global-error` prerendering with `useContext` null. The production-correct
rerun passed. The non-standard `NODE_ENV` was the test harness error, not a
production build setting; it must not be used in Coolify. The final build was
also rerun after the error-boundary change.

The build logs may report handled content-query failures when no database is
available during a synthetic build; the build still succeeds. The full
pipeline build used the disposable migrated database and completed without a
route-generation failure.

The test suite contains an Argon2/rate-limit case that can exceed Vitest's
default five-second per-test limit under a busy 2-vCPU environment. One
recheck without the seed step also produced expected missing-seed assertions;
that harness error was corrected. A seeded verification run with a 15-second
test timeout passed all 303 tests. No repository timeout was changed because
the failure was timing-related and not an assertion or application regression.

## 4. Environment and secrets audit

The Coolify application was inspected read-only through the authenticated local
API. Secret values and hidden environment values were not printed.

Application resource: `4fndzksd1vmizwovi2bmvwmf`
Database resource: `aswul0ozryb1hxawjfzjsnwj`

The application environment contains the expected configuration names for:

- Node/Nixpacks runtime and commands.
- `NODE_ENV`, `DATABASE_URL`, `NEXTAUTH_URL`, and session/rate-limit/analytics
  secret variables.
- Local media driver, absolute media root, and production-local-media opt-in.
- Canonical email sender and Resend verification flag.
- Preview copies of the relevant non-secret/secret variable names.

The Coolify API intentionally redacts environment values in the read-only
response. Exact secret values therefore remain unprinted. The application
configuration review confirms the expected variable names exist, but a live
application cannot validate their runtime values until a staging container is
created.

Production mail variables remain intentionally incomplete:

- `ADMIN_MAIL_TRANSPORT` is not enabled.
- `RESEND_API_KEY` is not supplied.
- Resend sender-domain verification has not been performed.

This is correct for the current owner decision. `pnpm config:check
--production` was executed with a synthetic fixture and correctly returned
exit code 1 for the localhost database and missing mail transport. It was not
used against the real production secret values.

The runtime smoke test confirmed that the application can start and answer
health checks without Resend configuration. Invitation and password-recovery
operations must remain unavailable until Resend is verified and the protected
Coolify variables are supplied; the mailer fails closed and does not pretend
that a message was delivered.

## 5. Database readiness

### Production resource

- PostgreSQL 17 Coolify resource is preserved and remains private.
- Target database is `flexbox_linktree`.
- Target role is `flexbox_app`.
- No public PostgreSQL port is permitted.
- No production migration was run in Phase 8I.

The production database and role were created and permission-checked in the
previous provisioning phase. This phase did not alter them.

### Temporary validation database

The disposable PostgreSQL 17 database applied all 10 committed migrations,
loaded the non-production seed, and passed Prisma validation. This demonstrates
schema/runtime compatibility without changing production.

## 6. Media and health readiness

The Coolify storage definition remains:

```text
Host:      /data/flexbox/media
Container: /data/flexbox/media
Directory: true
```

The existing host directory is still `root:root` mode `0750`. The application
runtime UID/GID has not yet been proven against that mount because no Coolify
application container exists. Do not change ownership recursively or use
`chmod 777`; measure the staging runtime UID/GID first, then apply the minimum
needed group/ownership change with an explicit rollback plan.

The temporary runtime smoke test proved that `/api/health` checks both a
database query and local storage read/write. It did not prove persistence of
the real host mount across a Coolify container recreation; that is a Phase 8J
staging acceptance test.

## 7. Coolify review

Read-only API results:

- Coolify: `4.7.6`; Docker: `29.10.0`; Traefik: `3.7.19`.
- Application name: `flexbox-linktree`.
- Repository: `https://github.com/flexbox-studiocode/flexbox-linktree`.
- Branch: `main`.
- Build pack: `nixpacks`.
- Exposed internal port: `3000`.
- Health check: enabled, `GET /api/health`.
- FQDN configuration contains the canonical and WWW microsite domains.
- Persistent file storage points to `/data/flexbox/media`.
- Deployment API listing returned zero deployment records.
- No matching application container is present.

The API application status field currently reports `exited:unhealthy` despite
`container_present=false` and an empty deployment listing. This is stale or
inconsistent state that must be reconciled in Coolify before staging. No
automatic restart, redeploy, or configuration mutation was performed.

The current resource is in the Coolify production environment. It must not be
used as an unisolated staging database or media target. Create or approve a
separate staging environment/resource before Phase 8J deployment.

## 8. Security and safety results

- No secrets, API tokens, database URLs, passwords, dumps, backups, media, or
  runtime artifacts were added to Git.
- No production database migration, seed, admin bootstrap, deployment, DNS,
  NAT, firewall, SSH, or email action was performed.
- No Coolify internal database or undocumented tables were accessed.
- The temporary database used a loopback-only port and was removed by its
  disposable container lifecycle.
- No Docker prune or existing container/volume deletion was run.
- The Coolify dashboard and Traefik exposure remain infrastructure findings
  from earlier audits; no access-control change was made in this phase.

## 9. Phase 8J — staging deployment recommendation

Phase 8J should proceed only after the following owner/platform actions:

1. Reconcile the Coolify application status `exited:unhealthy` while preserving
   the existing application resource and database/volume.
2. Create or approve an isolated staging environment/application resource with
   a separate PostgreSQL 17 database and separate media path. Do not use the
   production database, production media, or production canonical domain.
3. Provide a staging `NEXTAUTH_URL` and protected staging secrets through
   Coolify. Do not copy production secrets into staging.
4. Decide whether staging mail uses the development-only file transport or an
   explicitly approved non-production provider. Do not use the unverified
   production sender or send production mail.
5. Verify the staging container UID/GID can write to its persistent media mount
   without broad permissions.
6. Deploy staging through Coolify only after the above isolation checks pass.

Staging acceptance should cover build/start, `/api/health`, reviewed Prisma
migrations against the staging database, CMS authorization, invitation and
recovery behavior under the approved mail mode, media upload/retrieval after
container recreation, analytics privacy behavior, logs, resource use, and
rollback. Production migration and public HTTPS cutover remain separate owner
approval gates.

## Owner action required

The exact next action is to approve an isolated Phase 8J staging resource and
ask the Coolify operator to reconcile the stale `exited:unhealthy` application
state without touching the existing PostgreSQL resource or volume. After that,
the staging deployment can be performed and verified before any production
deployment decision.

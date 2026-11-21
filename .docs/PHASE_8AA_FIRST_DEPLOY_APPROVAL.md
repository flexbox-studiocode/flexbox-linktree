# Phase 8AA — First Production Deployment Approval

Status: OWNER APPROVAL GRANTED — DEPLOYED, ACCEPTANCE IN PROGRESS

## Deployment plan

1. Commit/source: current `main` branch and accepted Dockerfile release.
2. Coolify application: `4fndzksd1vmizwovi2bmvwmf`.
3. Database: PostgreSQL resource `aswul0ozryb1hxawjfzjsnwj`, database
   `flexbox_linktree`, private network only.
4. Migration: 10 applied, 0 pending, 0 failed.
5. Administrator: one active `SUPER_ADMIN`; bootstrap flag disabled.
6. Media: `/data/flexbox/media`, UID/GID 1000:1000, mode 0750.
7. Build: repository `/Dockerfile`, Node.js 24, pnpm 12.18.0, internal port
   3000.
8. Health: `GET /api/health` expecting HTTP 200.
9. Domains: `microsite.flexbox.web.id` and
   `www.microsite.flexbox.web.id`.
10. Mail: disabled; no Resend key and no email delivery.

## Capacity and risks

- Approximately 9.0 GB disk available and 1.7 GB memory available at the
  latest audit.
- The 2 vCPU / 4 GB VPS is adequate for the existing staging footprint, but
  the first production build may temporarily increase CPU, RAM, and disk use.
- Production container is running healthy and the public domain has an active
  upstream.
- HTTPS has trusted Let's Encrypt certificates for canonical and WWW.

## Rollback

- Stop/rollback the Coolify application deployment while preserving the
  database and media.
- Keep the verified pre-migration database backup and all existing volumes.
- Do not reset or restore production automatically.
- Revert application code/configuration through Coolify/Git only after root
  cause analysis.

## Execution result

The owner explicitly approved the first production deployment in the current
execution request. The existing application resource was used; no duplicate
resource was created.

Three deployment attempts were made through the official Coolify API:

- `emm0gvghvc5gfhwk7rd0hach` — `failed` at 2026-11-21 10:37:13 UTC.
- `f1gulmpxlksvahzmdrhrgwev` — `failed` at 2026-11-21 10:40:38 UTC.
- `fdgflvggtorjq4pqfuf1gkrj` — `finished` at 2026-11-21 11:10:31 UTC.

The first two jobs stopped before a production container was created. The
application log endpoint became readable after `read:sensitive` was granted and
confirmed the malformed repository target. The third deployment completed with
a healthy production container and public health HTTP 200.

Before the second attempt, the application-level Traefik resolver was changed
from `none` to `letsencrypt` and force-HTTPS was enabled through the documented
application update endpoint. The change was verified, but it did not resolve
the early deployment failure. The repository field was then corrected to
`flexbox-studiocode/flexbox-linktree`, matching staging.

## Remaining gate

Owner-authenticated CMS and media smoke tests remain. Two malformed Next.js
Server Action errors were observed from external requests; they did not prevent
page delivery or health checks and remain a runtime-log follow-up.

# Phase 8AA — First Production Deployment Approval

Status: OWNER APPROVAL REQUIRED

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

- Approximately 9.8 GB disk available and 1.9 GB memory available at the
  latest audit.
- The 2 vCPU / 4 GB VPS is adequate for the existing staging footprint, but
  the first production build may temporarily increase CPU, RAM, and disk use.
- Production currently has no container, so the domain returns the proxy
  fallback/503 until deployment creates the upstream.
- HTTPS currently presents the Traefik default certificate and requires
  post-deployment ACME verification.

## Rollback

- Stop/rollback the Coolify application deployment while preserving the
  database and media.
- Keep the verified pre-migration database backup and all existing volumes.
- Do not reset or restore production automatically.
- Revert application code/configuration through Coolify/Git only after root
  cause analysis.

## Approval gate

The migration and administrator bootstrap approvals do not authorize the first
public production deployment. Approve the existing Coolify application
deployment explicitly before triggering it.

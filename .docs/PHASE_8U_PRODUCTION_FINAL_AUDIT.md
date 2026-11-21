# Phase 8U — Production Application Final Audit

Status: PASS FOR CONFIGURATION / BLOCKED FOR RUNTIME VALIDATION

## Coolify application configuration

- Application UUID: `4fndzksd1vmizwovi2bmvwmf`.
- Repository: `https://github.com/flexbox-studiocode/flexbox-linktree`.
- Branch: `main`.
- Build pack: `dockerfile`.
- Dockerfile: `/Dockerfile`.
- Exposed port: `3000`.
- Health check: `GET /api/health`, expected HTTP 200.
- FQDNs: `https://microsite.flexbox.web.id` and
  `https://www.microsite.flexbox.web.id`.
- Redirect policy: non-WWW canonical behavior is configured.
- Production deployment history: zero; no container exists.

## Storage and database separation

- Production storage record mounts `/data/flexbox/media`.
- Host directory mode is `0750`, ownership UID/GID `1000:1000`.
- Runtime write/read/delete test passed as UID/GID 1000:1000.
- Production PostgreSQL resource remains private and has no public host port.
- Production target is `flexbox_linktree`; staging uses a separate database,
  role, media directory, and generated preview host.

## Environment and mail safety

- Secret values were not read or printed.
- Protected production environment metadata was inspected through Coolify.
- `ADMIN_MAIL_TRANSPORT=disabled` is explicitly configured for the first
  release.
- No `RESEND_API_KEY` was added and no email was sent.
- Actual production configuration validation cannot be completed until a
  production container exists and receives the protected values. Synthetic
  checks are not treated as proof of production validity.

## Build and staging evidence

- Node.js 24 and pnpm 12.18.0 build path passed in staging.
- Lint, typecheck, database validation, configuration checks, build, and 304
  tests passed in the accepted pre-production checks.
- Staging deployment is healthy and `/api/health` reports database/storage
  `ok`.

## Final audit result

Configuration is prepared and separated from staging, but runtime validation is
BLOCKED until the owner approves production migration and the first
production deployment. No migration, seed, admin bootstrap, deployment,
certificate issuance, or public acceptance test was run.

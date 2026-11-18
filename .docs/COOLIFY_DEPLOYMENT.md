# Coolify Deployment Preparation

## Application

- Project: `FlexBox Studio`
- Environment: `production`
- Application: `flexbox-linktree`
- Repository: `flexbox-studiocode/flexbox-linktree`
- Branch: `main`
- Build method: Nixpacks or tested production Dockerfile
- Node.js: 24
- pnpm: `12.18.0`
- Internal port: `3000`
- Start command: `pnpm start`

Build commands:

```text
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
```

Coolify health check: `GET /api/health`, expected HTTP `200` with database and
storage checks reporting `ok`. A dependency or mount failure returns HTTP `503`
without exposing secret or connection details. Configure the health check only
after the application resource and private PostgreSQL resource exist.

Run migrations only as a reviewed pre-deploy command, never during image
build:

```text
pnpm db:migrate:deploy
```

Do not use the repository development `docker-compose.yml` as the production
application definition.

## Persistent media

The application expects:

```text
MEDIA_STORAGE_DRIVER=local
MEDIA_LOCAL_ROOT=/data/flexbox/media
MEDIA_ALLOW_LOCAL_IN_PRODUCTION=true
```

Coolify must mount a persistent host/volume path to the same absolute target
inside the application container. Confirm the actual runtime working directory
and mount in Coolify before deployment. The application does not expose the
storage directory as a directory listing; media is served through the existing
validated media route.

## PostgreSQL

Create a separate PostgreSQL 17 resource for the application. Keep it on a
private Coolify network, use a dedicated database/user, and do not publish
port 5432. The Coolify internal PostgreSQL database must never be reused.

## Email

Use these Coolify secret variables only after Resend verifies the sender domain:

```text
ADMIN_MAIL_TRANSPORT=resend
RESEND_API_KEY=<secret>
EMAIL_FROM=noreply@mail.microsite.flexbox.web.id
RESEND_SENDER_VERIFIED=true
```

Set `RESEND_SENDER_VERIFIED=true` only after Resend confirms
`mail.microsite.flexbox.web.id` and its DNS records. Do not test delivery before
domain verification and owner approval.

## Domain and proxy

Configure `https://microsite.flexbox.web.id` through Coolify/Traefik only after
owner approval. The application alias is
`https://www.microsite.flexbox.web.id`; the canonical URL remains the microsite
subdomain. Provider-level NAT must forward public TCP 80/443 to this
VPS. Do not publish the application port directly and do not expose PostgreSQL.

## Phase 8C readiness audit

- Authoritative `microsite.flexbox.web.id` A record: `217.216.146.40`.
- Authoritative `www.microsite.flexbox.web.id` CNAME: `microsite.flexbox.web.id.`.
- Public resolver propagation is not yet uniform: 1.1.1.1 returns the approved
  CNAME, while 8.8.8.8 still returns a stale `www.microsite.` target.
- The current zone SOA still reports `a.misconfigured.dns.server.invalid`;
  provider correction is required.
- `/data/flexbox/media` is not present on the VPS and no application mount exists.
- Only Coolify's internal PostgreSQL 15 container is present; PostgreSQL 17 for
  this application has not been provisioned.

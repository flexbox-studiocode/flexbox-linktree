# Phase 8 Production Go-Live Report

Status: **BLOCKED — DEPLOYMENT FAILED, NOT LIVE**

## Current state

- Coolify project, production environment, destination, PostgreSQL resource,
  application resource, media mount, and protected environment metadata are
  provisioned.
- PostgreSQL 17 is healthy and private; target database and least-privilege
  role exist.
- A separate Coolify staging environment, staging database/role, staging
  application resource, and staging media mount were provisioned in Phase 8J–8L.
- Staging deployment `jzutavljasxm0wb2ae69rtfu` finished successfully. The
  container is healthy; internal health returned database/storage `ok`, and
  the staging media mount passed a runtime write/read/delete test.
- Production preflight selected the accepted Dockerfile build, added explicit
  no-email mode through Coolify, and verified the production media directory
  is writable by runtime UID/GID 1000:1000 with mode 0750.
- A fresh production database backup was created and restore-verified in an
  isolated PostgreSQL 17 instance before migration/deployment work.
- Phase 8X final target and role verification passed, but migration execution
  was blocked because the protected production `DATABASE_URL` cannot be
  injected into a Prisma execution context without exposing or changing the
  secret. No migration was run.
- Phase 8X migration is now complete: all 10 production migrations applied,
  with zero pending or failed entries. Schema, role security, staging
  isolation, backup state, and private database port were verified.
- Phase 8Y administrator bootstrap completed successfully: one active
  `SUPER_ADMIN`, Argon2id password hash, one `ACCOUNT_BOOTSTRAPPED` event, and
  bootstrap flag disabled. No email was sent.
- Production deployment history contains two failed attempts and no production
  application container exists.
- No production seed, public deployment, HTTPS issuance, DNS change, NAT
  change, or production email was performed.

## Completed readiness work

- Repository checks passed in Node.js 24 / pnpm 12.18.0:
  `pnpm install --frozen-lockfile`, lint, typecheck, Prisma validation,
  configuration preflight, build, and 28 test files / 304 tests.
- Production-safe no-email mode is implemented and tested. Resend remains
  disabled until sender-domain verification.
- Existing production backup checksum and custom archive listing were verified.

## Blocking prerequisites

- External staging preview is blocked by the provider's Domain & Website
  layer, which returns a "Domain belum terhubung" page for the generated
  `sslip.io` hostname. Local Traefik host routing and the application itself
  return HTTP 200.
- Determine whether the owner wants a provider-managed staging hostname or
  to proceed with production gates; do not use the production domain for
  staging.
- Provide and verify Resend sender-domain credentials before enabling email;
  email remains disabled for this release.
- Detailed Coolify deployment output is required before another deploy retry;
  public HTTPS currently has no usable certificate because no production
  router exists.
- Obtain detailed deployment output. The current Coolify API token can trigger
  deployment and read resource metadata, but `GET /applications/{uuid}/logs`
  is denied with HTTP 403 because `read:sensitive` is not granted. Coolify's
  official API documentation requires `read:sensitive` or a root token for
  application logs.
- Do not retry deployment until the first failing stage is known.

## Security status

- PostgreSQL has no public host port.
- Coolify API token is stored outside Git in a root-only secret file.
- Application secret values are stored as hidden Coolify environment variables.
- No secrets, database dumps, media, or runtime files were added to Git.
- Coolify and Traefik administrative exposure still requires final access-control
  review; no firewall or SSH change was made.

## Read-only public/network follow-up

- Current public resolver checks record A
  `microsite.flexbox.web.id -> 217.216.146.40` and CNAME
  `www.microsite.flexbox.web.id -> microsite.flexbox.web.id`.
- Current authoritative nameservers are the `b/c/d/e/f.dns.id` servers and
  the SOA is served by `b.dns.id`; the previous malformed SOA was not
  reproduced.
- Deployment `emm0gvghvc5gfhwk7rd0hach` failed before a container was created.
- After the documented Traefik resolver correction, deployment
  `f1gulmpxlksvahzmdrhrgwev` also failed before a container was created.
- Public HTTP and HTTPS return HTTP 503 with the Coolify "Site not available"
  page because no production upstream container is deployed.
  HTTPS presents `TRAEFIK DEFAULT CERT`, not a valid microsite certificate;
  these results are not treated as application success.
- No firewall, NAT, SSH, DNS, or management-port change was made.

## Final status

**STAGING ACCEPTED INTERNALLY; PRODUCTION DEPLOYMENT BLOCKED — no public
production verification is claimed.**

Detailed evidence is maintained in the Phase 8J–8T reports.

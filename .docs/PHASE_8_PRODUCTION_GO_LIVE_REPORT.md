# Phase 8 Production Go-Live Report

Status: **BLOCKED — NOT YET DEPLOYED**

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
- Production deployment history is empty and no production application
  container exists.
- No production migration, seed, administrator bootstrap, public deployment,
  HTTPS issuance, DNS change, NAT change, or production email was performed.

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
- Provide and verify Resend sender-domain credentials before enabling email.
- Resolve provider DNS/SOA and independently confirm TCP 80/443 NAT.
- Obtain explicit approval for production migration and first public deploy.

## Security status

- PostgreSQL has no public host port.
- Coolify API token is stored outside Git in a root-only secret file.
- Application secret values are stored as hidden Coolify environment variables.
- No secrets, database dumps, media, or runtime files were added to Git.
- Coolify and Traefik administrative exposure still requires final access-control
  review; no firewall or SSH change was made.

## Read-only public/network follow-up

- Earlier public resolver checks recorded A
  `microsite.flexbox.web.id -> 217.216.146.40` and CNAME
  `www.microsite.flexbox.web.id -> microsite.flexbox.web.id`.
- Authoritative NS were recorded as `ns1.dnama.id` and `ns2.dnama.id`.
- The earlier zone SOA reported `a.misconfigured.dns.server.invalid`; this
  remains an external provider action until independently rechecked.
- A public HTTP 404 and failed HTTPS handshake were correctly not treated as
  application success because no production deployment/container exists.
- No firewall, NAT, SSH, DNS, or management-port change was made.

## Final status

**STAGING ACCEPTED INTERNALLY; PRODUCTION PROVISIONED BUT NOT DEPLOYED — no
public production verification is claimed.**

Detailed evidence is maintained in the Phase 8J–8T reports.

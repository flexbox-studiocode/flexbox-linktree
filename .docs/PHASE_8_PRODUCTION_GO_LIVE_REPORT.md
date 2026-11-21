# Phase 8 Production Go-Live Report

Status: **BLOCKED**

The project is not live. No production application resource exists in Coolify;
the existing PostgreSQL 17 resource is healthy, but no production migration or
application deployment has been performed.

## Verified prerequisites

- Repository is on `main` and synchronized with `origin/main`.
- Domain apex and WWW DNS records resolve to the approved target.
- Docker, Coolify, and Traefik are healthy.
- Host media directory `/data/flexbox/media` exists with mode `0750` and
  `root:root` ownership.
- Node 24/pnpm 12.18.0 application pipeline was previously verified against a
  disposable PostgreSQL 17 database with 303 tests passing.

## Blocking prerequisites

- Coolify API token available to the active automation session and authorized
  resource discovery.
- PostgreSQL 17 private resource exists, but `flexbox_linktree` and
  `flexbox_app` plus application connection details are not ready.
- Official Coolify persistent storage mount for the application.
- Resend sender-domain verification and provider-issued DNS records.
- Provider confirmation of NAT TCP 80/443.
- Dashboard exposure/access-control review for Coolify 8000 and Traefik 8080.
- Staging deployment and verification.
- Separate owner approval for production migration, SSL/cutover, and email
  delivery.

## Final status

**NOT YET DEPLOYED — no public production verification is claimed.**

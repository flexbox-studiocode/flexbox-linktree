# Phase 8 Final Production Report

Status: **BLOCKED**

Audit timestamp: 2026-11-18 UTC

This report records the current state after the Phase 8 execution audit. No
production deployment, production migration, DNS change, firewall/SSH change,
Coolify configuration change, or production email was performed.

## Infrastructure

- Host: `flexbox-16419`
- OS: Ubuntu 24.04.5 LTS
- Private address observed: `10.10.1.7`
- Public address previously provided: `217.216.146.40`
- CPU/RAM: 2 vCPU / 3.8 GiB RAM
- Disk: 38 GiB total, 29 GiB available at audit time
- Swap: not configured
- Docker Engine: `29.10.0`, running normally

## Repository and Git

- Working directory: `/opt/flexbox`
- Branch: `main`
- Origin: `https://github.com/flexbox-studiocode/flexbox-linktree.git`
- HEAD: `aae44b4 docs(release): record final green CI verification`
- Remote `main` was inspected and was not modified.
- Existing staged and unstaged Phase 8 changes remain uncommitted.
- No secrets, API keys, database dumps, or user media are tracked.
- `.gitignore` covers environment files, local storage, generated files, and dumps.
- Commit/push is pending the owner's local Git identity and review approval.

## Domain, DNS, NAT, and HTTPS

- Canonical domain: `https://microsite.flexbox.web.id`
- WWW alias: `https://www.microsite.flexbox.web.id`
- Admin path: `/admin`
- `microsite.flexbox.web.id` resolves to `217.216.146.40` through the
  authoritative nameserver and public resolvers.
- Authoritative `www.microsite.flexbox.web.id` points to the approved target
  `microsite.flexbox.web.id.`.
- Public resolver propagation is inconsistent: 1.1.1.1 has the approved target,
  while 8.8.8.8 still returns the stale `www.microsite.` target.
- The zone SOA still reports `a.misconfigured.dns.server.invalid`.
- No active repository reference to the old microsite domain remains.
- DNS cutover was not performed.
- Provider NAT forwarding for TCP 80/443 is not yet verified.
- HTTPS certificate was not issued and production is not live.

## Coolify and reverse proxy

- Coolify `4.7.5`: healthy.
- Coolify internal database: PostgreSQL 15, existing Coolify service only.
- Coolify Redis: healthy.
- Traefik `3.7.19`: healthy.
- Host ports 80 and 443 are owned by Coolify Traefik.
- Coolify is bound locally on host port 8000; the previously supplied provider
  mapping is public port 30002 to VPS port 8000.
- Traefik's host port 8080 is also bound. Dashboard exposure and access control
  require explicit owner/provider review; no change was made.
- No FlexBox application container or route currently exists.
- Local requests to port 80/443 return Traefik `503`, confirming no application
  route is deployed yet.

## Database and migrations

- No FlexBox production PostgreSQL 17 resource has been provisioned.
- No production database connection was used.
- No production migration was run.
- PostgreSQL 17 migrations and seed were tested only against a disposable local
  test container; all 303 application tests passed there.

## Storage

- Approved target: `/data/flexbox/media`
- Production local storage requires an absolute path and explicit opt-in.
- Storage keys reject absolute paths, traversal, backslashes, control
  characters, empty/dot segments, and malformed keys.
- Upload validation checks magic bytes, declared MIME type, extension, size, and
  rejects SVG.
- A Coolify persistent mount has not yet been created or verified.
- No backup or restore drill has been performed for production media.

## Email

- Transport implementation uses the Resend HTTPS API.
- Invitation and password-recovery flows call the shared admin mailer.
- Production sender: `noreply@mail.microsite.flexbox.web.id`.
- Resend sender-domain verification is not confirmed.
- No production API key was inspected or printed.
- No production email was sent.

## Application readiness and testing

- `/api/health` checks database and storage readiness and returns 200/503
  without sensitive details.
- Node 24 + pnpm 12.18.0 frozen install: PASS.
- Node 24 full pipeline with disposable PostgreSQL 17: PASS.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`: PASS.
- Test suite: 28 files / 303 tests PASS.
- `pnpm config:check --production` with internal synthetic database host:
  **0 errors, 0 warnings**.
- Node 26 + pnpm 12.18.0 install, lint, typecheck, build: PASS.
- `pnpm db:validate`: PASS.
- Disposable PostgreSQL 17 migration and seed: PASS.
- Production config check with empty environment: correctly BLOCKED.

## Required owner/provider actions

1. Confirm WWW DNS propagation and ask the DNS provider to correct the SOA.
2. Confirm provider NAT forwarding of public TCP 80/443 to this VPS.
3. Restrict or protect Coolify and Traefik dashboard exposure before public use.
4. Create private PostgreSQL 17 in Coolify without publishing port 5432.
5. Create the application resource from the `main` branch.
6. Mount persistent `/data/flexbox/media` and define its backup policy.
7. Verify `mail.microsite.flexbox.web.id` in Resend and add its DNS records.
8. Provide production secrets directly in Coolify, never in Git or chat.
9. Provide the owner's Git name/email for local repository configuration if a
   commit and push are approved.
10. Approve staging tests, production migration, SSL issuance, and DNS cutover.

## Final status

**BLOCKED — not deployed and not live.**

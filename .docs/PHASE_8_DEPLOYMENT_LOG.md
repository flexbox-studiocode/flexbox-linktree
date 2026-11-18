# Phase 8A Deployment Log

Project: FlexBox Linktree
Target: `microsite.flexbox.web.id`
Status: Phase 8A preparation; **not deployed**

## Safety boundary

This phase does not change DNS or nameservers, expose PostgreSQL, modify SSH or
firewall rules, run production migrations, send production email, restart the
VPS, or remove any container/volume.

## Baseline

- Host: `flexbox-16419`
- OS: Ubuntu 24.04.5 LTS
- Public IP observed externally: `217.216.146.40`
- Private interface address: `10.10.1.7/22`
- Docker: `29.10.0`
- Coolify: `4.7.5`, healthy
- CPU/RAM: 2 vCPU / 3.8 GiB detected
- Disk: 38 GiB root, approximately 33 GiB available at audit time
- Swap: not configured
- Repository commit at start: `aae44b45db7b73782cca696a6c789b6dac2ada2e`
- Repository working tree: clean at start

## Infrastructure decisions

- Primary domain: `microsite.flexbox.web.id`
- WWW alias: `www.microsite.flexbox.web.id`
- Admin path: `microsite.flexbox.web.id/admin`
- Canonical URL: `https://microsite.flexbox.web.id`
- Nameservers remain `ns1.dnama.id` and `ns2.dnama.id`
- Media target: local persistent storage at `/data/flexbox/media`
- Database target: PostgreSQL 17 through Coolify, private network only
- Email target: Resend, sender `noreply@mail.microsite.flexbox.web.id`

## NAT audit

The VPS has a private address on `eth0` and the public address is observed by
external services. This indicates provider-side NAT or an equivalent network
translation layer. The VPS itself only contains Docker NAT rules for its own
container networks; it does not control the provider's public port mapping.

VPS Murah's public NAT documentation says NAT plans share an IPv4 address and
assign a dedicated port range. The exact allocated port range must be checked
in the provider dashboard. For this deployment, provider-level forwarding of
public TCP 80 and 443 to this VPS is required before HTTPS can work. No port
mapping was changed during Phase 8A.

## DNS audit

Read-only DNS observation found the configured nameservers and an A record for
The previously audited `flexbox.web.id` record belongs to the company domain,
not this application. It must not be used as the microsite canonical URL. The
new microsite DNS record has not been changed by this task; external DNS and
HTTPS verification are still pending.

## Code changes in Phase 8A

- Production local storage now requires an explicit opt-in and an absolute
  `MEDIA_LOCAL_ROOT`, allowing a persistent Coolify mount.
- Production preflight accepts either S3 or explicitly mounted local storage.
- Resend mail transport was implemented using the provider HTTPS API. It does
  not send anything until the application invokes it with valid credentials;
  no production email was sent during this phase.
- Added `/api/health`, returning only safe `ok/error` states for PostgreSQL and
  storage readiness.
- Updated environment template and production configuration documentation.

## Verification status

Final pre-deployment code audit completed in a disposable Node 26.13.1 / pnpm
12.18.0 environment. No deployment, production database access, migration, DNS
change, firewall/SSH change, or production email was performed.

- `pnpm install --frozen-lockfile`: **PASS**; lockfile supply-chain policy passed.
- `pnpm db:validate`: **PASS**.
- `pnpm lint`: **PASS**.
- `pnpm typecheck`: **PASS** after `pnpm db:generate`.
- `pnpm test`: **PASS**, 28 files / 303 tests, against disposable PostgreSQL 17
  after migrations and seed data.
- `pnpm build`: **PASS** after `pnpm db:generate`, with the microsite origin and
  local persistent-media settings.
- `pnpm config:check --production`: **BLOCKED** with empty environment, as
  expected; synthetic production fixture: **0 errors, 1 warning** (both session
  secret names were supplied in the fixture and should be reduced to one).
- `git diff --cached --check` and `git diff --check`: **PASS**.

The first test run without seed data reported three content-repository failures;
the seeded disposable rerun passed all 303 tests. The first build attempt also
required the documented `pnpm db:generate` step; this is an operational
pre-build requirement, not a production migration.

The only remaining `flexbox.web.id` reference is this log's historical note that
the company domain is not the microsite domain. Active application configuration
uses `microsite.flexbox.web.id`.

## Remaining owner/provider actions

1. Confirm NAT provider forwarding for TCP 80 and 443.
2. Verify `mail.microsite.flexbox.web.id` in Resend and publish the requested DNS records;
   only then set `RESEND_SENDER_VERIFIED=true`.
3. Approve creation of private PostgreSQL 17 and the Coolify application.
4. Approve the persistent volume mapping to `/data/flexbox/media`.
5. Provide production secrets through Coolify secret variables; never send them
   in chat or commit them.
6. Approve production migration and DNS/HTTPS cutover after staging checks.

## Final pre-deployment blockers

- Resend must verify `mail.microsite.flexbox.web.id`; only then may the owner
  provide `RESEND_API_KEY`, set `RESEND_SENDER_VERIFIED=true`, and authorize a
  staging delivery test.
- Coolify PostgreSQL 17, the private application resource, and the persistent
  mount `/data/flexbox/media` still require owner approval and provisioning.
- Provider NAT forwarding for public TCP 80/443 and external DNS/HTTPS must be
  verified before claiming the microsite is live.
- Production secrets, backup/RPO/RTO policy, staging checks, and explicit release
  approval are still required.

## Phase 8B final domain audit

- Final canonical domain: `microsite.flexbox.web.id`.
- Final WWW alias: `www.microsite.flexbox.web.id`.
- Authoritative apex A record currently resolves to `217.216.146.40`.
- Authoritative WWW CNAME currently resolves to `www.microsite.`, which is not
  the approved target. It must be changed manually to
  `microsite.flexbox.web.id.`.
- The zone SOA still reports `a.misconfigured.dns.server.invalid`; this requires
  VPS Murah/DNS provider correction.
- Public DNS was queried read-only through 1.1.1.1 and 8.8.8.8. No DNS record
  was changed by this task.

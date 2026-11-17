# Flexbox Linktree

Flexbox Linktree (also described as the Flexbox Studio Digital Hub) is the digital directory and microsite for Flexbox Studio.

The product has two connected experiences built on one content system:

1. **Public User Page** — a lightweight, editorial, mobile-first directory of the studio's projects, resources, portfolio, community destinations, and contact channels.
2. **Private Admin CMS** — a protected content-management application for authorized Flexbox members.

The public experience is deliberately a microsite, not an application dashboard.

## Status

**Phase 7 — Quality, Security, and Release Readiness** is complete with the decision **READY WITH DOCUMENTED LIMITATIONS** (`.docs/RELEASE_READINESS.md`). Phase 8 (VPS deployment and production) is next. An authorized Flexbox Super Admin can manage categories, links, site settings, the media library, and administrator accounts from a protected CMS, with audit logging and system status, without source-code changes. Privacy-conscious page-view and link-click analytics are collected and reported at `/admin/analytics`. Phases 6 (analytics), 5 (full CMS), 4 (authentication and authorization), 3 (database-backed content), 2 (public microsite), and 1 (local environment) remain in place.

Implemented at this point:

- Next.js App Router application with TypeScript (strict) and Tailwind CSS v4.
- Public Flexbox Studio Digital Hub: header, hero, editorial directory with eight curated cards, contact call-to-action, and **blue** graphite footer.
- Safe destination handling through `src/lib/utils/url.ts`; unconfirmed destinations render as non-interactive "Segera" cards rather than invented links.
- PostgreSQL content schema (`categories`, `links`, `site_settings`, `media_assets`) with enums, foreign keys, CHECK constraints, and indexes.
- Typed content layer in `src/features/content`: Zod validation, server-only repositories, DTO mappers, and cached services. The public route reads published, active records only.
- Administrator identity schema (`admin_users`, `admin_invitations`, `password_reset_tokens`, `admin_rate_limits`, `security_events`) with additive migrations.
- Credentials sign-in at `/admin/login` using Auth.js v4 with JWT sessions, Argon2id password hashes, and database-backed login throttling.
- Protected CMS at `/admin`: dashboard, links, categories, settings, media, administrators, audit logs, and system status. Every page, Server Action, and data service re-authorizes on the server.
- Link and category CRUD with reordering, publish/unpublish, archive, restore, and delete; typed site settings for branding, hero, contact, social, footer, and SEO.
- Media library with validated upload: real content-type detection by magic bytes, SVG rejection, size limits, metadata editing, reference-protected deletion, and local or S3-compatible storage through `src/lib/storage/`.
- Administrator management that reuses the Phase 4 provisioning and lifecycle services, with self-lockout and last-active-admin protection; invitation tokens are shown once for private delivery.
- Audit trail: authentication and CMS content events share the append-only `security_events` table and are readable at `/admin/audit-logs`.
- Public cache invalidation on CMS mutation through the `public-content` tag and the `/` path.
- Privacy-conscious analytics: first-party collector at `/api/analytics/collect` (204-always, device/browser/OS/referrer normalization, no raw IPs), admin dashboard at `/admin/analytics` with range and dimension views, CSV export with formula neutralization, and a 90-day retention CLI (`pnpm analytics:cleanup`).
- Internal provisioning only: bootstrap, invitation, invitation acceptance, status, and cleanup CLIs. No public registration.
- Server-side authorization for protected pages, Server Actions, and data services, with immediate revocation through `authVersion`.
- Sign-out, signed-in password change, forgot-password, and reset-password flows; the development mail transport writes to `.local-storage/mail/` and refuses to run in production.
- Idempotent development seed in `prisma/seed-data.ts`, applied with `pnpm db:seed`.
- Self-hosted Anton (display) and Manrope (body fallback) through `next/font`.
- Page metadata, favicon, and `/robots.txt`.
- Local PostgreSQL 17 running in Docker, connected through Prisma 7 with the `pg` driver adapter.
- Lint, typecheck, unit + database integration tests, production build, and browser QA scripts.

Not implemented yet (later roadmap phases):

- Multi-factor authentication and a production transactional mail provider.
- Production deployment, Coolify, and staging infrastructure (Phase 8).

Deliberate scope decisions in Phase 5: no draft-preview route on the public site (public preview is published content only), invitation acceptance stays CLI-only (`pnpm admin:accept-invite`), SVG uploads are rejected rather than sanitized, and only the `SUPER_ADMIN` role is supported.

Content still awaiting owner confirmation: six directory destinations, the public contact channel, and the final production domain. They are stored as non-interactive states (`destinationType = NONE`, `contact.contactEmail = null`), so resolving them is a data change rather than a code change. See `.docs/Roadmap.md`, `.docs/PUBLIC_PAGE.md`, and `.docs/DATABASE_SCHEMA.md`.

See `.docs/Roadmap.md` for the full phase plan and exit criteria.

## Technology Stack

| Layer | Technology |
|---|---|
| Web framework | Next.js 16 (App Router) |
| Language | TypeScript 5.9, strict mode |
| UI library | React 19 |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 17 |
| ORM | Prisma ORM 7 (`prisma-client` generator, `@prisma/adapter-pg`) |
| Authentication | Auth.js / NextAuth v4 Credentials provider, JWT sessions |
| Password hashing | Argon2id via `@node-rs/argon2` |
| Package manager | pnpm 12 |
| Local containers | Docker Compose (PostgreSQL only) |

Exact versions, version policy, and compatibility notes are recorded in `.docs/Tech-Stack.md`.

## Prerequisites

- Node.js 26 LTS (the local machine reports v26.13.0; Node 24+ is the supported floor).
- pnpm 12.18.0 (pinned through `packageManager`; enable with Corepack where available).
- Docker Desktop with the Linux engine and WSL2.
- Git.

## Local Setup (short version)

```powershell
# 1. Start the local PostgreSQL container
docker compose up -d postgres
docker compose ps

# 2. Install dependencies
pnpm install

# 3. Create local environment variables (never commit this file)
Copy-Item .env.example .env.local
# then set DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, and RATE_LIMIT_SECRET
# media uploads default to the local driver under .local-storage/uploads/

# 4. Apply migrations, generate the Prisma client, and seed content
pnpm db:migrate:deploy
pnpm db:generate
pnpm db:seed

# 5. Start the app
pnpm dev
```

Open `http://localhost:3000`.

To create the first administrator, temporarily set `ADMIN_BOOTSTRAP_ENABLED="true"` plus `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_NAME` in `.env.local`, then run:

```powershell
pnpm admin:bootstrap
```

Turn `ADMIN_BOOTSTRAP_ENABLED` off afterwards; the command also refuses to run once any administrator exists. Sign in at `http://localhost:3000/admin/login`.

Full Windows instructions, environment-variable rules, database commands, reset guidance, and troubleshooting live in `.docs/LOCAL_DEVELOPMENT.md`.

## Repository Documentation

| Document | Purpose |
|---|---|
| `.docs/PRD.md` | Product requirements; authoritative functional scope. |
| `.docs/Architecture.md` | System boundaries, data flow, security, and recorded decisions. |
| `.docs/Tech-Stack.md` | Selected technologies, versions, and compatibility policy. |
| `.docs/Structure_File.md` | Repository layout and conventions. |
| `.docs/Roadmap.md` | Phases and measurable exit criteria. |
| `.docs/DATABASE_SCHEMA.md` | Content tables, relationships, constraints, indexes, publication lifecycle, destination model, and seed/migration commands. |
| `.docs/AUTH_SECURITY.md` | Authentication model, authorization boundary, provisioning, recovery, threat model, and verification record. |
| `.docs/ADMIN_CMS.md` | CMS screens, authorization requirements, content workflow, media rules, and verification record. |
| `.docs/PUBLIC_PAGE.md` | Public page sections, content model, destination policy, and QA commands. |
| `.docs/ANALYTICS_SPECIFICATION.md` | Analytics event model, aggregation, reporting, and access-control scope. |
| `.docs/ANALYTICS_PRIVACY.md` | Privacy model, data minimization, retention, and visitor-facing disclosure requirements. |
| `.docs/ANALYTICS_OPERATIONS.md` | Analytics reconciliation, retention, health signals, and operations runbook. |
| `.docs/PHASE_7_BASELINE.md` | Phase 7 starting state, checks, dependency audit, and release risks. |
| `.docs/PHASE_7_TRACEABILITY.md` | Requirements matrix and Phase 7 discrepancy register. |
| `.docs/DEPENDENCY_SECURITY.md` | Dependency policy, audit result, and supply-chain controls. |
| `.docs/SECURITY_REVIEW.md` | Threat boundaries, hardening applied, verification, and residual risks. |
| `.docs/DATABASE_BACKUP_RECOVERY.md` | PostgreSQL backup, isolated restore verification, and incident recovery runbook. |
| `.docs/QA_TEST_REPORT.md` | Executed test, journey, performance, accessibility, and visual evidence. |
| `.docs/PRODUCTION_CONFIGURATION.md` | Required production settings, safe preflight, and known launch blockers. |
| `.docs/RELEASE_READINESS.md` | Phase 7 decision, evidence, accepted limitations, and Phase 8 handoff. |
| `.docs/LOCAL_DEVELOPMENT.md` | Repeatable local Windows setup. |
| `.docs/Desain.md` | Visual design authority for the public microsite (kept in its original Indonesian form). |
| `AGENTS.md` | Operative rules for contributors and coding assistants. |

Brand assets live in `.flexbox/` (source) and `public/assets/` (web-ready copies).

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the Next.js development server. |
| `pnpm build` | Production build. |
| `pnpm start` | Start the production build. |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | TypeScript check with `tsc --noEmit`. |
| `pnpm test` | Vitest unit tests plus local-database integration tests. |
| `pnpm qa:visual` | Viewport screenshots plus overflow, console, and network checks (needs the app server). |
| `pnpm qa:a11y` | Accessibility, contrast, zoom, anchor, and reduced-motion checks (needs the app server). |
| `pnpm qa:e2e` | Release journey in Chrome: public page, redirect safety, admin gate, headers, collector (needs the app server). |
| `pnpm perf:smoke` | Concurrent public-page and analytics-collector latency smoke (needs the app server). |
| `pnpm config:check` | Validate local or supplied environment configuration; use `--production` before release. |
| `pnpm db:generate` | Generate Prisma Client. |
| `pnpm db:validate` | Validate the Prisma schema. |
| `pnpm db:migrate` | Create/apply a development migration (local database only). |
| `pnpm db:migrate:deploy` | Apply committed migrations (staging/production safe). |
| `pnpm db:seed` | Upsert the development content dataset (idempotent). |
| `pnpm db:studio` | Open Prisma Studio. |
| `pnpm db:check` | Run the local Prisma connectivity check. |
| `pnpm db:backup` | Create a local custom-format PostgreSQL backup with SHA-256 sidecar. |
| `pnpm db:restore:verify` | Restore newest backup to isolated PostgreSQL and compare tables, row counts, and migration ledger. |
| `pnpm admin:bootstrap` | Create the first Super Admin (requires `ADMIN_BOOTSTRAP_ENABLED=true`). |
| `pnpm admin:invite` | Issue a single-use invitation for an approved member. |
| `pnpm admin:accept-invite` | Activate an invited account with a password from stdin. |
| `pnpm admin:set-status` | Suspend, disable, or reactivate an administrator account. |
| `pnpm admin:cleanup` | Delete expired reset tokens and stale throttle rows. |
| `pnpm analytics:cleanup` | Delete analytics raw events older than the retention window. |

## Security Notes

- `.env.local` and all real secrets are ignored by Git. Only `.env.example` with placeholders is committed.
- The local PostgreSQL port is bound to `127.0.0.1` only.
- `docker compose down -v` deletes the local database volume. Do not run it unless you intend to lose local data.
- No production infrastructure, deployment, or credentials are part of this repository state.

## License

See `LICENSE`.
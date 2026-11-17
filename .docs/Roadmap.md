# Product and Engineering Roadmap

**Project:** Flexbox Linktree  
**Status:** Initial roadmap  
**Language:** English

## Roadmap Principles

- Build and verify the local environment before implementing product features.
- Deliver the public microsite and the CMS as two experiences over one content system.
- Keep the public page editorial and free of search/filter controls in the initial release.
- Implement authentication and server-side authorization before exposing CMS mutations.
- Build analytics collection before analytics dashboards.
- Do not deploy directly to production from unverified local work.
- Prefer a modular monolith over microservices for the first release.

## Phase 0 — Product and Documentation Baseline

**Goal:** Align the team on product scope and technical decisions.

Tasks:
- [x] Confirm two product areas: Public User Page and private Admin Page.
- [x] Confirm Next.js, Tailwind CSS v4, PostgreSQL, Prisma, and Auth.js.
- [x] Confirm one initial role: Super Admin for authorized Flexbox members.
- [x] Confirm editorial public directory without search/filter.
- [x] Confirm advanced privacy-conscious analytics.
- [x] Confirm published-only public preview behavior.
- [x] Inspect current local PostgreSQL setup and terminal output.
- [x] Normalize documentation locations and reconcile cross-document consistency.
- [x] Review and approve PRD, architecture, stack, roadmap, agent rules, and file structure.
- [x] Decide Auth.js provider/session strategy (Credentials + JWT, NextAuth v4).
- [x] Decide media storage strategy (local filesystem in development, S3-compatible in production).
- [ ] Verify final domain, email, social URLs, and public copy.

**Exit criteria:** all decisions affecting foundations are recorded and approved.

Phase 0 status: complete for all foundation-affecting decisions. Verification of real public domains, contact addresses, social destinations, and final copy remains open on purpose — those are content decisions, not engineering blockers, and no values may be invented. They must be settled before the public page ships in Phase 2.

## Phase 1 — Local Environment and Project Foundation

**Goal:** Create a reproducible Next.js development environment on the developer workstation.

Tasks:
- [x] Verify Docker Desktop is running and PostgreSQL container is healthy.
- [x] Verify Node.js LTS and pnpm versions.
- [x] Create the Next.js App Router project with TypeScript and Tailwind CSS v4.
- [x] Add `.gitignore`, `.env.example`, local environment setup, and package scripts.
- [x] Keep `.env.local` out of Git.
- [x] Add Prisma using a single stable major version and its matching configuration (Prisma 7.10.1, `prisma7.config.ts`).
- [x] Configure Prisma to connect to local PostgreSQL on host port `5433`.
- [x] Create a minimal initial migration and test database connectivity.
- [x] Add lint, typecheck, test, and build scripts.
- [x] Document repeatable setup and reset instructions.

**Exit criteria:** the app starts locally, PostgreSQL is healthy, Prisma can migrate/query local data, and the production build passes.

Phase 1 status: **complete and verified.** See `.docs/LOCAL_DEVELOPMENT.md` for the exact commands and recorded results.

## Phase 2 — Public User Page

**Goal:** Implement the public microsite from the approved visual direction.

Tasks:
- [x] Establish design tokens, typography, color palette, and reusable UI primitives.
- [x] Build responsive header/navigation.
- [x] Build compact hero section.
- [x] Build editorial category/link directory with no search/filter/counter.
- [x] Build link cards and safe external navigation.
- [x] Build contact CTA and footer.
- [x] Add SEO and social sharing metadata.
- [x] Implement public data loading with published/active records only.
- [x] Verify mobile, tablet, desktop, keyboard, reduced motion, and contrast.

**Exit criteria:** public page renders correctly from database content and has no draft leakage.

Phase 2 status: **complete.** All page, design, responsive, accessibility, metadata, and verification work is done and recorded in `.docs/PUBLIC_PAGE.md`. The database-backed data loading carry-over was completed in Phase 3.

Deliberate carry-over into Phase 3 (Content Database and CMS Foundation):

- Public data came from the typed configuration in `src/features/public/content.ts` during Phase 2. It was replaced in Phase 3 by the database-backed content service, so "Public data loading with published/active records only" is now satisfied and checked.
- Phase 2 content contained no drafts, archived records, or private admin data, so no draft leakage was possible in that state; the published-only query rule is verified in Phase 3.

Content items still awaiting owner confirmation before public release:

- Real destinations for Flexbox Design System, Flexbox Lab, Website Flexbox, Sumber Daya, Karya Digital, and Eksperimen Visual. They render as non-interactive "Segera" cards until then. Since Phase 3 they are stored as `EXTERNAL`-eligible rows with `destinationType = NONE`, so unblocking them is a data change, not a code change.
- The public contact channel. The contact section shows a status label while the `contact.contactEmail` site setting is `null`; setting a verified address enables the contact call-to-action.
- Final production domain, which blocks the canonical URL, `metadataBase`, Open Graph image, and sitemap.

Open design-verification items (Figma was not reachable from the local browser during Phase 2, returning an edge access error):

- Exact Figma frame selection, spacing values, decorative elements, and mobile-specific adaptation.
- The hero copy variant. The implementation uses "IDE FLEKSIBEL. KARYA NYATA." from the owner's screenshot, not the earlier "EVERYTHING IN ONE PLACE." brief reference.
- Verified only against `.docs/Desain.md` and the owner's supplied screenshot description.


## Phase 3 — Content Database and CMS Foundation

**Goal:** Build the database-backed content layer.

Tasks:
- [x] Design and review Prisma schema for categories, links, settings, media metadata, admin identity, and audit logs.
  - Categories, links, typed site settings, and media metadata are implemented. Admin identity and audit logs are deliberately deferred to Phases 4 and 5 (see `.docs/DATABASE_SCHEMA.md`).
- [x] Add migrations and development seed data.
- [x] Implement typed data-access/service functions.
- [x] Implement server-side validation for link/category/settings data.
- [x] Implement link publication state transitions.
- [x] Implement category ordering and link ordering.
- [x] Add tests for public filtering and publication rules.
- [ ] Verify final domain, email, and social destinations before public release.

**Exit criteria:** public content is database-driven and content lifecycle rules are tested.

Phase 3 status: **complete.** The public page loads published, active content from PostgreSQL through `src/features/content`. Six destinations and the public contact channel remain unconfirmed and are still rendered as non-interactive states; resolving them is an owner content decision, not missing engineering work.

## Phase 4 — Authentication and Authorization

**Goal:** Restrict the CMS to approved Flexbox members.

Recorded strategy: Auth.js / NextAuth v4 Credentials provider with JWT sessions. Provisioning is internal; Argon2id password hashing; server-side authorization on every protected read and mutation. Full implementation notes, threat model, and verification evidence are in `.docs/AUTH_SECURITY.md`.

Tasks:
- [x] Choose Auth.js provider and session strategy (Credentials + JWT, NextAuth v4).
- [x] Implement invitation/allowlist provisioning.
  - CLI-only in this phase: `pnpm admin:bootstrap`, `pnpm admin:invite`, `pnpm admin:accept-invite`, `pnpm admin:set-status`, `pnpm admin:cleanup`. Screens belong to Phase 5.
- [x] Implement Super Admin account status and role checks.
  - `resolveAuthorizedAdmin()` requires an `ACTIVE` `SUPER_ADMIN` row whose `auth_version` matches the JWT's `av`.
- [x] Protect admin layouts, route handlers, server actions, and data services.
  - `requireAdmin`, `requireSuperAdmin`, and `requireAdminAction` in `src/lib/auth/session.ts`; `src/proxy.ts` is an optimistic gate only.
- [x] Implement logout and approved account recovery flow.
  - Sign-out, signed-in password change, and single-use 60-minute reset tokens delivered through the development file mail transport.
- [x] Add login rate limiting and secure cookie configuration.
  - Database-backed `ACCOUNT` and `SOURCE` buckets; `httpOnly`, `sameSite=lax`, host-prefixed cookies, `secure` derived from the canonical URL.
- [ ] Add MFA if supported by the selected provider/workflow.
  - Deferred: the Credentials provider in NextAuth v4 has no built-in second factor and no authenticator workflow was approved for this phase. Recorded as a known limitation with compensating controls.
- [x] Test unauthorized, inactive, expired-session, and valid-admin scenarios.
  - Integration tests plus manual HTTP verification against `next start`; results recorded in `.docs/AUTH_SECURITY.md`.

**Exit criteria:** no unapproved account can read or mutate CMS data, even when calling endpoints directly.

Phase 4 status: **complete.** 15 test files / 156 tests pass, lint and typecheck are clean, the production build succeeds, and the sign-in, sign-out, throttling, disabled-account, and foreign-redirect paths were verified against a running server. No CMS screen, no multi-factor authentication, no production mail provider, and no deployment were implemented.

## Phase 5 — Full CMS

**Goal:** Enable content and website administration without code changes.

Tasks:
- [x] Build admin shell and navigation.
- [x] Build dashboard overview.
- [x] Build link CRUD, reorder, publish, unpublish, archive, restore, and delete flows.
- [x] Build category management.
- [x] Build website settings for branding, hero, contact, social, footer, and SEO.
- [x] Build media library and validated upload flow.
- [x] Build account provisioning/management for Super Admins.
- [x] Build audit logs.
- [x] Add published-site view (no draft preview route in the initial requirement).
- [x] Add empty, loading, success, and error states.

**Exit criteria:** an authorized Super Admin can manage all public content without source-code changes.

Phase 5 status: **complete and verified locally.** The protected CMS includes content, settings, media, administrator, audit-log, and system-status screens. Server-side authorization is enforced for protected reads and mutations. Media uploads use content validation and reference protection. Verification: `pnpm test` (23 files / 244 tests), `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.

## Phase 6 — Advanced Analytics

**Goal:** Collect privacy-conscious events and provide useful reporting.

Tasks:
- [x] Finalize event definitions and metric formulas (`.docs/ANALYTICS_SPECIFICATION.md`).
- [x] Implement page-view and link-click collection.
- [x] Implement safe link-ID-based tracking and redirect.
- [x] Normalize device, browser, OS, and referrer categories.
- [x] Exclude admin activity and known bot traffic where feasible.
- [x] Implement date filters and timezone handling.
- [x] Build traffic trend charts.
- [x] Build per-link click and popularity reports.
- [x] Build device, browser, and OS breakdowns.
- [x] Build CSV export.
- [x] Implement retention and aggregation policy.
- [x] Test analytics failure behavior and ensure navigation still works.

**Exit criteria:** dashboard metrics have documented definitions and reconcile with event data within expected limitations.

Phase 6 status: **complete and verified locally.** Metric definitions, identifiers, deduplication, and known limitations are documented in `.docs/ANALYTICS_SPECIFICATION.md`; the privacy model is in `.docs/ANALYTICS_PRIVACY.md`; configuration, secret rotation, retention cleanup, reconciliation, health signals, and incident playbooks are in `.docs/ANALYTICS_OPERATIONS.md`. The CMS dashboard (`/admin`) renders the same `getAnalyticsReport()` figures as `/admin/analytics` for the documented default window, and every state — collection disabled, no events in range, or live metrics — is shown explicitly instead of an estimated number. No raw IP address, raw User-Agent, referrer URL, email, token, or fingerprint is stored; tracking failures never block public rendering, and `/go/[linkId]` resolves its destination from PostgreSQL.

Verification record (2026-11-16, Windows host, local PostgreSQL, dev server on `http://localhost:3000`):

- Analytics journey (`.local-storage/qa-analytics-journey.ts`, executed through `src/features/analytics/cli/run.ts`): the dashboard analytics block rendered before and after collection; `/admin/analytics` rendered and accepted the `7d` preset; the public page-view beacon returned `204`; `/go/<linkId>` returned `opaqueredirect` with a server-resolved destination; PostgreSQL recorded `PAGE_VIEW=4` and `LINK_CLICK=1`; the report listed the recorded click. The temporary administrator and temporary link were deleted afterwards; the recorded events remain as local data.
- `pnpm qa:visual`: 7 viewports (320–1440 px), no horizontal overflow, one `h1`, expected heading and body fonts, `consoleErrors: []`, `failedRequests: []`.
- `pnpm qa:a11y`: no unnamed links, no contrast failures, no undersized touch targets, one `h1`, complete landmarks, visible focus outlines, every internal anchor resolves, 200% zoom has no overflow or clipped text, reduced motion respected.
- `pnpm test`: 27 files / 286 tests passed.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`: passed.

Known limitations are recorded rather than hidden: bot detection is a heuristic, unique visitors are a per-browser estimate, and blocked clients cost an event, not a visit. `pnpm qa:visual` and `pnpm qa:a11y` cover the public page only; the authenticated analytics screens were verified by the journey above. Cache Components logs one dev-only blocking-route diagnostic for protected segments, which is intentional (`instant = false` in `src/app/admin/(protected)/layout.tsx`).

## Phase 7 — Quality, Security, and Release Readiness

**Goal:** Verify operational and security requirements.

Tasks:
- [x] Unit and integration tests for content, auth, settings, analytics, and permissions — 28 files / 303 tests.
- [x] End-to-end tests for public and admin journeys — public journey automated (`pnpm qa:e2e`); admin journey verified manually, automation deferred because no test credential is provisioned.
- [x] Test input validation, XSS, CSRF, open redirects, brute-force protection, and upload validation — covered by unit/integration tests plus `SECURITY_REVIEW.md`.
- [x] Test backup and database restore — `pnpm db:backup` + `pnpm db:restore:verify`, executed.
- [ ] Test media restore or object-storage recovery — blocked: S3 is configured in Phase 8.
- [x] Review secrets, environment variables, logs, and production headers — headers probed live; secret scan clean; `pnpm config:check` added.
- [x] Verify responsive layout and accessibility — 7 viewports, zoom, contrast, anchors, reduced motion.
- [x] Load-test representative page and analytics endpoints — 100-request loopback smoke baseline; repeat on staging.
- [x] Document release and rollback procedures — `PRODUCTION_CONFIGURATION.md`, `DATABASE_BACKUP_RECOVERY.md`.

**Exit criteria:** all critical acceptance checks pass and known limitations are documented.

**Status: complete — READY WITH DOCUMENTED LIMITATIONS.** See `.docs/RELEASE_READINESS.md`.

## Phase 8 — VPS Deployment and Production

**Goal:** Run Flexbox Linktree on Flexbox-owned infrastructure.

Tasks:
- [ ] Prepare VPS, operating system updates, firewall, and SSH key access.
- [ ] Install/configure Coolify.
- [ ] Configure deployment from GitHub.
- [ ] Configure production environment variables and secrets.
- [ ] Deploy PostgreSQL with persistent volume and private networking.
- [ ] Configure application domain and HTTPS.
- [ ] Configure media storage.
- [ ] Configure off-site backup and monitoring.
- [ ] Apply production migrations using deployment migration command.
- [ ] Provision the first Super Admin securely.
- [ ] Verify smoke tests and recovery procedures.

**Exit criteria:** public site and admin work over HTTPS, database is private, backups are external, and an operational owner is assigned.

## Post-Launch Improvements

Potential follow-up work, only after observing real usage:
- Scheduled analytics reports.
- Additional admin roles.
- More granular audit-log search.
- Media transformation/optimization pipeline.
- Better bot detection and analytics aggregation.
- Separate database server when VPS resource usage justifies it.
- Redis or a queue if background tasks or event volume demand it.
- Multi-server deployment and disaster recovery improvements.

## Progress Summary

| Phase | Status |
|---|---|
| Phase 0 — Product and Documentation Baseline | Complete |
| Phase 1 — Local Environment and Project Foundation | Complete |
| Phase 2 — Public User Page | Complete |
| Phase 3 — Content Database and CMS Foundation | Complete |
| Phase 4 — Authentication and Authorization | Complete |
| Phase 5 — Full CMS | Complete |
| Phase 6 — Advanced Analytics | Complete |
| Phase 7 — Quality, Security, and Release Readiness | Complete — READY WITH DOCUMENTED LIMITATIONS |
| Phase 8 — VPS Deployment and Production | Not started |

## Release Gates

A phase is not complete merely because the code exists. It must satisfy its exit criteria, tests, and documentation. Keep production deployment separate from routine local development.

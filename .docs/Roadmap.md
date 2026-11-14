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
- [ ] Establish design tokens, typography, color palette, and reusable UI primitives.
- [ ] Build responsive header/navigation.
- [ ] Build compact hero section.
- [ ] Build editorial category/link directory with no search/filter/counter.
- [ ] Build link cards and safe external navigation.
- [ ] Build contact CTA and footer.
- [ ] Add SEO and social sharing metadata.
- [ ] Implement public data loading with published/active records only.
- [ ] Verify mobile, tablet, desktop, keyboard, reduced motion, and contrast.

**Exit criteria:** public page renders correctly from database content and has no draft leakage.

Note: final public domain, email, social destinations, and copy must be confirmed before this phase ships. Removing the Phase 1 placeholder page is part of this phase.

## Phase 3 — Content Database and CMS Foundation

**Goal:** Build the database-backed content layer.

Tasks:
- [ ] Design and review Prisma schema for categories, links, settings, media metadata, admin identity, and audit logs.
- [ ] Add migrations and development seed data.
- [ ] Implement typed data-access/service functions.
- [ ] Implement server-side validation for link/category/settings data.
- [ ] Implement link publication state transitions.
- [ ] Implement category ordering and link ordering.
- [ ] Add tests for public filtering and publication rules.

**Exit criteria:** public content is database-driven and content lifecycle rules are tested.

## Phase 4 — Authentication and Authorization

**Goal:** Restrict the CMS to approved Flexbox members.

Recorded strategy: Auth.js / NextAuth v4 Credentials provider with JWT sessions. Provisioning is internal; Argon2id password hashing; server-side authorization on every protected read and mutation.

Tasks:
- [x] Choose Auth.js provider and session strategy (Credential + JWT, NextAuth v4).
- [ ] Implement invitation/allowlist provisioning.
- [ ] Implement Super Admin account status and role checks.
- [ ] Protect admin layouts, route handlers, server actions, and data services.
- [ ] Implement logout and approved account recovery flow.
- [ ] Add login rate limiting and secure cookie configuration.
- [ ] Add MFA if supported by the selected provider/workflow.
- [ ] Test unauthorized, inactive, expired-session, and valid-admin scenarios.

**Exit criteria:** no unapproved account can read or mutate CMS data, even when calling endpoints directly.

## Phase 5 — Full CMS

**Goal:** Enable content and website administration without code changes.

Tasks:
- [ ] Build admin shell and navigation.
- [ ] Build dashboard overview.
- [ ] Build link CRUD, reorder, publish, unpublish, archive, restore, and delete flows.
- [ ] Build category management.
- [ ] Build website settings for branding, hero, contact, social, footer, and SEO.
- [ ] Build media library and validated upload flow.
- [ ] Build account provisioning/management for Super Admins.
- [ ] Build audit logs.
- [ ] Add published-site view (no draft preview route in the initial requirement).
- [ ] Add empty, loading, success, and error states.

**Exit criteria:** an authorized Super Admin can manage all public content without source-code changes.

## Phase 6 — Advanced Analytics

**Goal:** Collect privacy-conscious events and provide useful reporting.

Tasks:
- [ ] Finalize event definitions and metric formulas.
- [ ] Implement page-view and link-click collection.
- [ ] Implement safe link-ID-based tracking and redirect.
- [ ] Normalize device, browser, OS, and referrer categories.
- [ ] Exclude admin activity and known bot traffic where feasible.
- [ ] Implement date filters and timezone handling.
- [ ] Build traffic trend charts.
- [ ] Build per-link click and popularity reports.
- [ ] Build device, browser, and OS breakdowns.
- [ ] Build CSV export.
- [ ] Implement retention and aggregation policy.
- [ ] Test analytics failure behavior and ensure navigation still works.

**Exit criteria:** dashboard metrics have documented definitions and reconcile with event data within expected limitations.

## Phase 7 — Quality, Security, and Release Readiness

**Goal:** Verify operational and security requirements.

Tasks:
- [ ] Unit and integration tests for content, auth, settings, analytics, and permissions.
- [ ] End-to-end tests for public and admin journeys.
- [ ] Test input validation, XSS, CSRF, open redirects, brute-force protection, and upload validation.
- [ ] Test backup and database restore.
- [ ] Test media restore or object-storage recovery.
- [ ] Review secrets, environment variables, logs, and production headers.
- [ ] Verify responsive layout and accessibility.
- [ ] Load-test representative page and analytics endpoints.
- [ ] Document release and rollback procedures.

**Exit criteria:** all critical acceptance checks pass and known limitations are documented.

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
| Phase 2 — Public User Page | Not started |
| Phase 3 — Content Database and CMS Foundation | Not started |
| Phase 4 — Authentication and Authorization | Not started |
| Phase 5 — Full CMS | Not started |
| Phase 6 — Advanced Analytics | Not started |
| Phase 7 — Quality, Security, and Release Readiness | Not started |
| Phase 8 — VPS Deployment and Production | Not started |

## Release Gates

A phase is not complete merely because the code exists. It must satisfy its exit criteria, tests, and documentation. Keep production deployment separate from routine local development.

# Agent Instructions — Flexbox Linktree

These instructions apply to AI coding assistants and human contributors working in this repository. Follow the latest approved product decisions and preserve existing user changes.

## 1. Read Before Making Changes

Before implementation, read:
1. `.flexbox-docs/PRD.md` — product scope and acceptance criteria.
2. `.flexbox-docs/Architecture.md` — application boundaries and data flow.
3. `.flexbox-docs/Tech-Stack.md` — selected technologies and compatibility rules.
4. `.flexbox-docs/Structure_File.md` — intended repository organization.
5. `.flexbox-docs/Roadmap.md` — current phase and exit criteria.
6. `.flexbox-docs/Desain.md` — visual direction for the public microsite.

The latest explicit project-owner instruction takes precedence. The approved PRD and Architecture documents extend the earlier visual design brief to include a private CMS, authentication, PostgreSQL, and analytics. The visual principles in `Desain.md` remain authoritative for the public User Page.

## 2. Product Boundaries

- Treat the product as two connected experiences: Public User Page and private Admin CMS.
- Keep the public page an editorial microsite, not a dashboard.
- Do not add public search, category filter chips, pagination, or result counters unless explicitly requested.
- The initial admin role is `SUPER_ADMIN` only.
- Only active, explicitly allowlisted Flexbox members may access protected admin functions.
- Public visitors must never receive draft, archived, unpublished, or private admin data.
- All public content intended to be edited by the team must be manageable through the CMS without source-code changes.
- Do not invent URLs, email addresses, social accounts, studio claims, or other public content.

## 3. Technical Standards

- Use Next.js App Router, TypeScript, Tailwind CSS v4, PostgreSQL, Prisma ORM, and Auth.js.
- Use pnpm as the package manager and commit `pnpm-lock.yaml`.
- Use stable, mutually compatible dependency releases. Do not adopt a release candidate for production without explicit approval.
- Follow the documentation for the exact installed Prisma major version. Prisma major versions may differ in config files, generated-client paths, and driver-adapter requirements.
- Use Server Components by default; add Client Components only where interactivity requires them.
- Keep the application a modular monolith until a measured need justifies splitting services.
- Validate all untrusted input on the server. Zod is the preferred validation library unless the owner chooses another.
- Reuse existing project conventions before introducing a new dependency or abstraction.

## 4. Authentication and Authorization Rules

- There is no public registration.
- Authentication is not equivalent to authorization. A valid Auth.js session alone does not grant CMS access.
- Check the active Flexbox allowlist and `SUPER_ADMIN` role on the server for every protected read and mutation.
- Do not rely only on client-side checks or route redirects.
- Never expose password hashes, session tokens, OAuth secrets, `AUTH_SECRET`, or database credentials.
- Do not assume Auth.js Credentials Provider persists users through an adapter or supports database sessions. Confirm the provider/session design before implementing authentication.
- Keep login, invitation, and recovery endpoints rate-limited.

## 5. Database and Migration Rules

- PostgreSQL is the application database for this project.
- Prisma schema belongs in `prisma/schema.prisma`; migrations belong in `prisma/migrations/`.
- Use `prisma migrate dev` only against local development databases.
- Use `prisma migrate deploy` for controlled staging/production releases.
- Never run destructive reset or development migration commands against production.
- Review migration SQL and data impact before release.
- Preserve analytics history when links/categories are archived or deleted; use deliberate nullable references or snapshots.
- Do not expose PostgreSQL publicly in production.

## 6. Analytics and Privacy Rules

- Collect only information needed for approved metrics.
- Do not persist raw IP addresses or use device fingerprinting.
- Normalize device, browser, operating-system, and referrer categories.
- Exclude administrator traffic and known bots where feasible.
- Store event timestamps in UTC; report using `Asia/Jakarta` by default.
- Apply a documented raw-event retention policy; the initial target is 90 days, subject to privacy review.
- Analytics failures must not prevent visitors from opening a link.
- Tracking redirects must resolve a published link ID server-side; never redirect to an arbitrary client-provided URL.

## 7. Media and Content Safety

- Validate upload size and actual file content type; do not trust extensions alone.
- Keep production media in persistent storage or object storage, not an ephemeral application container.
- Sanitize content and escape output appropriately.
- Do not allow arbitrary script, HTML execution, or arbitrary CSS through CMS settings.
- Restrict link URL schemes to approved protocols.
- Require confirmation for destructive actions.

## 8. Environment and Secrets

- Maintain separate local, test, staging, and production configuration.
- `.env.local` and all real secret files must be ignored by Git.
- `.env.example` may contain variable names and non-secret placeholders only.
- Never copy local credentials into staging or production.
- Never use `NEXT_PUBLIC_` for secrets.
- Keep Compose-only variables separate: Docker Compose automatically reads `.env` by default, not `.env.local`.
- Do not commit production data dumps or uploaded user/media files.

## 9. Development Workflow

1. Inspect the relevant files before editing.
2. Identify the current roadmap phase and scope of the task.
3. Implement the smallest coherent change that satisfies the requirement.
4. Add or update tests for behavior that changes.
5. Run relevant formatting, lint, type checking, tests, and production build.
6. Report exactly which checks ran and their results; do not claim tests passed if they were not executed.
7. Update documentation when an approved product or technical decision changes.
8. Do not run a second development server if one is already active.
9. Do not overwrite, discard, or reformat unrelated user changes.
10. Do not deploy to production, alter remote infrastructure, or perform destructive database actions without explicit authorization.

## 10. Initial Local Setup Facts

At the time these documents were prepared, the repository contains `.docs/Desain.md`, `.flexbox/LogoFlexBox.png`, and `LICENSE`, plus local untracked setup files shown by the owner. It does not yet contain a Next.js `package.json` or Prisma dependency.

The owner's pasted terminal output confirms:
- Docker initially could not connect because the Docker Desktop Linux engine was not running.
- After Docker Desktop started, `docker compose up -d postgres` succeeded.
- The local PostgreSQL container became healthy on host binding `127.0.0.1:5433` to container port `5432`.
- pnpm was installed globally and `pnpm -v` returned `12.18.0`.
- Prisma commands failed because Prisma is not installed in a project yet; the repository has no `package.json`.
- `pnpm dev` failed because no `dev` script exists before the Next.js project is created.

Do not treat these expected pre-project errors as PostgreSQL failures. Continue with project scaffolding, dependency installation, and Prisma setup after protecting local secrets.

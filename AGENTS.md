# Agent Instructions — Flexbox Linktree

These instructions apply to AI coding assistants and human contributors working in this repository. Follow the latest approved product decisions and preserve existing user changes.

## 1. Read Before Making Changes

Before implementation, read:

1. `.docs/PRD.md` — product scope and acceptance criteria (authoritative functional scope).
2. `.docs/Architecture.md` — application boundaries, data flow, and recorded decisions.
3. `.docs/Tech-Stack.md` — selected technologies, versions, and compatibility rules.
4. `.docs/Structure_File.md` — intended repository organization.
5. `.docs/Roadmap.md` — current phase and exit criteria.
6. `.docs/Desain.md` — visual direction for the public microsite.
7. `.docs/LOCAL_DEVELOPMENT.md` — repeatable Windows local setup.

The latest explicit project-owner instruction takes precedence. The approved PRD and Architecture documents extend the earlier visual design brief to include a private CMS, authentication, PostgreSQL, and analytics. The visual principles in `.docs/Desain.md` remain authoritative for the public User Page.

`.docs/Desain.md` is intentionally kept in its original Indonesian form and is not rewritten by tooling. Where it describes an earlier Vite/React single-page prototype, the approved Next.js stack in `.docs/Tech-Stack.md` supersedes the implementation details; its visual, typography, color, and accessibility rules still apply to the public page.

## 2. Product Boundaries

- Treat the product as two connected experiences: Public User Page and private Admin CMS.
- Keep the public page an editorial microsite, not a dashboard.
- Do not add public search, category filter chips, pagination, or result counters unless explicitly requested.
- The initial admin role is `SUPER_ADMIN` only.
- Only active, explicitly allowlisted Flexbox members may access protected admin functions.
- Public visitors must never receive draft, archived, unpublished, or private admin data.
- All public content intended to be edited by the team must be manageable through the CMS without source-code changes.
- Do not invent URLs, email addresses, social accounts, studio claims, or other public content.
- Public preview shows published content only. Do not add a draft preview route in the initial scope.

## 3. Technical Standards

- Use Next.js App Router, TypeScript, Tailwind CSS v4, PostgreSQL, Prisma ORM, and Auth.js.
- Use pnpm as the package manager and commit `pnpm-lock.yaml`.
- Use stable, mutually compatible dependency releases. Do not adopt a release candidate, beta, canary, or experimental build for production without explicit approval.
- Follow the documentation for the exact installed Prisma major version. Prisma major versions differ in config filenames, generated-client paths, and driver-adapter requirements. This repository uses Prisma 7; its CLI reads `prisma7.config.ts`.
- Use Server Components by default; add Client Components only where interactivity requires them.
- Keep the application a modular monolith until a measured need justifies splitting services.
- Validate all untrusted input on the server. Zod is the preferred validation library unless the owner chooses another.
- Reuse existing project conventions before introducing a new dependency or abstraction.
- Keep project Node.js and pnpm versions aligned with `.nvmrc`, `package.json` `engines`, and the `packageManager` field.

## 4. Authentication and Authorization Rules

- There is no public registration.
- Authentication is not equivalent to authorization. A valid Auth.js session alone does not grant CMS access.
- Check the active Flexbox allowlist and `SUPER_ADMIN` role on the server for every protected read and mutation.
- Do not rely only on client-side checks or route redirects.
- Never expose password hashes, session tokens, OAuth secrets, `AUTH_SECRET`, or database credentials.
- The approved strategy is the Auth.js Credentials provider with JWT sessions. Auth.js does not persist Credentials users through an adapter and does not create database sessions for them. Account lookup, password verification, rate limiting, and provisioning are application responsibilities.
- Hash passwords with Argon2id. Never store or log plaintext passwords.
- Keep login, invitation, and recovery endpoints rate-limited.

## 5. Database and Migration Rules

- PostgreSQL is the application database for this project.
- Prisma schema belongs in `prisma/schema.prisma`; migrations belong in `prisma/migrations/`; CLI configuration belongs in `prisma7.config.ts`.
- Use `prisma migrate dev` only against local development databases.
- Use `prisma migrate deploy` for controlled staging/production releases.
- Never run destructive reset or development migration commands against production.
- Review migration SQL and data impact before release.
- Preserve analytics history when links/categories are archived or deleted; use deliberate nullable references or snapshots.
- Do not expose PostgreSQL publicly in production.
- Prisma 7 uses a driver adapter (`@prisma/adapter-pg` with the `pg` driver) at runtime. Do not fall back to Prisma 5/6 connection patterns.

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
- Use the storage abstraction in `src/lib/storage/`; do not call a provider SDK directly from CMS code.
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
- Prisma CLI does not auto-load Next.js env files; `prisma7.config.ts` loads `.env.local` explicitly for local commands.
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

## 10. Local Setup Facts

- Repository path used by the owner: `D:\Kiandra Gagah\Projek Gabut\flexbox-linktree`.
- Local Node.js: v26.13.0 (Active LTS, codename "Lithium").
- Local npm: 11.20.0. Local pnpm: 12.18.0.
- Docker: 29.8.2, Docker Compose v5.5.1.
- Local PostgreSQL container: `flexbox-linktree-db`, image `postgres:17-alpine`, host binding `127.0.0.1:5433` to container port `5432`, database `flexbox_linktree_dev`, user `flexbox`.
- The app runs directly on the Windows host; only PostgreSQL runs in Docker.
- Local secrets live only in `.env.local`, which is ignored by Git.

See `.docs/LOCAL_DEVELOPMENT.md` for the exact commands.

## 11. Next.js Agent Rules

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# Technology Stack

**Project:** Flexbox Linktree  
**Status:** Selected baseline with clearly marked recommendations  
**Language:** English

## 1. Selected Core Stack

| Layer | Technology | Status | Responsibility |
|---|---|---|---|
| Web framework | Next.js 16.4.6 App Router | Selected | Public site, admin CMS, server rendering, route handlers |
| Language | TypeScript 5.9.3 (strict mode) | Selected | Type-safe application code |
| UI library | React 19.3.0 (managed by Next.js) | Selected | Component model |
| Styling | Tailwind CSS v4.3.3 | Selected | Utility-first styling and design tokens |
| Database | PostgreSQL 17 (`postgres:17-alpine` locally) | Selected | Persistent application and analytics data |
| ORM | Prisma ORM 7.10.1 | Selected | Schema, queries, and migrations |
| PostgreSQL driver | `pg` + `@prisma/adapter-pg` 7.10.1 | Required by Prisma 7 | Runtime database adapter |
| Authentication | Auth.js / NextAuth 4.24.15 Credentials provider, JWT sessions | Selected | Internal sign-in and session integration |
| Password hashing (auth phase) | Argon2id (`argon2`) | Selected | Password storage and verification |
| Package manager | pnpm 12.18.0 | Selected | Dependency management and scripts |
| Container | Docker 29.8.2 / Compose 5.5.1 locally | Selected | Local PostgreSQL |
| VPS deployment | Coolify | Planned, not implemented | Future application deployment and service management |

Version policy is validated against official package compatibility metadata and documentation checked during Phase 0: Next.js 16.4.6 requires Node.js >=20.9.0 and supports React 19. Prisma 7.10.1's install scripts explicitly support Node.js 20.19+, 22.12+, and 24+. The project uses the current Active LTS Node.js 26.13.0 (codename Lithium); Next.js supports it and Prisma CLI was successfully run on it. The `.nvmrc` file and `package.json` engines pin the Node 26 major. Node 24 is an officially supported Prisma alternative; do not downgrade the owner's machine automatically.

pnpm is pinned at `12.18.0` through the `packageManager` field in `package.json`, with Corepack as the optional version activation mechanism. Use exact dependency versions and commit `pnpm-lock.yaml`. `package.json` `engines` declares the supported Node range. Do not copy version numbers from old tutorials without checking compatibility between framework, Node.js, Prisma, Auth.js, Tailwind CSS, and the deployment runtime. Review release notes before upgrades.

## 2. Core Technology Notes

### 2.1 Next.js App Router

Use the App Router. Keep public pages fast and mostly server-rendered. Use Server Components by default and Client Components only when interactivity requires them. Use route handlers for narrow server endpoints such as analytics click tracking, uploads, and webhooks.

### 2.2 Tailwind CSS v4

Use Tailwind CSS v4 according to its current Next.js integration. Do not add Tailwind v3 configuration patterns unless a verified compatibility requirement makes them necessary. Define brand tokens and global base styles centrally.

In this repository Tailwind v4 is wired through `@tailwindcss/turbopack` (declared in `next.config.ts`) and a single `@import "tailwindcss";` in `src/app/globals.css`. There is no `tailwind.config.js` and no legacy PostCSS pipeline. Brand tokens from `.docs/Desain.md` are declared in an `@theme` block in `globals.css`.

### 2.3 PostgreSQL

PostgreSQL is the primary and only required database for this product. The Flexbox VPS may host MySQL, MariaDB, and MongoDB for other projects later, but Flexbox Linktree must not depend on those engines.

### 2.4 Prisma ORM

Use Prisma for typed database access and schema migrations. Keep schema in `prisma/schema.prisma` and committed migrations in `prisma/migrations/`. Use development migration commands only against local/staging development databases. Use deployment migrations for staging/production.

Prisma major versions may change configuration and driver-adapter requirements. Select one stable major version and follow its matching documentation consistently. Do not mix setup examples from different Prisma major versions.

This repository uses **Prisma 7.10.1**:

- The CLI configuration file is `prisma7.config.ts`. Prisma 7's CLI resolves that versioned filename.
- Prisma does not auto-load `.env` or `.env.local`; `prisma7.config.ts` loads `.env.local` with `dotenv` so the CLI and the application target the same local database.
- The `prisma-client` generator emits into `src/generated/prisma`, which is git-ignored. Run `pnpm db:generate` after cloning or changing the schema.
- Runtime access requires the `@prisma/adapter-pg` driver adapter with the `pg` driver. There is no implicit direct connection from the generated client.
- Do not apply Prisma 5/6 `prisma.config.ts`, `env()` helper, or implicit-engine examples to this project.

### 2.5 Auth.js / NextAuth

**Selected implementation:** Auth.js / NextAuth Credentials provider with JWT sessions, using the stable NextAuth v4 release line compatible with Next.js 16. The small internal admin team will be provisioned explicitly; no OAuth provider credentials or external identity system are prerequisites.

Auth.js Credentials does not automatically persist users through the Prisma adapter and requires JWT sessions. The application must own the admin allowlist, account provisioning, account lookup, Argon2id password verification, rate limiting, and per-request active `SUPER_ADMIN` authorization checks. The Prisma adapter is not used for Credentials authentication. No public sign-up is provided.

OAuth with a Prisma adapter and database sessions remains an option for a later phase if the team selects a managed identity provider. Do not implement a fake provider or request credentials during foundation work.

### 2.6 Validation

**Recommended:** Zod for server-side validation of admin forms, API inputs, settings, links, and environment variables. Client-side validation is for user experience; server-side validation is mandatory.

### 2.7 Testing and Code Quality

Implemented in this repository:

- ESLint (`pnpm lint`, `eslint .` with flat config, generated Prisma output ignored).
- TypeScript compiler check (`pnpm typecheck`, `tsc --noEmit`, strict mode).
- Vitest (`pnpm test`, `vitest run`, unit tests under `tests/unit`).
- `next build` (`pnpm build`).

Planned for later phases: Playwright for browser-based end-to-end tests, one consistent formatter, and Zod wiring for server-side input validation. Zod is not installed in Phase 1; it is added when the first server-validated form exists.

Add tooling intentionally and document every script in `package.json`.

## 3. Local Development Stack

| Component | Local implementation |
|---|---|
| Operating system | Windows |
| Editor | VS Code |
| Shell | PowerShell |
| Node.js | 26.x Active LTS (`.nvmrc`), floor 24 |
| Package manager | pnpm 12.18.0 (pinned in `package.json`) |
| Next.js dev server | Runs directly on Windows host |
| PostgreSQL | Docker Desktop / WSL2 container |
| Host database port | `127.0.0.1:5433` |
| Container database port | `5432` |
| Local app URL | `http://localhost:3000` |

The currently prepared local PostgreSQL container uses `postgres:17-alpine`, database `flexbox_linktree_dev`, user `flexbox`, and host mapping `127.0.0.1:5433:5432`. This is a development configuration, not a production secret or production topology.

## 4. Environment Variables

Current committed template (`.env.example`):

```dotenv
DATABASE_URL="postgresql://flexbox:dev-only-password@localhost:5433/flexbox_linktree_dev?schema=public"
AUTH_SECRET="replace-with-a-unique-locally-generated-secret"
```

`AUTH_URL` is not required for the current local setup. Auth.js v4 derives the URL from the request in development; add an explicit `AUTH_URL` only when the deployment topology requires it.

Add storage credentials only after the production media-storage provider is selected. Add no OAuth provider variables under the recorded Credentials strategy.

Rules:
- `.env.local` must be ignored by Git.
- `.env.example` contains names and safe placeholders only.
- Never use local credentials in staging or production.
- Never put secrets in `NEXT_PUBLIC_*` variables.
- Do not reuse `AUTH_SECRET` across environments.
- Docker Compose reads `.env` automatically by default, not `.env.local`; keep Compose variables separate or explicit.
- Prisma CLI reads `.env.local` through `prisma7.config.ts`.

## 5. Production Stack

Initial deployment target:
- Flexbox-managed Linux VPS.
- Coolify for service/application deployment.
- Next.js application container.
- PostgreSQL service/container with persistent volume.
- HTTPS reverse proxy managed by the deployment platform.
- External backup destination.
- Persistent or S3-compatible object storage for uploaded media.

Do not expose PostgreSQL publicly. Keep the database on an internal Docker network and allow administrative access only through a secure tunnel or controlled network path.

## 6. Media Storage

Use a storage abstraction so CMS business logic is independent of the storage provider.

- **Local development (selected):** local filesystem under the ignored `storage/uploads/` directory. This requires no external credentials and persists across application restarts. It is not a production storage location.
- **Production (selected direction):** S3-compatible object storage with independent backups and a documented lifecycle policy. The concrete provider, endpoint, bucket, region, and credentials remain deployment decisions.
- Keep file metadata and storage keys in PostgreSQL; keep binary files outside the database by default.
- Validate upload size and actual content type; never trust extensions alone.
- Do not store production uploads only in an ephemeral application container.

No storage provider credentials are required during Phase 0 or Phase 1.

## 7. Analytics

Implement first-party event collection in the application. PostgreSQL stores normalized event records and daily aggregates. Do not introduce a separate analytics SaaS or analytics database in the first release unless volume or product requirements justify it.

Privacy baseline:
- No raw IP persistence.
- No fingerprinting.
- Normalized device/browser/OS families.
- Limited first-party session identifier.
- Admin traffic excluded.
- 90-day initial raw event retention target, subject to privacy review.

## 8. Explicitly Out of Scope for the Initial Product

- MySQL, MariaDB, or MongoDB as Flexbox Linktree's application database.
- Microservices.
- Kubernetes.
- Redis or a message broker before there is a measured need.
- A data warehouse or ClickHouse before event volume requires it.
- A public multi-tenant SaaS architecture.
- An arbitrary visual page builder.

## 9. Version and Dependency Policy

- Use stable, mutually compatible releases.
- Pin the Node.js major and package versions through project metadata and lockfile.
- Do not use release candidates for production dependencies.
- Review framework/ORM migration notes before major upgrades.
- Avoid dependencies that duplicate existing platform capabilities.
- Keep dependency updates small and test them before deployment.

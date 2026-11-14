# Technology Stack

**Project:** Flexbox Linktree  
**Status:** Selected baseline with clearly marked recommendations  
**Language:** English

## 1. Selected Core Stack

| Layer | Technology | Status | Responsibility |
|---|---|---|---|
| Web framework | Next.js App Router | Selected | Public site, admin CMS, server rendering, route handlers |
| Language | TypeScript | Selected | Type-safe application code |
| UI library | React (managed by Next.js) | Required by framework | Component model |
| Styling | Tailwind CSS v4 | Selected | Utility-first styling and design tokens |
| Database | PostgreSQL | Selected | Persistent application and analytics data |
| ORM | Prisma ORM | Selected | Schema, queries, and migrations |
| Authentication | Auth.js / NextAuth | Selected | Sign-in and session integration |
| Package manager | pnpm | Selected for local setup | Dependency management and scripts |
| Container | Docker / Docker Compose | Selected | Local PostgreSQL and deployment packaging |
| VPS deployment | Coolify | Planned | Application deployment and service management |

Use supported stable releases at project bootstrap. Do not copy version numbers from old tutorials without checking compatibility between Next.js, Node.js, Prisma, Auth.js, Tailwind CSS, and deployment runtime. Commit the lockfile and use the same Node.js major version in local and production environments.

## 2. Core Technology Notes

### 2.1 Next.js App Router

Use the App Router. Keep public pages fast and mostly server-rendered. Use Server Components by default and Client Components only when interactivity requires them. Use route handlers for narrow server endpoints such as analytics click tracking, uploads, and webhooks.

### 2.2 Tailwind CSS v4

Use Tailwind CSS v4 according to its current Next.js integration. Do not add Tailwind v3 configuration patterns unless a verified compatibility requirement makes them necessary. Define brand tokens and global base styles centrally.

### 2.3 PostgreSQL

PostgreSQL is the primary and only required database for this product. The Flexbox VPS may host MySQL, MariaDB, and MongoDB for other projects later, but Flexbox Linktree must not depend on those engines.

### 2.4 Prisma ORM

Use Prisma for typed database access and schema migrations. Keep schema in `prisma/schema.prisma` and committed migrations in `prisma/migrations/`. Use development migration commands only against local/staging development databases. Use deployment migrations for staging/production.

Prisma major versions may change configuration and driver-adapter requirements. Select one stable major version and follow its matching documentation consistently. Do not mix setup examples from different Prisma major versions.

### 2.5 Auth.js / NextAuth

Auth.js is the selected authentication integration. The provider and session strategy remain an implementation decision that must be closed before authentication is coded:

- OAuth/email provider + Prisma adapter: can use database-backed sessions where supported.
- Credentials provider: application must verify credentials and provision users; Auth.js Credentials uses JWT sessions. It does not automatically persist credentials users through the adapter.

No public sign-up. Enforce an allowlist of active Flexbox members and the `SUPER_ADMIN` application role on the server.

### 2.6 Validation

**Recommended:** Zod for server-side validation of admin forms, API inputs, settings, links, and environment variables. Client-side validation is for user experience; server-side validation is mandatory.

### 2.7 Testing and Code Quality

Recommended baseline:
- ESLint for static linting.
- TypeScript compiler checks (`tsc --noEmit`).
- Vitest for unit/integration tests where suitable.
- Playwright for browser-based end-to-end tests.
- Prettier or the selected formatter, with one consistent formatting convention.

These are recommendations; add them intentionally and document their scripts in `package.json`.

## 3. Local Development Stack

| Component | Local implementation |
|---|---|
| Operating system | Windows |
| Editor | VS Code |
| Shell | PowerShell |
| Node.js | Supported LTS release, same major as production |
| Package manager | pnpm |
| Next.js dev server | Runs directly on Windows host |
| PostgreSQL | Docker Desktop / WSL2 container |
| Host database port | `127.0.0.1:5433` |
| Container database port | `5432` |
| Local app URL | `http://localhost:3000` |

The currently prepared local PostgreSQL container uses `postgres:17-alpine`, database `flexbox_linktree_dev`, user `flexbox`, and host mapping `127.0.0.1:5433:5432`. This is a development configuration, not a production secret or production topology.

## 4. Environment Variables

Expected variables will evolve as providers are selected. Start with:

```dotenv
DATABASE_URL="postgresql://flexbox:LOCAL_PASSWORD@localhost:5433/flexbox_linktree_dev?schema=public"
AUTH_SECRET="GENERATE_A_UNIQUE_LOCAL_SECRET"
AUTH_URL="http://localhost:3000"
```

Add OAuth provider credentials only when an OAuth provider is chosen. Add storage credentials only after the production media-storage provider is selected.

Rules:
- `.env.local` must be ignored by Git.
- `.env.example` contains names and safe placeholders only.
- Never use local credentials in staging or production.
- Never put secrets in `NEXT_PUBLIC_*` variables.
- Do not reuse `AUTH_SECRET` across environments.
- Docker Compose reads `.env` automatically by default, not `.env.local`; keep Compose variables separate or explicit.

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

The CMS needs a media abstraction. Local development may use a local persistent directory or a compatible development service. Production storage provider is not yet selected. Prefer S3-compatible object storage or another persistent storage service with independent backup. Do not rely on an ephemeral container filesystem for uploaded production files.

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

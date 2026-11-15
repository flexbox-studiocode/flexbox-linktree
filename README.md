# Flexbox Linktree

Flexbox Linktree (also described as the Flexbox Studio Digital Hub) is the digital directory and microsite for Flexbox Studio.

The product has two connected experiences built on one content system:

1. **Public User Page** — a lightweight, editorial, mobile-first directory of the studio's projects, resources, portfolio, community destinations, and contact channels.
2. **Private Admin CMS** — a protected content-management application for authorized Flexbox members.

The public experience is deliberately a microsite, not an application dashboard.

## Status

**Phase 4 — Authentication and Authorization** is complete: the admin area requires an explicitly provisioned Flexbox Super Admin, verified with Argon2id credentials, and every protected read and mutation re-authorizes against the database. Phase 3 (database-backed content), Phase 2 (public microsite), and Phase 1 (local environment) remain in place.

Implemented at this point:

- Next.js App Router application with TypeScript (strict) and Tailwind CSS v4.
- Public Flexbox Studio Digital Hub: header, hero, editorial directory with eight curated cards, contact call-to-action, and **blue** graphite footer.
- Safe destination handling through `src/lib/utils/url.ts`; unconfirmed destinations render as non-interactive "Segera" cards rather than invented links.
- PostgreSQL content schema (`categories`, `links`, `site_settings`, `media_assets`) with enums, foreign keys, CHECK constraints, and indexes.
- Typed content layer in `src/features/content`: Zod validation, server-only repositories, DTO mappers, and cached services. The public route reads published, active records only.
- Administrator identity schema (`admin_users`, `admin_invitations`, `password_reset_tokens`, `admin_rate_limits`, `security_events`) with additive migrations.
- Credentials sign-in at `/admin/login` using Auth.js v4 with JWT sessions, Argon2id password hashes, and database-backed login throttling.
- Internal provisioning only: bootstrap, invitation, invitation acceptance, status, and cleanup CLIs. No public registration.
- Server-side authorization for protected pages, Server Actions, and data services, with immediate revocation through `authVersion`.
- Sign-out, signed-in password change, forgot-password, and reset-password flows; the development mail transport writes to `.local-storage/mail/` and refuses to run in production.
- Idempotent development seed in `prisma/seed-data.ts`, applied with `pnpm db:seed`.
- Self-hosted Anton (display) and Manrope (body fallback) through `next/font`.
- Page metadata, favicon, and `/robots.txt`.
- Local PostgreSQL 17 running in Docker, connected through Prisma 7 with the `pg` driver adapter.
- Lint, typecheck, unit + database integration tests, production build, and browser QA scripts.

Not implemented yet (later roadmap phases):

- CMS dashboard, link/category/settings/media screens, and content CRUD (Phase 5). `/admin` is an authenticated placeholder.
- Multi-factor authentication and a production transactional mail provider.
- Analytics collection and reporting (Phase 6).
- Production deployment, Coolify, and staging infrastructure (Phase 8).

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
| `.docs/PUBLIC_PAGE.md` | Public page sections, content model, destination policy, and QA commands. |
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
| `pnpm db:generate` | Generate Prisma Client. |
| `pnpm db:validate` | Validate the Prisma schema. |
| `pnpm db:migrate` | Create/apply a development migration (local database only). |
| `pnpm db:migrate:deploy` | Apply committed migrations (staging/production safe). |
| `pnpm db:seed` | Upsert the development content dataset (idempotent). |
| `pnpm db:studio` | Open Prisma Studio. |
| `pnpm db:check` | Run the local Prisma connectivity check. |
| `pnpm admin:bootstrap` | Create the first Super Admin (requires `ADMIN_BOOTSTRAP_ENABLED=true`). |
| `pnpm admin:invite` | Issue a single-use invitation for an approved member. |
| `pnpm admin:accept-invite` | Activate an invited account with a password from stdin. |
| `pnpm admin:set-status` | Suspend, disable, or reactivate an administrator account. |
| `pnpm admin:cleanup` | Delete expired reset tokens and stale throttle rows. |

## Security Notes

- `.env.local` and all real secrets are ignored by Git. Only `.env.example` with placeholders is committed.
- The local PostgreSQL port is bound to `127.0.0.1` only.
- `docker compose down -v` deletes the local database volume. Do not run it unless you intend to lose local data.
- No production infrastructure, deployment, or credentials are part of this repository state.

## License

See `LICENSE`.
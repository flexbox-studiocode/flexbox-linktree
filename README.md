# Flexbox Linktree

Flexbox Linktree (also described as the Flexbox Studio Digital Hub) is the digital directory and microsite for Flexbox Studio.

The product has two connected experiences built on one content system:

1. **Public User Page** — a lightweight, editorial, mobile-first directory of the studio's projects, resources, portfolio, community destinations, and contact channels.
2. **Private Admin CMS** — a protected content-management application for authorized Flexbox members.

The public experience is deliberately a microsite, not an application dashboard.

## Status

**Phase 1 — Local Environment and Project Foundation** is the current implementation phase.

Implemented at this point:

- Next.js App Router application with TypeScript (strict) and Tailwind CSS v4.
- Local PostgreSQL 17 running in Docker, connected through Prisma 7 with the `pg` driver adapter.
- Initial `SystemCheck` migration and a Prisma-backed connectivity check.
- Lint, typecheck, unit test, and production build scripts.

Not implemented yet (later roadmap phases):

- Public microsite UI, link cards, and editorial directory.
- Admin dashboard, login UI, and authentication flow.
- Link/category/settings/media CMS features.
- Analytics collection and reporting.
- Production deployment, Coolify, and staging infrastructure.

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
| Authentication (planned) | Auth.js / NextAuth Credentials provider, JWT sessions |
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
# then set DATABASE_URL and a locally generated AUTH_SECRET

# 4. Apply migrations and generate the Prisma client
pnpm db:migrate:deploy
pnpm db:generate

# 5. Start the app
pnpm dev
```

Open `http://localhost:3000`.

Full Windows instructions, environment-variable rules, database commands, reset guidance, and troubleshooting live in `.docs/LOCAL_DEVELOPMENT.md`.

## Repository Documentation

| Document | Purpose |
|---|---|
| `.docs/PRD.md` | Product requirements; authoritative functional scope. |
| `.docs/Architecture.md` | System boundaries, data flow, security, and recorded decisions. |
| `.docs/Tech-Stack.md` | Selected technologies, versions, and compatibility policy. |
| `.docs/Structure_File.md` | Repository layout and conventions. |
| `.docs/Roadmap.md` | Phases and measurable exit criteria. |
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
| `pnpm test` | Vitest unit tests. |
| `pnpm db:generate` | Generate Prisma Client. |
| `pnpm db:validate` | Validate the Prisma schema. |
| `pnpm db:migrate` | Create/apply a development migration. |
| `pnpm db:migrate:deploy` | Apply committed migrations (staging/production safe). |
| `pnpm db:studio` | Open Prisma Studio. |
| `pnpm db:check` | Run the local Prisma connectivity check. |

## Security Notes

- `.env.local` and all real secrets are ignored by Git. Only `.env.example` with placeholders is committed.
- The local PostgreSQL port is bound to `127.0.0.1` only.
- `docker compose down -v` deletes the local database volume. Do not run it unless you intend to lose local data.
- No production infrastructure, deployment, or credentials are part of this repository state.

## License

See `LICENSE`.
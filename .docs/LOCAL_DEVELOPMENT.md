# Local Development Guide

**Project:** Flexbox Linktree
**Environment:** Windows + VS Code + PowerShell + Docker Desktop
**Status:** Verified against the Phase 1 implementation

This guide describes the setup that actually exists in this repository. If a command here does not work, treat the document as wrong and fix it in the same change.

## 1. Required Software

| Tool | Verified local version | Purpose |
|---|---|---|
| Node.js | v26.13.0 (Active LTS, "Lithium") | Application runtime |
| npm | 11.20.0 | Bootstrapping only |
| pnpm | 12.18.0 | Package manager and scripts |
| Docker | 29.8.2 | Container runtime |
| Docker Compose | v5.5.1 | Local PostgreSQL orchestration |
| Git | any current version | Version control |
| VS Code | any current version | Editor |
| PowerShell | 7.x or Windows PowerShell 5.1 | Shell |

PostgreSQL does not need to be installed on the host. It runs in Docker.

## 2. Node.js and pnpm Version Policy

- Project Node.js major: **26** (declared in `.nvmrc`).
- Supported floor: **24**. Next.js requires >= 20.9.0. Prisma 7 install scripts list Node 20.19+, 22.12+, and 24+; Node 26 is the current Active LTS and was verified working with the Prisma 7.10.1 CLI.
- pnpm is pinned to `12.18.0` through the `packageManager` field in `package.json`.
- `package.json` `engines` declares the supported Node range.

Do not downgrade or change the machine-wide Node.js or pnpm installation to match the project. If a future dependency genuinely rejects Node 26, record the finding in `.docs/Tech-Stack.md` and decide it explicitly instead of silently switching versions.

Optional, in a per-project shell only:

```powershell
# If Corepack is enabled on the machine:
corepack enable
corepack prepare pnpm@12.18.0 --activate

# If nvm-windows or fnm is installed:
fnm use        # reads .nvmrc
```

## 3. Docker Desktop and WSL2 Checks

```powershell
docker --version
docker compose version
docker info --format '{{.OSType}}'   # expect: linux
```

If Docker returns `dockerDesktopLinuxEngine` errors, open Docker Desktop, wait for the Linux engine to finish starting, and retry. WSL2 must be enabled; run `wsl --status` and confirm a WSL 2 default version.

## 4. Local PostgreSQL

The committed `docker-compose.yml` defines exactly one service:

| Setting | Value |
|---|---|
| Service | `postgres` |
| Container | `flexbox-linktree-db` |
| Image | `postgres:17-alpine` |
| Host binding | `127.0.0.1:5433` |
| Container port | `5432` |
| Database | `flexbox_linktree_dev` |
| User | `flexbox` |
| Password | `dev-only-password` (development only) |
| Volume | `flexbox_linktree_pgdata` |

The password above is a local development placeholder, not a production credential. The host binding is loopback-only; do not change it to `0.0.0.0`.

Commands:

```powershell
# Start (creates the container and volume on first run)
docker compose up -d postgres

# Status and health
docker compose ps

# Logs
docker compose logs -f postgres

# Stop but keep data
docker compose stop postgres

# Start a stopped container
docker compose start postgres
```

Expected healthy state:

```text
NAME                  IMAGE               STATUS                    PORTS
flexbox-linktree-db   postgres:17-alpine  Up (healthy)              127.0.0.1:5433->5432/tcp
```

> **Warning:** `docker compose down -v` permanently deletes the `flexbox_linktree_pgdata` volume and all local data. Use `docker compose stop` or `docker compose down` (without `-v`) for normal shutdown.

## 5. Environment Variables

`.env.local` is the local Next.js configuration file. It is ignored by Git and must never be committed.

Create it from the committed template:

```powershell
Copy-Item .env.example .env.local
```

Required variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for local development |
| `AUTH_SECRET` | Session-signing secret; locally generated, unique per environment |

Local `DATABASE_URL` value:

```dotenv
DATABASE_URL="postgresql://flexbox:dev-only-password@localhost:5433/flexbox_linktree_dev?schema=public"
```

Generate a local `AUTH_SECRET` without printing it into a shared log:

```powershell
node -e "const fs=require('fs');const c=require('crypto');const v=c.randomBytes(32).toString('base64url');const p='.env.local';let t=fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';t=t.replace(/^AUTH_SECRET=.*$/m,'')+ '\nAUTH_SECRET=\"'+v+'\"\n';fs.writeFileSync(p,t);console.log('AUTH_SECRET written to .env.local');"
```

Never paste the real secret into chat, documentation, screenshots, issues, or commits.

### Prisma and environment files

Prisma 7 does not automatically load Next.js environment files. `prisma7.config.ts` loads `.env.local` explicitly, so Prisma CLI commands and `prisma/check.ts` use the same local database as the application. Keep it that way; do not point Prisma at a `.env` file with different credentials.

### Docker Compose and environment files

Docker Compose reads `.env` automatically and does **not** read `.env.local`. The committed Compose file uses explicit development values, so no `.env` file is required locally. If you later move these values into `.env`, keep the password identical to `DATABASE_URL`.

## 6. Install and Run the Application

```powershell
pnpm install
pnpm db:migrate:deploy
pnpm db:generate
pnpm dev
```

Open <http://localhost:3000>. Do not start a second development server if one is already running on port 3000.

## 7. Prisma Workflow

| Task | Command |
|---|---|
| Validate the schema | `pnpm db:validate` |
| Generate the client | `pnpm db:generate` |
| Create and apply a development migration | `pnpm db:migrate --name <migration_name>` |
| Apply committed migrations | `pnpm db:migrate:deploy` |
| Inspect data | `pnpm db:studio` |
| Verify database connectivity | `pnpm db:check` |

Notes:

- Prisma 7 configuration lives in `prisma7.config.ts`.
- The generator emits `prisma-client` output into `src/generated/prisma`, which is git-ignored. Regenerate after cloning or after schema changes.
- `prisma migrate dev` is destructive by nature (it can reset the database when drift is detected). Use it only against the local container.
- The initial migration is `prisma/migrations/<timestamp>_init` and creates the `SystemCheck` table.

## 8. Quality Checks

```powershell
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit, strict mode
pnpm test         # Vitest unit tests
pnpm build        # Production build
```

Run all four before committing an application change. Report exactly which ran and their results.

## 9. Safe Database Reset

Prefer migrations over destructive reset. If the local database is genuinely disposable and you want a clean rebuild:

```powershell
# Option A: drop and recreate the schema through Prisma (local only)
pnpm exec prisma migrate reset --force

# Option B: recreate the container and volume (deletes all local data)
docker compose down          # keeps the volume
docker volume rm flexbox_linktree_pgdata
docker compose up -d postgres
pnpm db:migrate:deploy
```

`prisma migrate reset` and `docker volume rm` are destructive. Never run either against staging or production. Never run `docker compose down -v` on a machine whose local data you still need.

## 10. Daily Workflow

```powershell
# 1. Ensure the database is up
docker compose up -d postgres
docker compose ps

# 2. Work
pnpm dev

# 3. Before committing
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 11. Troubleshooting

### `dockerDesktopLinuxEngine` connection error
Start Docker Desktop and wait for the Linux engine. Retry `docker compose up -d postgres`.

### PostgreSQL container is not healthy
Check `docker compose ps` and `docker compose logs postgres`. Confirm port `5433` is free and that the health check user/database match the Compose environment.

### `ERR_PNPM_IGNORED_BUILDS` after installing Prisma
pnpm 12 blocks dependency build scripts by default. `pnpm-workspace.yaml` allowlists the Prisma build scripts. If a new native dependency is added, add its exact package name to `allowBuilds` after reviewing what its script does. Do not disable the policy globally.

### Prisma warns "Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+"
That is the Prisma installer's advisory message. Node 26 is newer than every listed floor and the Prisma 7.10.1 CLI runs correctly on it. This is a message-only warning; it is not an error and does not block `validate`, `generate`, or `migrate`.

### `Command "prisma" not found`
Prisma is a project dependency. Run `pnpm install` first, then use `pnpm exec prisma ...` or the `db:*` scripts. Never install Prisma globally.

### `Command "dev" not found`
`package.json` and the `dev` script must exist. If this appears, you are in the wrong directory.

### Database connection refused
Confirm Docker is running, the container is healthy, the host port is `5433`, and `DATABASE_URL` uses `localhost:5433`. Remember Prisma reads `.env.local`, not `.env`.

### `P1000` authentication failed
The password in `DATABASE_URL` differs from the Compose `POSTGRES_PASSWORD`. Changing the Compose password does not change an existing volume's role password; recreate the volume if you intentionally changed it.

### Tailwind classes have no effect
Tailwind v4 is integrated through `@tailwindcss/turbopack` in `next.config.ts` and `@import "tailwindcss";` in `src/app/globals.css`. Do not add a Tailwind v3 `tailwind.config.js` or a legacy PostCSS pipeline.

### `pnpm` not recognized
Reopen the terminal or VS Code so the npm global bin directory is reloaded into `PATH`.

## 12. Known Local Characteristics

- The application runs on the Windows host; only PostgreSQL runs in Docker.
- The repository path used by the owner is `D:\Kiandra Gagah\Projek Gabut\flexbox-linktree`.
- A Git push memory workaround was applied historically. Do not re-apply buffer changes unless the same failure recurs.
- Prisma's installer prints a Node support advisory on this machine. It is cosmetic; record it rather than changing the installed Node.js.

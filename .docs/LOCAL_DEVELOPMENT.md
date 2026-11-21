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

- Deployment Node.js major: **24** (declared in `.nvmrc`). The owner's local
  machine currently uses Node.js 26.13.0, which is above the supported floor
  and remains valid for local development.
- Supported floor: **24**. Next.js requires >= 20.9.0. Prisma 7 install scripts
  list Node 20.19+, 22.12+, and 24+; both Node 24 and the owner's local Node 26
  were verified with the Prisma 7.10.1 CLI.
- pnpm is pinned to `12.18.0` through the `packageManager` field in `package.json`.
- `package.json` `engines` declares the supported Node range.

Do not downgrade or change the machine-wide Node.js or pnpm installation to
match the deployment target. If a future dependency genuinely rejects Node 24
or Node 26, record the finding in `.docs/Tech-Stack.md` and decide it explicitly
instead of silently switching versions.

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

Required variables for the application and authentication flow:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for local development |
| `NEXTAUTH_URL` | Canonical local origin used by Auth.js and reset links |
| `NEXTAUTH_SECRET` | JWT/session-signing secret; locally generated, unique per environment |
| `RATE_LIMIT_SECRET` | Dedicated HMAC key for source throttle buckets; different from the session secret |

Optional development controls:

| Variable | Purpose |
|---|---|
| `TRUST_PROXY_HEADERS` | Keep `false` locally; enable only behind a trusted proxy |
| `ADMIN_MAIL_TRANSPORT` | Set `file` to write recovery mail under `.local-storage/mail/` |
| `ADMIN_BOOTSTRAP_ENABLED` | Temporarily set `true` for the one-time first-admin CLI |
| `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_NAME` | Identity values consumed by the bootstrap CLI |
| `MEDIA_STORAGE_DRIVER` | Keep the default `local` for development; production requires `s3` |
| `MEDIA_LOCAL_ROOT`, `MEDIA_LOCAL_PUBLIC_URL` | Optional overrides for the local media directory and public base URL |

Local `DATABASE_URL` value:

```dotenv
DATABASE_URL="postgresql://flexbox:dev-only-password@localhost:5433/flexbox_linktree_dev?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-unique-locally-generated-session-secret"
RATE_LIMIT_SECRET="replace-with-a-different-unique-locally-generated-rate-limit-secret"
TRUST_PROXY_HEADERS="false"
ADMIN_MAIL_TRANSPORT="file"
```

Generate local secrets without printing them into a shared log:

```powershell
node -e "const fs=require('fs');const c=require('crypto');const p='.env.local';let t=fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';t=t.replace(/^NEXTAUTH_SECRET=.*$/m,'').replace(/^RATE_LIMIT_SECRET=.*$/m,'')+'\nNEXTAUTH_SECRET=\"'+c.randomBytes(32).toString('base64url')+'\"\nRATE_LIMIT_SECRET=\"'+c.randomBytes(32).toString('base64url')+'\"\n';fs.writeFileSync(p,t);console.log('Authentication secrets written to .env.local');"
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
| Seed the development content | `pnpm db:seed` |
| Inspect data | `pnpm db:studio` |
| Verify database connectivity | `pnpm db:check` |

Notes:

- Prisma 7 configuration lives in `prisma7.config.ts`.
- The generator emits `prisma-client` output into `src/generated/prisma`, which is git-ignored. Regenerate after cloning or after schema changes.
- `prisma migrate dev` is destructive by nature (it can reset the database when drift is detected). Use it only against the local container.
- Committed migrations: `prisma/migrations/<timestamp>_init` (creates `SystemCheck`) and `prisma/migrations/<timestamp>_add_content_cms_foundation` (creates the content domain plus its CHECK constraints).
- `pnpm db:seed` upserts the development dataset from `prisma/seed-data.ts`. It is idempotent: running it twice leaves 2 categories, 8 links, and 7 site settings, and it never deletes unrelated records.
- `prisma/seed.ts` is also wired as the Prisma `migrations.seed` command, so `prisma migrate dev`/`migrate reset` can invoke it automatically.

### Seeding after a schema change

```powershell
pnpm db:migrate:deploy
pnpm db:generate
pnpm db:seed
```

### Local backup before a risky schema change

```powershell
New-Item -ItemType Directory -Force -Path .local-storage\backups | Out-Null
docker exec flexbox-linktree-db pg_dump -U flexbox -d flexbox_linktree_dev -Fc -f /tmp/backup.dump
docker cp flexbox-linktree-db:/tmp/backup.dump .local-storage\backups\backup.dump
```

`.local-storage/` is git-ignored. Never commit a dump.

## 8. Quality Checks

```powershell
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit, strict mode
pnpm test         # Vitest unit + database integration tests
pnpm build        # Production build
```

`pnpm test` includes `tests/integration`, which needs the local PostgreSQL container to be running and migrated. Those tests are strictly additive and delete only the records they created. If `DATABASE_URL` is missing or does not point at a loopback host, the integration suite is skipped instead of running anywhere else.

Run all four before committing an application change. Report exactly which ran and their results.

## 9. Administrator Accounts (Phase 4)

There is no public registration. Accounts exist only through the operator CLIs. They load `.env.local` themselves through `tsx --env-file`, so they work without starting the app.

```powershell
# First Super Admin (one time). Requires ADMIN_BOOTSTRAP_ENABLED="true",
# plus ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_NAME in .env.local.
pnpm admin:bootstrap

# Additional member: issue a single-use invitation (72 hours).
pnpm admin:invite --email="member@example.test" --name="Flexbox Member"
# The token is printed exactly once. Deliver it privately, then:
$env:INVITATION_TOKEN = "the-token"
$env:INVITATION_PASSWORD = "a-strong-passphrase"
pnpm admin:accept-invite
Remove-Item Env:INVITATION_TOKEN, Env:INVITATION_PASSWORD

# Lifecycle
pnpm admin:set-status --email="member@example.test" --status=SUSPENDED   # or DISABLED / ACTIVE

# Housekeeping (expired reset tokens and stale throttle rows only)
pnpm admin:cleanup
```

Then sign in at <http://localhost:3000/admin/login>. Every CLI prints only account ids and addresses, never tokens or passwords beyond the single invitation token it is specifically designed to hand over.

Password recovery writes a JSON message with the reset link to `.local-storage/mail/` when `ADMIN_MAIL_TRANSPORT="file"` (the default outside production). Deleting that folder only removes local development mail. Never rely on this transport in staging or production.

Full security behaviour, threat model, and limits are recorded in `.docs/AUTH_SECURITY.md`.

## 9a. CMS and Media Storage (Phase 5)

After signing in, the CMS lives at <http://localhost:3000/admin>. Content, settings, media, administrator, audit-log, and system-status screens are all reachable from the admin navigation.

Media uploads use the local driver by default and are written to `.local-storage/uploads/`, which is git-ignored. You do not need to configure anything to try the upload flow locally. To point uploads elsewhere, set `MEDIA_LOCAL_ROOT`; to serve them through a custom base URL, set `MEDIA_LOCAL_PUBLIC_URL`.

```powershell
# Optional: confirm the local media directory after an upload
Get-ChildItem .local-storage\uploads -Recurse -File
```

Production must set `MEDIA_STORAGE_DRIVER="s3"` with the `S3_*` credentials; the local driver refuses to run in production unless `MEDIA_ALLOW_LOCAL_IN_PRODUCTION="true"`. See `.docs/ADMIN_CMS.md` for the full media and CMS reference.

## 10. Safe Database Reset

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

## 11. Daily Workflow

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

## 12. Troubleshooting

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

## 13. Known Local Characteristics

- The application runs on the Windows host; only PostgreSQL runs in Docker.
- The repository path used by the owner is `D:\Kiandra Gagah\Projek Gabut\flexbox-linktree`.
- A Git push memory workaround was applied historically. Do not re-apply buffer changes unless the same failure recurs.
- Prisma's installer prints a Node support advisory on this machine. It is cosmetic; record it rather than changing the installed Node.js.

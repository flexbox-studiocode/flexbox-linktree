# Local Development Guide

**Project:** Flexbox Linktree  
**Environment:** Windows + VS Code + PowerShell + Docker Desktop  
**Status:** Setup guide based on the owner's current local state

## 1. Current State Observed

The provided terminal log and VS Code screenshots show:

- Repository path: `D:\Kiandra Gagah\Projek Gabut\flexbox-linktree`.
- `.docs/Desain.md` exists.
- `.flexbox/LogoFlexBox.png` exists.
- `docker-compose.yml` has been created.
- `.env.local` has been created.
- PostgreSQL image `postgres:17-alpine` was pulled successfully.
- Container `flexbox-linktree-db` started and became `healthy`.
- Host port `127.0.0.1:5433` maps to PostgreSQL container port `5432`.
- pnpm was installed globally; `pnpm -v` returned `12.18.0`.
- The repository does not yet contain `package.json`, a Next.js app, or a local Prisma dependency.

Therefore, the `prisma` command-not-found and missing `dev` script errors are expected until the Next.js project and dependencies are created. They do not indicate that PostgreSQL is unhealthy.

## 2. Fix Local Secrets Before Continuing

The current `.env.local` screenshot shows:

```dotenv
DATABASE_URL="postgresql://flexbox:dev-only-password@localhost:5433/flexbox_linktree_dev?schema=public"
AUTH_SECRET="generate-a-local-secret"
```

The password is a development-only placeholder and the Auth secret is not yet a real secret. Generate a unique local secret after the application is scaffolded. One option is:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Copy the generated value into the local `.env.local` as `AUTH_SECRET`. Do not paste it into chat, documentation, screenshots, source code, or Git.

Ensure `.gitignore` includes:

```gitignore
.env
.env.*
!.env.example
node_modules/
.next/
coverage/
```

Check before committing:

```powershell
git status --short
```

If `.env.local` was ever staged, unstage it before committing:

```powershell
git restore --staged .env.local
```

If a real secret was ever committed or pushed, rotate it. Adding `.gitignore` does not remove a secret from Git history.

## 3. Docker PostgreSQL

The current Compose configuration is conceptually:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: flexbox-linktree-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: flexbox
      POSTGRES_PASSWORD: dev-only-password
      POSTGRES_DB: flexbox_linktree_dev
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - flexbox_linktree_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U flexbox -d flexbox_linktree_dev"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  flexbox_linktree_pgdata:
```

This matches the successful container state in the supplied log. Keep the host binding on `127.0.0.1`; do not change it to `0.0.0.0` for local development.

Commands:

```powershell
# Start Docker Desktop first, then:
docker compose up -d postgres

# Check status and health:
docker compose ps

# Follow database logs:
docker compose logs -f postgres

# Stop the container but retain database data:
docker compose stop postgres

# Start it again:
docker compose start postgres
```

Do not use `docker compose down -v` unless you intentionally want to delete the local database volume and all local database data.

## 4. Important `.env.local` vs Docker Compose Detail

Next.js reads `.env.local` for application runtime configuration. Docker Compose does not automatically use `.env.local` as its default interpolation file; by default it looks for `.env`.

The current Compose file uses explicit local-only PostgreSQL values, so this is fine for the first local setup. Keep the Compose password and the `DATABASE_URL` password identical. If moving Compose values into a `.env` file, create a separate ignored `.env` file for Compose and avoid duplicating secrets in committed files.

## 5. pnpm Status

The log confirms:

```powershell
pnpm -v
# 12.18.0
```

pnpm is already installed globally. Do not reinstall it just because Prisma is not found. `pnpm exec prisma` will only work after Prisma has been added to the project dependencies.

## 6. Create the Next.js Application

Before scaffolding, verify that the working tree is clean or that all uncommitted files are backed up. The repository contains existing `.docs`, `.flexbox`, and Docker files. Do not delete or overwrite them.

The official Next.js CLI creates a new application in a target directory. Because this repository is already non-empty, first inspect the CLI's current help and choose a safe approach. A conservative option is to create the app in a temporary sibling directory, then merge the generated application files into the repository while preserving `.docs`, `.flexbox`, `docker-compose.yml`, and `LICENSE`.

Example workflow:

```powershell
cd "D:\Kiandra Gagah\Projek Gabut"
pnpm create next-app@latest flexbox-linktree-app
```

Choose:
- TypeScript: Yes.
- Linter: ESLint (or the team's approved choice).
- React Compiler: decide deliberately; it is not required for the first release.
- Tailwind CSS: Yes, using the current Tailwind v4-compatible template.
- `src/` directory: Yes.
- App Router: Yes.
- Import alias: `@/*`.

Then review the generated files before moving/merging them into the existing `flexbox-linktree` repository. Do not replace the current Git repository metadata or existing documentation/assets.

An alternative is to use the CLI directly in the repository only after confirming the current `create-next-app` behavior for non-empty directories and backing up the existing files.

## 7. Add Prisma After Next.js Exists

Do not run Prisma commands before `package.json` and the app dependencies exist. Once the app has been created, follow the official setup guide for the chosen stable Prisma major version.

For Prisma 7, PostgreSQL direct connections use a driver adapter such as `@prisma/adapter-pg` with the `pg` driver, and the Prisma configuration file is part of the setup. Prisma 8 is the current release in the documentation checked for this guide; choose one stable major and follow its own instructions end-to-end. Do not combine Prisma 7 and Prisma 8 examples.

After dependencies and configuration are installed, verify:

```powershell
pnpm exec prisma --version
pnpm exec prisma validate
pnpm exec prisma migrate dev --name init
pnpm exec prisma generate
```

The exact commands/configuration may vary by the selected Prisma major. Follow that version's official docs and generated project files.

## 8. Start the Local Application

After the Next.js project exists and dependencies are installed:

```powershell
pnpm dev
```

Open:

```text
http://localhost:3000
```

The `pnpm dev` error in the supplied terminal log happened because there was no `package.json` or `dev` script yet. It should not be retried until the Next.js app exists.

## 9. Local Database Connection Details

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | `5433` |
| Database | `flexbox_linktree_dev` |
| Username | `flexbox` |
| Password | Local-only value in Compose |
| Container port | `5432` |

A database client such as DBeaver may connect using these values while the container is healthy.

## 10. Git Safety and Previous Push Error

The pasted log shows an initial Git push memory failure. After reducing Git pack memory/thread settings, the push succeeded and updated `main` from `96c7ea8` to `7a5c105`.

Do not repeat the successful push workaround unless the same issue happens again. Avoid increasing buffers or memory limits further without evidence. The two files marked `U` in the VS Code Explorer were untracked at the time of the screenshot; inspect `git status` and stage only intended files.

Recommended first commits after scaffolding:

```powershell
git status --short
git add .gitignore docker-compose.yml .env.example
# Add reviewed application files separately as appropriate
git diff --cached --stat
git commit -m "chore: initialize Next.js project foundation"
```

Never stage `.env.local`.

## 11. Daily Local Workflow

```powershell
# 1. Ensure Docker Desktop is running
docker compose up -d postgres

# 2. Check database health
docker compose ps

# 3. Start Next.js
pnpm dev

# 4. Before committing (once scripts exist)
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Only run scripts that actually exist in `package.json`. Add the scripts during project foundation.

## 12. Troubleshooting

### Docker cannot connect to `dockerDesktopLinuxEngine`

Start Docker Desktop and wait until its Linux engine is fully running. Then retry `docker compose up -d postgres`.

### PostgreSQL container is not healthy

Check `docker compose ps` and `docker compose logs postgres`. Verify the credentials/database in Compose and ensure port `5433` is not occupied.

### `pnpm` is not recognized

The uploaded log shows pnpm is already installed globally and available as version `12.18.0`. If a new terminal cannot find it, restart the terminal/VS Code and verify the npm global binary directory is in PATH.

### `Command "prisma" not found`

Expected before Prisma is added to the project. Create the Next.js project and install Prisma dependencies first; do not install Prisma globally as a workaround.

### `Command "dev" not found`

Expected before Next.js creates `package.json` and its `dev` script. Do not run `pnpm dev` until app scaffolding is complete.

### Database connection refused

Check that Docker is running, container is healthy, host port is `5433`, and `DATABASE_URL` uses `localhost:5433`.

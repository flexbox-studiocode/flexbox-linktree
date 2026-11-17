# PostgreSQL Backup and Recovery Runbook

Phase 7 — Milestone E. Applies to PostgreSQL 17 and the Prisma 7 schema in this
repository. Read all steps before acting on production.

## Safety rules

1. Never run `prisma migrate dev`, `prisma db push`, `docker compose down -v`,
   or `pg_restore --clean` against production.
2. Backups contain administrator identities, audit data, and analytics. Store
   them encrypted at rest with restricted operator access. Do not commit backup
   files; `backups/` ignores every file except its `.gitignore` marker.
3. Restore verification uses a **new isolated container**. It never writes to
   source DB.
4. Test restore each release and after each migration. Backup without tested
   restore is not recovery.

## Commands

| Command | Purpose |
|---|---|
| `pnpm db:backup` | Custom-format backup of local development DB. Refuses non-local URL. |
| `pnpm db:backup --production` | Backup a non-local DB after explicit operator confirmation. |
| `pnpm db:restore:verify` | Restore newest backup into isolated `postgres:17-alpine`, compare schema table set, counts, and Prisma migration ledger. |
| `pnpm db:restore:verify backups/db-…​.dump` | Verify an explicit dump. |
| `pnpm db:restore:verify --keep` | Keep isolated restore container for manual inspection; remove it afterwards. |
| `pnpm db:restore:verify --replace` | Remove a stale verification container before starting one. |

Environment:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | required | Source connection. `.env.local` is loaded for local commands. |
| `BACKUP_DIR` | `backups` | Destination directory. Must be encrypted/replicated outside a production host. |
| `BACKUP_KEEP` | `14` | Count of local `db-*.dump` files retained; oldest files are pruned only after successful backup. |
| `PG_DUMP_BIN` | unset | Explicit local `pg_dump` executable. |
| `BACKUP_CONTAINER` | `flexbox-linktree-db` | Docker container fallback when no local PostgreSQL client exists. |

Backup format is PostgreSQL custom (`pg_dump --format=custom`) with owners and
privileges excluded. It carries schema and data and supports selective restore.
Every backup gets a SHA-256 sidecar (`.dump.sha256`).

## Local run

```powershell
# Docker local DB must be healthy first.
docker compose up -d postgres
pnpm db:check

# Create and validate a backup without modifying development data.
pnpm db:backup
pnpm db:restore:verify
```

Verification binds only `127.0.0.1:5434`, uses temporary container
`flexbox-linktree-restore-db`, and removes it automatically. It compares all
`public` base tables, their row counts, and `_prisma_migrations` applied-count
plus latest migration name.

## Executed verification record

Date: 2026-11-17 (local Windows development environment)

```text
pnpm db:backup
→ db-2026-11-17T12-54-30-509Z.dump
→ 0.14 MiB
→ SHA-256 39c7dfe218f83673d699bc9ba8cd85bc292b88e609cbbb8ae6f10963d147e680

pnpm db:restore:verify
→ 14 public tables matched (including admin, analytics, content, security)
→ Prisma ledger: 10 applied, latest 20261115170000_add_admin_account_deleted_event
→ PASS — schema, tables, row counts, and migration ledger match
```

The exact dump name, size, and data counts change on future runs. Do not treat
these values as production capacity evidence.

## Production backup procedure

1. **Before window:** confirm database owner, deployment environment, backup
   location, encryption, retention, and restore operator. Ensure enough disk
   space for at least source DB size plus working buffer.
2. **Set protected environment:** export production `DATABASE_URL` only in a
   trusted operator shell or scheduler. Never put it in source control,
   terminal history, issue comments, or CI logs.
3. **Create backup:**

   ```powershell
   $env:BACKUP_DIR = "D:\secure-backups\flexbox-linktree"
   $env:BACKUP_KEEP = "14"
   pnpm db:backup --production
   ```

4. **Transfer:** copy dump and `.sha256` sidecar to an encrypted, access
   controlled off-host store. Verify checksum after transfer:

   ```powershell
   Get-FileHash D:\secure-backups\flexbox-linktree\db-*.dump -Algorithm SHA256
   ```

5. **Restore drill:** run `pnpm db:restore:verify <dump>` from an environment
   that can reach source DB and Docker. Do not use a production container as the
   verifier. Record output, duration, source size, checksum, operator, and
   result in release evidence.
6. **Retention:** keep at least 14 daily backups locally only as cache; durable
   retention belongs in encrypted off-host storage. Product owner must set
   production RPO/RTO before launch. Initial recommendation: daily full backup,
   30 daily copies, 12 monthly copies, quarterly restore drill.

## Incident recovery procedure

This is destructive. Obtain explicit incident commander approval and identify
correct target before executing.

1. Put app in maintenance mode at reverse proxy. Stop writers, schedulers,
   background tasks, and deployment jobs.
2. Preserve evidence: take a final backup/snapshot of damaged DB. Do not
   overwrite only copy.
3. Select backup by timestamp and checksum. Restore it first into an isolated
   database with `pnpm db:restore:verify <path>`.
4. Inspect restored data, migration ledger, and application health. Get incident
   commander approval to proceed.
5. Provision a **new empty** target database. Never use `--clean` or restore
   over an unknown live database.
6. Restore using a controlled shell, substituting secret values outside command
   history:

   ```powershell
   $env:PGPASSWORD = "<target password>"
   pg_restore --exit-on-error --no-owner --no-privileges `
     --host <target host> --port 5432 --username <target user> `
     --dbname <empty target database> <verified backup.dump>
   Remove-Item Env:PGPASSWORD
   ```

7. Deploy exact application release compatible with the backup schema. Run
   `pnpm db:migrate:deploy` only when migrating forward from the restored schema
   has been reviewed and approved.
8. Run `pnpm config:check` (after Milestone G), app health checks, admin login,
   public published-content query, `/go/[published-link-id]`, and analytics
   write/read checks. Compare row counts and `_prisma_migrations` with the
   verified drill.
9. Reopen traffic. Monitor DB errors, auth failures, redirect errors, and backup
   scheduler state. Write incident timeline and lessons learned.

## What this does not back up

PostgreSQL dump does not include object-storage media. Production must back up
S3-compatible media independently, preserve keys referenced by `media_assets`,
and test object restoration. Application configuration and secrets are also not
in the database; keep encrypted infrastructure-managed backups of production
configuration according to provider policy.
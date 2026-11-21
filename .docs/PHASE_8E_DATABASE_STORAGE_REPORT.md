# Phase 8E PostgreSQL and Persistent Storage Report

Status: **NOT YET DEPLOYED**

## PostgreSQL 17 readiness

The Coolify-managed PostgreSQL 17 resource now exists and is healthy. The
Coolify internal PostgreSQL 15 service remains separate and must not be reused.
The application database is not ready yet: read-only inspection found only the
default `postgres` database and `postgres` role.

Recommended Coolify resource:

- Database: `flexbox_linktree`
- Application user: `flexbox_app`
- Port: `5432`, private network only
- Persistent volume: Coolify-managed PostgreSQL volume
- Connection format:

  ```text
  postgresql://flexbox_app:<secret>@<internal-host>:5432/flexbox_linktree?schema=public
  ```

The password must be generated in Coolify and never placed in Git or chat.
Production migration is not authorized and was not run.

The target database `flexbox_linktree` and dedicated role `flexbox_app` still
need to be created through an approved Coolify/PostgreSQL administration flow.
No application schema or migration exists in this resource.

## Backup strategy

- PostgreSQL: custom-format `pg_dump` with SHA-256 sidecar.
- Local retention: 14 backups, restricted permissions.
- Media: separate archive from database dumps.
- Restore verification: isolated PostgreSQL 17 container.
- Same-VPS backups are not off-site protection; an encrypted off-host copy is
  still required when budget/process permits.

The repository runbook is `.docs/DATABASE_BACKUP_RECOVERY.md` and the backup
script is `scripts/db-backup.mjs`. No production backup was created.

## Persistent media

The host directory was created because it did not exist:

```text
/data/flexbox/media
mode: 0750
owner: root:root
filesystem: host root ext4
```

This is a persistent host path, not an ephemeral container filesystem, but it
is not yet mounted into an application container. Ownership must be adjusted to
the runtime UID/GID selected by Coolify after the application resource exists.

Required application values:

```text
MEDIA_STORAGE_DRIVER=local
MEDIA_LOCAL_ROOT=/data/flexbox/media
MEDIA_ALLOW_LOCAL_IN_PRODUCTION=true
```

No existing media was moved or deleted. Upload validation and traversal
protection were already verified by the code test suite.

The directory's read, write, and execute access checks passed for the current
root operator. A container write/read test is pending until Coolify supplies the
application container and runtime UID/GID; no temporary user file was left
behind by this audit.

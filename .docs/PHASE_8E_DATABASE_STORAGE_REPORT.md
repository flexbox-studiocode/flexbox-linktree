# Phase 8E PostgreSQL and Persistent Storage Report

Status: **NOT YET DEPLOYED**

## PostgreSQL 17 readiness

No production database was created. The only PostgreSQL container currently
running is Coolify's internal PostgreSQL 15 service and it must not be reused.

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

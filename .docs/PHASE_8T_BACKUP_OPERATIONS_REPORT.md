# Phase 8T — Backup Operations Report

## Status

- PASS — Existing production PostgreSQL backup checksum verified.
- PASS — Existing backup custom archive passed `pg_restore --list`.
- PASS — Fresh pre-migration production backup created at
  `/data/flexbox/backups/postgres/flexbox_linktree-pre-migration-20261121T082525Z.dump`,
  mode 0600, with SHA-256 verification and isolated PostgreSQL 17 restore.
- PASS — Staging baseline custom archive and SHA-256 sidecar created.
- OWNER ACTION REQUIRED — Local-only backups do not provide off-site disaster recovery.

Backups remain outside the repository with restricted permissions. No media or database backup was committed or uploaded externally.

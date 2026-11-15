# Admin CMS

**Project:** Flexbox Linktree  
**Scope:** Phase 5 — Full CMS  
**Language:** English

The Admin CMS is the private half of the product. It lets an authorized Flexbox Super Admin manage every piece of public content without touching source code, while the public microsite keeps reading only published, active records.

## 1. Access model

- There is no public registration and no self-service sign-up.
- The only supported role is `SUPER_ADMIN`.
- A valid Auth.js session is not enough: every protected page, Server Action, and data service re-reads the account and requires an `ACTIVE` `SUPER_ADMIN` row whose `authVersion` matches the token.
- Protected routes live under `src/app/admin/(protected)` behind `requireAdmin()`. Server Actions call `requireAdminAction()`; account management additionally calls `requireSuperAdmin()`. `src/proxy.ts` remains an optimistic gate only.
- Reusing the Phase 4 lifecycle means suspending or disabling an account increments `authVersion`, so existing sessions for that account stop working immediately.

## 2. Screens

| Route | Purpose |
| --- | --- |
| `/admin` | Dashboard: content, publication, media, and administrator counts plus quick actions. |
| `/admin/links`, `/admin/links/new`, `/admin/links/[id]` | Link list and editor: create, edit, reorder, activate, feature, publish, unpublish, archive, restore, and delete. |
| `/admin/categories`, `/admin/categories/new`, `/admin/categories/[id]` | Category list and editor: create, edit, reorder, activate, deactivate, and delete. Deleting a category with links requires reassigning them first. |
| `/admin/settings` | Typed website settings for branding, hero, contact, social, footer, and SEO. |
| `/admin/media` | Media library: validated upload, alt text editing, usage awareness, and reference-protected deletion. |
| `/admin/administrators` | Invite an administrator, revoke or reissue an invitation, and change account status. |
| `/admin/audit-logs` | Read-only audit trail combining authentication and CMS content events. |
| `/admin/system` | Read-only operational status for the database, storage driver, and required configuration. |
| `/admin/security` | Signed-in password change (from Phase 4). |

Shared admin UI lives in `src/components/admin/`; server logic lives in `src/features/admin/` and extends the Phase 3 content and media services.

## 3. Content workflow

- Status follows the Phase 3 publication lifecycle: `DRAFT`, `PUBLISHED`, `ARCHIVED`. Timestamps stay consistent with the status, and publishing records `publishedAt` while unpublishing clears it per the existing rules.
- A link is visible publicly only when `status = PUBLISHED`, the link is active, the owning category is active, and the destination is valid. Draft, archived, inactive, and inactive-category records never reach a public query.
- Reordering swaps adjacent records and persists the new sort order; it cannot cross the active/inactive boundary silently.
- Every mutation writes an audit event to `security_events` with the acting administrator and a safe metadata payload. It also invalidates the public `public-content` cache tag and revalidates `/`, so published edits appear without waiting for the cache window.
- There is no draft-preview route. The public site shows published content only.

## 4. Settings

Settings are stored one row per key in `site_settings` and validated by the Zod schema for that key before upsert. Unknown keys and invalid values are rejected server-side. Every accepted change records `SETTINGS_UPDATED`.

## 5. Media rules

- Uploads are validated before anything is written: the real type comes from magic bytes, and the upload is rejected when the extension, the declared MIME type, and the detected type disagree.
- SVG is rejected instead of sanitized.
- The per-file limit is 5 MB (`MAX_MEDIA_BYTES`); the Server Action body limit is 6 MB to leave room for multipart overhead. Both are enforced server-side.
- Storage keys are generated (`media/<year>/<month>/<uuid>.<ext>`); the original file name never reaches storage, which prevents path traversal and overwrite.
- Binaries are written through `src/lib/storage/`. The `local` driver writes under `.local-storage/uploads/` (development only, git-ignored). Production requires `MEDIA_STORAGE_DRIVER=s3` with the `S3_*` variables; the local driver refuses to run in production unless `MEDIA_ALLOW_LOCAL_IN_PRODUCTION=true`.
- When a file has no public URL, `/media/[...key]` serves it, but only after looking the key up in `media_assets`. An unknown key returns 404, so the route cannot read arbitrary objects.
- Deleting an asset is refused while a `links.icon` value or a site-settings image still references its storage key. Release the reference first.
- The database row is created only after the provider confirms the write; a failed insert removes the object again so storage and metadata cannot drift apart.

## 6. Administrator management

The CMS reuses the Phase 4 provisioning and lifecycle services rather than re-implementing accounts:

- Inviting creates a single-use invitation and displays the raw token exactly once for private delivery. The token is never re-readable; issue a new invitation to replace it.
- Acceptance remains CLI-only (`pnpm admin:accept-invite`), so a leaked CMS session cannot set an account password.
- The acting administrator cannot suspend or disable their own account, and the last `ACTIVE` `SUPER_ADMIN` cannot be suspended or disabled.
- Status changes go through the atomic lifecycle service, which locks the account row and increments `authVersion`.

## 7. Audit logs and system status

`security_events` is append-only and shared by authentication and content events. The CMS reads it for display only; there is no UI path to edit or delete audit rows. The system-status page reports configuration presence and measured connectivity only. It never reads secret values, so it cannot leak a database URL, signing secret, or storage credential.

## 8. Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MEDIA_STORAGE_DRIVER` | No | `local` (default outside production) or `s3` (default and required in production). |
| `MEDIA_LOCAL_ROOT` | No | Overrides the local upload directory (default `.local-storage/uploads/`). |
| `MEDIA_LOCAL_PUBLIC_URL` | No | Base URL when a CDN or reverse proxy serves local files. |
| `MEDIA_ALLOW_LOCAL_IN_PRODUCTION` | No | Escape hatch for non-production environments that run with `NODE_ENV=production`; leave `false` in real production. |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | When `s3` | Credentials for the S3-compatible provider. |
| `S3_ENDPOINT`, `S3_PUBLIC_URL` | No | Custom endpoint for R2/MinIO and a public read base URL. |

## 9. Verification record

Executed on 2026-11-15 against the local PostgreSQL container (`flexbox-linktree-db`, `127.0.0.1:5433`).

| Check | Command | Result |
| --- | --- | --- |
| Unit and integration tests | `pnpm test` | 23 files, 244 tests passed |
| Lint | `pnpm lint` | No findings |
| Types | `pnpm typecheck` | No errors |
| Production build | `pnpm build` | Succeeded |

Integration coverage includes CMS content mutations (create, update, publication transitions, reorder, delete, category reassignment), media metadata and reference-protected deletion, and administrator management (self-lockout, last-active-admin, invitation state). The integration tests create and remove only their own rows and skip when no local database is reachable.

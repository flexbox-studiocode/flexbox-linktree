# Content Database Schema — Phases 3 and 4

**Product:** Flexbox Linktree / Flexbox Studio Digital Hub
**Status:** Content tables implemented in Phase 3; administrator identity tables implemented in Phase 4
**Language:** English

## Scope

Phase 3 establishes the PostgreSQL content foundation. Phase 4 adds the administrator identity, invitation, password-reset, throttling, and security-event tables described in section "Administrator tables". This document does not cover CMS UI, uploads, analytics, or production deployment.

## Tables

### `system_checks`

Existing Phase 1 health-check table. It remains unchanged and is used by `pnpm db:check`.

### `categories`

Owns editorial groups for public cards.

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `name` | Display name |
| `slug` | Unique stable natural key |
| `description` | Optional editorial description |
| `icon` | Optional approved icon name |
| `sort_order` | Non-negative display order |
| `is_active` | Public/CMS activation state |
| `created_at`, `updated_at` | UTC timestamps |

An active category is publicly eligible only if it has at least one eligible link. Category deletion is `RESTRICT`; links must be reassigned or the category must be deactivated first.

### `links`

Owns curated destinations and publication lifecycle.

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `slug` | Unique stable natural key and public DTO ID |
| `category_id` | Required foreign key to `categories` |
| `title`, `description` | Card copy |
| `icon`, `tag` | Approved presentation metadata |
| `destination_type` | `EXTERNAL`, `INTERNAL`, or `NONE` |
| `destination_url` | Nullable URL for `EXTERNAL` |
| `internal_anchor` | Nullable approved page fragment for `INTERNAL` |
| `status` | `DRAFT`, `PUBLISHED`, or `ARCHIVED` |
| `is_active` | Operational activation state |
| `is_featured` | Editorial feature state |
| `sort_order` | Non-negative display order |
| `published_at` | Required for `PUBLISHED`; null for `DRAFT` |
| `created_at`, `updated_at` | UTC timestamps |

Foreign-key deletion is `RESTRICT`. Archiving is preferred to deletion so later analytics can retain references or snapshots.

### `site_settings`

Typed key-value settings table. Each known key is validated by a Zod schema in `src/features/content/schemas/site-setting.ts`; arbitrary uncontrolled website JSON is not accepted by the service layer.

Current keys:

- `general`
- `navigation`
- `hero`
- `directory`
- `contact`
- `footer`
- `seo`

### `media_assets`

Metadata foundation for future media management. PostgreSQL stores the original name, unique storage key, MIME type, size, optional dimensions, alt text, and timestamps. Binary files are not stored in PostgreSQL. Upload UI and storage-provider integration belong to Phase 5/deployment.

## Enums

- `publication_status`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `link_destination_type`: `EXTERNAL`, `INTERNAL`, `NONE`

`NONE` is deliberate: it represents a published, visible, non-interactive card such as the current `Segera` links. It is not a missing-value accident.

## Database constraints

The additive migration `20261115061934_add_content_cms_foundation` adds PostgreSQL checks for:

- Exactly one coherent destination representation.
- External schemes limited to `http`, `https`, and `mailto`.
- Internal destinations restricted to fragment-shaped anchors.
- `DRAFT`/`PUBLISHED` publication timestamp consistency.
- Non-negative category/link sort order.
- Non-negative media byte size.

The application layer still validates all untrusted input using Zod. Database checks are defense in depth, not a replacement for service validation.

## Indexes

- Unique category slug.
- Active category + sort order + slug.
- Unique link slug.
- Category + status + active + sort order + slug.
- Status + active + sort order + slug.
- Unique site-setting key.
- Unique media storage key.
- Media MIME type.

The public query uses active categories, published/active links, and deterministic `{ sortOrder ASC, slug ASC }` ordering.

## Publication lifecycle

A public link must satisfy:

```text
status = PUBLISHED
AND link.is_active = true
AND category.is_active = true
AND destination state is valid
```

Drafts, archived links, inactive links, and links under inactive categories are excluded in the database query. Categories without eligible links are not rendered.

The mapper omits `href` for `NONE` and invalid destination states. It exposes only approved HTTP(S) destinations or allowlisted internal anchors (`#atas`, `#direktori`, `#kontak`). No public DTO exposes status, publication timestamps, category IDs, or other admin metadata.

## Seed process

```powershell
pnpm db:seed
```

The seed dataset is in `prisma/seed-data.ts`; `prisma/seed.ts` upserts categories by slug, links by slug, and settings by key. It never deletes unrelated records. Running the seed twice leaves 2 categories, 8 links, and 7 settings in the local database.

The current seed preserves six unconfirmed destinations as `PUBLISHED` + `NONE` + `Segera`, preserves two `#kontak` internal destinations, and keeps the contact email, canonical URL, and Open Graph image null.

## Administrator tables (Phase 4)

Phase 4 adds the allowlist and its supporting tables. See `.docs/AUTH_SECURITY.md` for the authentication and authorization rules that use them.

### `admin_users`

The allowlist. There is no public registration: a row is created only by the bootstrap CLI or by accepting an invitation.

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `email` | Address as entered |
| `normalized_email` | Unique lower-cased lookup key |
| `full_name` | Display name |
| `password_hash` | Argon2id hash; `null` while `INVITED` |
| `role` | `SUPER_ADMIN` |
| `status` | `INVITED`, `ACTIVE`, `SUSPENDED`, `DISABLED` |
| `email_verified_at`, `password_changed_at`, `last_login_at` | Lifecycle timestamps |
| `failed_login_count`, `locked_until` | Advisory counters; the authoritative throttle is `admin_rate_limits` |
| `auth_version` | Session generation included in the JWT as `av`; incremented on every lifecycle transition |

### `admin_invitations`

Single-use invitations. Only the SHA-256 hash of the raw token is stored.

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `email`, `normalized_email` | Invited identity |
| `token_hash` | Unique SHA-256 digest of the raw token |
| `role` | Role granted on acceptance |
| `expires_at` | 72-hour expiry |
| `accepted_at`, `revoked_at` | Terminal states |
| `created_by` | Issuing administrator (nullable on delete) |

### `password_reset_tokens`

Short-lived recovery tokens, also stored as SHA-256 digests only.

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `admin_user_id` | Owning account |
| `token_hash` | Unique digest |
| `expires_at` | 60-minute expiry |
| `used_at` | Set atomically on consumption |
| `created_at` | Issue time |

### `admin_rate_limits`

Shared, restart-surviving login throttle.

| Column | Purpose |
|---|---|
| `scope` | `ACCOUNT` or `SOURCE` |
| `key_hash` | SHA-256 of the normalized email, or HMAC-SHA256 of the client address |
| `attempt_count` | Failures inside the current window |
| `window_started_at`, `locked_until` | Window and lock state |

Unique on `(scope, key_hash)`. Raw email addresses and raw IP addresses are never stored.

### `security_events`

Append-only audit trail for authentication and lifecycle events. `admin_user_id` and `target_id` are nullable so events survive account deletion, and `safe_metadata` never contains passwords, hashes, tokens, or raw addresses.

## Administrator enums

- `admin_role`: `SUPER_ADMIN`
- `admin_account_status`: `INVITED`, `ACTIVE`, `SUSPENDED`, `DISABLED`
- `rate_limit_scope`: `ACCOUNT`, `SOURCE`
- `security_event_type`: `LOGIN_SUCCEEDED`, `LOGIN_FAILED`, `LOGIN_BLOCKED`, `INVITATION_CREATED`, `INVITATION_REVOKED`, `INVITATION_ACCEPTED`, `ACCOUNT_BOOTSTRAPPED`, `ACCOUNT_ACTIVATED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DISABLED`, `PASSWORD_CHANGED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `SESSION_REVOKED`, `RATE_LIMIT_CLEANUP`

## Administrator constraints

Additive migrations from Phase 4 add PostgreSQL checks for:

- `admin_users`: `normalized_email` equals its own lower-cased, trimmed form and is non-empty; `password_hash` is `NULL` or starts with `$argon2id$`; `ACTIVE` requires a password hash; `role` must be `SUPER_ADMIN`; `auth_version >= 1`; `failed_login_count >= 0`.
- `admin_invitations` and `password_reset_tokens`: lower-cased `normalized_email`, 64-character lowercase hex `token_hash`, `SUPER_ADMIN` role, and coherent lifecycle timestamps (`expires_at` after `created_at`, `accepted_at`/`revoked_at`/`used_at` not before creation).
- `admin_rate_limits`: 64-character lowercase hex `key_hash`, non-negative `attempt_count`, and `locked_until` not before `window_started_at` when both are set.
- Uniqueness: one `admin_users.normalized_email`, one invitation and one reset token per `token_hash`, and one throttle row per `(scope, key_hash)`.

Lifecycle timestamps are supplied by the application clock while `created_at` uses the database clock. The migration `20261115161000_relax_lifecycle_clock_skew` widens the token lifecycle checks by five minutes so a small clock difference between the app host and PostgreSQL cannot reject a valid transition.

## Migration and local connection

Local PostgreSQL runs in the loopback-only `flexbox-linktree-db` container (`127.0.0.1:5433`, database `flexbox_linktree_dev`). Prisma CLI loads `.env.local` through `prisma7.config.ts`.

```powershell
pnpm db:validate
pnpm db:generate
pnpm db:migrate --name <migration_name>       # local development only
pnpm db:migrate:deploy                        # controlled environments
pnpm db:seed
pnpm db:check
```

A pre-Phase-3 local backup was saved outside Git under `.local-storage/backups/`; `.local-storage/` is ignored. No production database was used.

## Caching

The public service uses Next.js 16 Cache Components with `use cache`, `cacheLife("minutes")`, and a `public-content` cache tag. This gives a one-minute revalidation window and one-hour expiry. The tag is prepared for future authenticated CMS mutations; no unauthenticated revalidation endpoint exists in Phase 3.

## Data retention and deletion

Phase 3 creates no analytics event table. Future analytics must preserve historical references using nullable relationships or snapshots rather than cascading deletion from content. Raw analytics retention is a later decision with the initial documented target of 90 days. Media binaries will use the storage abstraction and independent production storage; they are not database blobs.

Administrator rows are never hard-deleted by application code. Status transitions (`SUSPENDED`, `DISABLED`) preserve the audit trail, and `security_events` keeps nullable references so history survives a manual removal. `pnpm admin:cleanup` removes only expired reset tokens and stale throttle rows; invitations and security events are retained as audit data.

## Future boundaries

Phase 4 owns authentication, authorization, provisioning, recovery, throttling, and security events; it is complete. Phase 5 owns CMS CRUD, publication mutations, media upload, and the audit-log UI. Phase 6 owns analytics.

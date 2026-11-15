# Authentication and Authorization Security

Phase 4 implementation reference for the private Flexbox admin CMS.

This document records the authentication model, the authorization boundary, the account lifecycle, the threat model, and the verification evidence. It reflects the code in `src/features/auth`, `src/lib/auth`, `src/lib/security`, `src/lib/mail`, and `src/proxy.ts`.

## 1. Scope

Implemented in Phase 4:

- Administrator identity schema (`admin_users`, `admin_invitations`, `password_reset_tokens`, `admin_rate_limits`, `security_events`).
- Internal provisioning: first-run bootstrap CLI, invitation CLI, invitation acceptance CLI, account status CLI, expired-row cleanup CLI.
- Credentials sign-in with Argon2id verification and database-backed throttling.
- JWT session (8 hours, no sliding refresh, no remember-me).
- Server-side authorization for every protected read and mutation.
- Sign-out, signed-in password change, forgot-password request, reset-password completion.
- Login UI at `/admin/login` and a placeholder authenticated landing page at `/admin`.

Explicitly **not** implemented in Phase 4:

- Any CMS content screen, CRUD, media library, or analytics dashboard (Phase 5 and 6).
- Multi-factor authentication.
- Public registration, social login, or an external identity provider.
- A production transactional mail provider. The only transport is the local file transport described in section 11.

## 2. Identity model

`admin_users` is the allowlist. There is no separate "users" table and no self-service sign-up: a row can only appear through the bootstrap CLI or an accepted invitation.

| Field | Role in authentication |
| --- | --- |
| `normalized_email` (unique) | Lookup key. Lower-cased and trimmed before use. |
| `password_hash` | Argon2id encoded hash; `null` while `INVITED`. |
| `role` | `SUPER_ADMIN` is the only role that authorizes CMS access. |
| `status` | `INVITED`, `ACTIVE`, `SUSPENDED`, `DISABLED`. Only `ACTIVE` may sign in. |
| `auth_version` | Session generation. Copied into the JWT as `av` and compared on every guarded request. |

`admin_invitations.token_hash` and `password_reset_tokens.token_hash` store SHA-256 digests only. Raw tokens exist once, in the CLI output or the mail payload.

## 3. Authentication flow

`POST /api/auth/callback/admin-credentials` → `authorize()` in `src/lib/auth/config.ts` → `authenticateAdmin()` in `src/features/auth/services/authenticate-admin.ts`.

1. Shape validation with `loginSchema`. Malformed input returns `null` before any database read or security event, so unauthenticated callers cannot generate event noise.
2. Throttle pre-check against the `ACCOUNT` and `SOURCE` buckets. A blocked attempt records `LOGIN_BLOCKED` and returns `null`.
3. Account lookup by `normalized_email`.
4. Argon2id verification, gated by `status === "ACTIVE"` and `role === "SUPER_ADMIN"`. The password is verified only for an existing account; every failure path still returns the same generic result.
5. Rehash on sign-in when the stored hash uses weaker parameters than the current policy.
6. On success: clear both buckets, record `last_login_at`, emit `LOGIN_SUCCEEDED`.
7. On failure: increment both buckets, emit `LOGIN_FAILED`.

Auth.js then writes the JWT. Claims are deliberately minimal:

```
{ sub: <admin id>, role: "SUPER_ADMIN", av: <authVersion> }
```

The `session` callback rebuilds the browser-visible session from a fresh database read. If the row is missing, not `ACTIVE`, or `auth_version` no longer matches `av`, the session is returned without a user.

### Password hashing

`src/lib/security/password.ts` uses `@node-rs/argon2` with Argon2id, `m = 19456` KiB, `t = 2`, `p = 1`, 32-byte output. Measured locally at roughly 22 ms per hash, which is the OWASP baseline configuration.

`@node-rs/argon2` is used instead of the `argon2` package because it ships prebuilt N-API binaries for Node 26 on Windows. The pure `argon2` package would require a node-gyp toolchain at install time. Both implement the same Argon2id format, so the stored hashes are portable.

### Password policy

Minimum 12 characters, maximum 256, checked by `checkPasswordPolicy` on invitation acceptance, password change, and reset. Plaintext passwords are never stored, logged, or emitted in security-event metadata.

## 4. Session handling

- Strategy: JWT (`session.strategy = "jwt"`). No session table.
- Lifetime: 8 hours (`ADMIN_SESSION_MAX_AGE_SECONDS`), `updateAge` equal to `maxAge` so continued use does not extend it.
- Cookies: `httpOnly`, `sameSite=lax`, `path=/`. The `secure` flag and the `__Secure-`/`__Host-` name prefixes are derived from `NEXTAUTH_URL` (or `VERCEL`) in `src/lib/auth/cookies.ts`.
- Session revocation: any lifecycle transition increments `auth_version`, invalidating every issued JWT on its next guarded request. Sign-out clears the cookie.

## 5. Authorization boundary

`src/features/auth/services/authorization.ts` owns the rule: rights come from the database row, never from the token alone.

`resolveAuthorizedAdmin(payload)` returns an administrator projection only when:

- the token carries a string `sub` and a numeric `av`;
- the row exists;
- `status === "ACTIVE"`;
- `row.authVersion === av`;
- `role === "SUPER_ADMIN"`.

`src/lib/auth/session.ts` exposes `getCurrentAdmin` (memoised per request), `requireAdmin` (redirects to `/admin/login`), `requireSuperAdmin` (redirects to `/admin` when the caller is not a Super Admin), and `requireAdminAction` (never redirects; throws `AuthorizationError` so a Server Action or route handler can map it to 401/403).

Rules enforced in review:

- A valid session is not authorization. Every protected read and mutation calls a guard.
- Server Actions call `requireAdminAction()` themselves. The proxy matcher can miss paths, so it is never the only check.
- Repositories and services in `src/features/auth` import `server-only`; none of them may be imported by a Client Component.

Phase 5 extends the same boundary to the CMS. Every protected page under `src/app/admin/(protected)` calls `requireAdmin()` in its layout and page; every CMS Server Action in `src/features/admin/actions` calls `requireAdminAction()` (account management adds `requireSuperAdmin()`); and the admin content, settings, media, audit, and administrator data services are `server-only`. The media serving route `/media/[...key]` is deliberately public because published content references those files, but it resolves the key in `media_assets` and never exposes the storage backend directly.

`src/proxy.ts` is an optimistic early gate only. It verifies the JWT signature with `getToken` to decide between rendering and redirecting, uses an explicit `PUBLIC_ADMIN_PATHS` allowlist so new pages default to private, refuses closed when no signing secret is configured, and never reads the database. It carries the intended destination as a sanitized `?callbackUrl=`.

## 6. Provisioning

Provisioning has two surfaces:

- Operator CLIs (Phase 4).
- An authenticated CMS invitation screen (Phase 5) at `/admin/administrators`, which reuses `createInvitationForAdmin` and `revokeInvitationById` from the same provisioning service. Invitation acceptance stays CLI-only, so no CMS path can set an account password.

CLI commands:

| Command | Purpose | Guard |
| --- | --- | --- |
| `pnpm admin:bootstrap` | Create the first Super Admin | Requires `ADMIN_BOOTSTRAP_ENABLED=true`, refuses when any administrator row exists (re-checked inside the transaction) |
| `pnpm admin:invite` | Issue a 72-hour single-use invitation | Refuses for an existing account; revokes earlier pending invitations for the same address |
| `pnpm admin:accept-invite` | Activate an invited account | Token hash lookup, expiry check, password policy, claim-before-activate ordering |
| `pnpm admin:set-status` | Suspend, disable, or reactivate | Increments `auth_version`, so live sessions end immediately |
| `pnpm admin:cleanup` | Delete expired reset tokens and stale throttle rows | Never touches administrator accounts or invitations |

Invitation tokens are 256-bit random values. Only the SHA-256 digest is persisted. A new invitation or reset token revokes the previous pending one for that account.

## 7. Recovery

`requestPasswordReset()` is non-enumerating: the same outcome is returned for an unknown address, an inactive account, and a valid account. A token is created only for an `ACTIVE` account, and the request endpoint is throttled with the `SOURCE` bucket.

- TTL: 60 minutes (`RESET_TOKEN_TTL_MINUTES`).
- Single use: consumption is atomic, so a concurrent replay cannot succeed twice.
- New token invalidates older tokens for the same account.
- Completion requires the password policy and replaces the hash, then increments `auth_version`.
- The signed-in change-password flow requires the current password and also increments `auth_version`.

## 8. Throttling

Database-backed, so it survives restarts and is shared across processes. Two scopes:

| Scope | Key | Failures | Window | Lockout |
| --- | --- | --- | --- | --- |
| `ACCOUNT` | SHA-256 of normalized email | 5 | 15 min | 15 min |
| `SOURCE` | HMAC-SHA256 of the client address with `RATE_LIMIT_SECRET` | 20 | 15 min | 15 min |

Raw IP addresses are never stored. Forwarded headers (`x-forwarded-for`, `x-real-ip`) are trusted only when `TRUST_PROXY_HEADERS=true`; otherwise the socket address is used.

Recovery, invitation acceptance, and sign-in deliberately share the `SOURCE` bucket: they are the same authentication surface, so flooding one must not leave the others free.

## 9. Threat model

| Threat | Control |
| --- | --- |
| Credential stuffing | Per-account and per-source throttling, generic error copy |
| Account enumeration via login or recovery | One generic message for every failure; recovery always returns the same outcome |
| Password database leak | Argon2id with OWASP parameters; plaintext never stored |
| Stolen JWT | 8-hour fixed lifetime, no sliding refresh, `auth_version` revocation on every lifecycle change |
| Compromised former member | `SUSPENDED`/`DISABLED` invalidates sessions immediately; proxy gate plus database guard |
| Direct endpoint calls bypassing the UI | Guards live in services and Server Actions, not in components |
| Open redirect after sign-in | `sanitizeCallbackUrl` restricts targets to `/admin` paths; Auth.js resolves relative targets against its own base URL |
| CSRF on sign-in | Auth.js CSRF token plus `sameSite=lax` cookies |
| Token theft from database | Only SHA-256 digests of invitation and reset tokens are stored |
| Error-message leakage | Security events store event types and buckets, never passwords, hashes, or raw addresses |
| Misconfiguration | Missing `NEXTAUTH_SECRET` fails closed; missing mail transport fails loudly outside development |

Known limitations, accepted for Phase 4:

- No MFA. The Credentials provider has no built-in second factor, and no authenticator workflow was approved for this phase. Strong passwords, throttling, and short sessions are the compensating controls.
- No production mail provider, so production password recovery is not yet operable. `getAdminMailer()` refuses to run in production rather than discarding the link.
- Throttling is per account and per source; a distributed botnet with many addresses is bounded only by the per-account bucket.
- Security events are recorded but there is no alerting or dashboard yet (Phase 5).

## 10. Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes in production | Canonical origin; also derives secure cookie prefixes and reset links |
| `NEXTAUTH_SECRET` or `AUTH_SECRET` | Yes | JWT signing secret; missing value fails closed |
| `RATE_LIMIT_SECRET` | Yes | Dedicated HMAC key for source buckets; must differ from the session secret |
| `TRUST_PROXY_HEADERS` | No | `true` only behind a proxy that overwrites forwarded headers |
| `ADMIN_BOOTSTRAP_ENABLED` | No | `true` enables the one-time bootstrap CLI |
| `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_NAME` | No | Bootstrap identity |
| `ADMIN_MAIL_TRANSPORT` | No | `file` selects the development file transport |
| `MEDIA_STORAGE_DRIVER`, `S3_*` | No | Phase 5 media storage; see `.docs/ADMIN_CMS.md` |

Rotating `NEXTAUTH_SECRET` invalidates all sessions. Rotating `RATE_LIMIT_SECRET` resets source buckets, which is acceptable during an incident and should be deliberate otherwise.

## 11. Mail transport

`src/lib/mail/admin-mailer.ts` defines an `AdminMailer` interface with one implementation: a JSON file writer under `.local-storage/mail/` (git-ignored, mode `0600`). It is selected when `ADMIN_MAIL_TRANSPORT=file` or outside production. In production with no transport configured it throws, and the caller still answers with the generic response while recording the failure.

Adding a real provider means implementing the interface and returning it from `getAdminMailer()`; no call site changes.

## 12. Verification record

Executed on 2026-11-15 against the local PostgreSQL container (`flexbox-linktree-db`, `127.0.0.1:5433`).

| Check | Command | Result |
| --- | --- | --- |
| Unit and integration tests | `pnpm test` | 15 files, 156 tests passed |
| Lint | `pnpm lint` | No findings |
| Types | `pnpm typecheck` | No errors |
| Production build | `pnpm build` | Succeeded; `.next/BUILD_ID` written |
| Unauthenticated `/admin` | `curl.exe` against `next start` | `307` → `/admin/login` |
| Sign-in (CSRF + credentials callback) | `curl.exe` with cookie jar | Session cookie issued, `/admin` renders the signed-in name |
| Signed-in `/admin/login` | `curl.exe` with session cookie | `307` → `/admin` |
| Sign-out | `curl.exe` + `/api/auth/signout` | Session empty, `/admin` → `/admin/login` |
| Wrong password | `curl.exe` credentials callback | `CredentialsSignin`, no session cookie, no distinguishing detail |
| Disabled account | `pnpm admin:set-status --status=DISABLED`, then sign-in | Rejected; `authVersion` incremented, existing session revoked |
| Foreign `callbackUrl` | Credentials callback with `https://evil.example/steal` | Not used as a redirect target |
| CLIs | `pnpm admin:cleanup`, `pnpm admin:set-status` (no args) | Cleanup succeeded; missing-argument path exits with usage |

Phase 5 re-ran the automated checks after the CMS landed:

| Check | Command | Result |
| --- | --- | --- |
| Unit and integration tests | `pnpm test` | 23 files, 244 tests passed |
| Lint | `pnpm lint` | No findings |
| Types | `pnpm typecheck` | No errors |
| Production build | `pnpm build` | Succeeded |

The integration tests create and remove only their own rows, and they skip when no local database is reachable.
-- Defense-in-depth constraints for the Phase 4 admin identity tables.
--
-- Prisma already enforces the primary keys, foreign keys, uniqueness, and the
-- enums. These CHECK constraints encode invariants that must hold even if a
-- row is written by hand in SQL rather than through the application services:
--
--   * Normalized email addresses are always lower-cased with no outer spaces.
--   * Token columns always hold a SHA-256 hex digest, never a raw token.
--   * Authentication versions and counters are never negative.
--   * Active accounts always have a usable password, while non-active accounts
--     may be awaiting a password reset.
--   * Rate-limit rows are coherent (non-negative counts, ordered timestamps,
--     locks never outliving the row).
--   * Reset tokens record a use only after they were created.

-- admin_users ---------------------------------------------------------------

ALTER TABLE "admin_users"
  ADD CONSTRAINT "admin_users_normalized_email_lowercase_check"
  CHECK ("normalized_email" = lower(btrim("normalized_email")) AND length("normalized_email") > 0);

ALTER TABLE "admin_users"
  ADD CONSTRAINT "admin_users_password_hash_format_check"
  CHECK ("password_hash" IS NULL OR "password_hash" LIKE '$argon2id$%');

ALTER TABLE "admin_users"
  ADD CONSTRAINT "admin_users_active_requires_password_check"
  CHECK ("status" <> 'ACTIVE' OR "password_hash" IS NOT NULL);

ALTER TABLE "admin_users"
  ADD CONSTRAINT "admin_users_auth_version_check"
  CHECK ("auth_version" >= 1);

ALTER TABLE "admin_users"
  ADD CONSTRAINT "admin_users_failed_login_count_check"
  CHECK ("failed_login_count" >= 0);

ALTER TABLE "admin_users"
  ADD CONSTRAINT "admin_users_role_check"
  CHECK ("role" = 'SUPER_ADMIN');

-- admin_invitations ---------------------------------------------------------

ALTER TABLE "admin_invitations"
  ADD CONSTRAINT "admin_invitations_normalized_email_lowercase_check"
  CHECK ("normalized_email" = lower(btrim("normalized_email")) AND length("normalized_email") > 0);

ALTER TABLE "admin_invitations"
  ADD CONSTRAINT "admin_invitations_token_hash_sha256_check"
  CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "admin_invitations"
  ADD CONSTRAINT "admin_invitations_role_check"
  CHECK ("role" = 'SUPER_ADMIN');

ALTER TABLE "admin_invitations"
  ADD CONSTRAINT "admin_invitations_lifecycle_check"
  CHECK (
    ("accepted_at" IS NULL OR "accepted_at" >= "created_at")
    AND ("revoked_at" IS NULL OR "revoked_at" >= "created_at")
    AND ("expires_at" > "created_at")
  );

-- password_reset_tokens -----------------------------------------------------

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_token_hash_sha256_check"
  CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_lifecycle_check"
  CHECK (
    "expires_at" > "created_at"
    AND ("used_at" IS NULL OR "used_at" >= "created_at")
  );

-- admin_rate_limits ---------------------------------------------------------

ALTER TABLE "admin_rate_limits"
  ADD CONSTRAINT "admin_rate_limits_key_hash_check"
  CHECK ("key_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "admin_rate_limits"
  ADD CONSTRAINT "admin_rate_limits_counters_check"
  CHECK ("attempt_count" >= 0);

ALTER TABLE "admin_rate_limits"
  ADD CONSTRAINT "admin_rate_limits_timestamps_check"
  CHECK (
    "expires_at" > "window_started_at"
    AND ("locked_until" IS NULL OR ("locked_until" > "window_started_at" AND "locked_until" <= "expires_at"))
  );

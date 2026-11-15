-- Relax the token lifecycle CHECK constraints to tolerate clock skew.
--
-- The original constraints (20261115081700_add_admin_identity_checks) compared
-- application-supplied timestamps (`used_at`, `accepted_at`, `revoked_at`)
-- against the database-generated `created_at` with a strict `>=`.
--
-- That is not a property the application can guarantee: those columns are written
-- from the Node.js process clock while `created_at` comes from the database
-- clock. Wherever the application clock runs a few milliseconds behind the
-- database clock — which is normal for two NTP-synced hosts, and unavoidable when
-- a caller injects a deterministic timestamp for testing — a legitimate
-- redemption, acceptance, or revocation was rejected by PostgreSQL with
-- SQLSTATE 23514 instead of succeeding.
--
-- The invariant that actually matters is retained:
--   * a token must expire after it is created (`expires_at > created_at`);
--   * a lifecycle timestamp may not predate creation by more than the documented
--     clock-skew allowance below.
--
-- The allowance is 5 minutes: far larger than any sane NTP drift, and small
-- enough that a backdated lifecycle write is still caught.

ALTER TABLE "admin_invitations"
  DROP CONSTRAINT "admin_invitations_lifecycle_check";

ALTER TABLE "admin_invitations"
  ADD CONSTRAINT "admin_invitations_lifecycle_check"
  CHECK (
    ("accepted_at" IS NULL OR "accepted_at" >= "created_at" - INTERVAL '5 minutes')
    AND ("revoked_at" IS NULL OR "revoked_at" >= "created_at" - INTERVAL '5 minutes')
    AND ("expires_at" > "created_at")
  );

ALTER TABLE "password_reset_tokens"
  DROP CONSTRAINT "password_reset_tokens_lifecycle_check";

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_lifecycle_check"
  CHECK (
    "expires_at" > "created_at"
    AND ("used_at" IS NULL OR "used_at" >= "created_at" - INTERVAL '5 minutes')
  );

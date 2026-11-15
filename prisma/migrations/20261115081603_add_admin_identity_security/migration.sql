-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "admin_account_status" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "rate_limit_scope" AS ENUM ('ACCOUNT', 'SOURCE');

-- CreateEnum
CREATE TYPE "security_event_type" AS ENUM ('LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGIN_BLOCKED', 'INVITATION_CREATED', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED', 'ACCOUNT_BOOTSTRAPPED', 'ACCOUNT_ACTIVATED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_DISABLED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'SESSION_REVOKED', 'RATE_LIMIT_CLEANUP');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "admin_role" NOT NULL DEFAULT 'SUPER_ADMIN',
    "status" "admin_account_status" NOT NULL DEFAULT 'INVITED',
    "email_verified_at" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "auth_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_invitations" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "role" "admin_role" NOT NULL DEFAULT 'SUPER_ADMIN',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_admin_id" UUID,
    "accepted_by_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_rate_limits" (
    "id" UUID NOT NULL,
    "scope" "rate_limit_scope" NOT NULL,
    "key_hash" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    "locked_until" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID,
    "event_type" "security_event_type" NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "safe_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_normalized_email_key" ON "admin_users"("normalized_email");

-- CreateIndex
CREATE INDEX "admin_users_status_role_idx" ON "admin_users"("status", "role");

-- CreateIndex
CREATE UNIQUE INDEX "admin_invitations_token_hash_key" ON "admin_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "admin_invitations_normalized_email_accepted_at_revoked_at_idx" ON "admin_invitations"("normalized_email", "accepted_at", "revoked_at");

-- CreateIndex
CREATE INDEX "admin_invitations_expires_at_idx" ON "admin_invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_admin_user_id_used_at_idx" ON "password_reset_tokens"("admin_user_id", "used_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "admin_rate_limits_expires_at_idx" ON "admin_rate_limits"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_rate_limits_scope_key_hash_key" ON "admin_rate_limits"("scope", "key_hash");

-- CreateIndex
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at");

-- CreateIndex
CREATE INDEX "security_events_admin_user_id_created_at_idx" ON "security_events"("admin_user_id", "created_at");

-- CreateIndex
CREATE INDEX "security_events_event_type_created_at_idx" ON "security_events"("event_type", "created_at");

-- AddForeignKey
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_accepted_by_admin_id_fkey" FOREIGN KEY ("accepted_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

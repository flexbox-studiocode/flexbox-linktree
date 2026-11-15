-- Permanent administrator removal is a distinct audited event, not a status
-- transition: the account row disappears, so the trail must say so explicitly.
-- The event value is added in its own migration because PostgreSQL forbids using
-- a freshly added enum value in the same transaction that creates it.
ALTER TYPE "security_event_type" ADD VALUE IF NOT EXISTS 'ADMIN_ACCOUNT_DELETED';
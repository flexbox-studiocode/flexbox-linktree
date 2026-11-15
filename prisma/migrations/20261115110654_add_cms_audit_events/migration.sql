-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "security_event_type" ADD VALUE 'LINK_CREATED';
ALTER TYPE "security_event_type" ADD VALUE 'LINK_UPDATED';
ALTER TYPE "security_event_type" ADD VALUE 'LINK_PUBLISHED';
ALTER TYPE "security_event_type" ADD VALUE 'LINK_UNPUBLISHED';
ALTER TYPE "security_event_type" ADD VALUE 'LINK_ARCHIVED';
ALTER TYPE "security_event_type" ADD VALUE 'LINK_RESTORED';
ALTER TYPE "security_event_type" ADD VALUE 'LINK_DELETED';
ALTER TYPE "security_event_type" ADD VALUE 'LINK_REORDERED';
ALTER TYPE "security_event_type" ADD VALUE 'CATEGORY_CREATED';
ALTER TYPE "security_event_type" ADD VALUE 'CATEGORY_UPDATED';
ALTER TYPE "security_event_type" ADD VALUE 'CATEGORY_ACTIVATED';
ALTER TYPE "security_event_type" ADD VALUE 'CATEGORY_DEACTIVATED';
ALTER TYPE "security_event_type" ADD VALUE 'CATEGORY_REORDERED';
ALTER TYPE "security_event_type" ADD VALUE 'CATEGORY_DELETED';
ALTER TYPE "security_event_type" ADD VALUE 'SETTINGS_UPDATED';
ALTER TYPE "security_event_type" ADD VALUE 'MEDIA_UPLOADED';
ALTER TYPE "security_event_type" ADD VALUE 'MEDIA_UPDATED';
ALTER TYPE "security_event_type" ADD VALUE 'MEDIA_DELETED';

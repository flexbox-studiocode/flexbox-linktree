-- CreateEnum
CREATE TYPE "publication_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "link_destination_type" AS ENUM ('EXTERNAL', 'INTERNAL', 'NONE');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "tag" TEXT,
    "destination_type" "link_destination_type" NOT NULL,
    "destination_url" TEXT,
    "internal_anchor" TEXT,
    "status" "publication_status" NOT NULL DEFAULT 'DRAFT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_sort_order_slug_idx" ON "categories"("is_active", "sort_order", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "links_slug_key" ON "links"("slug");

-- CreateIndex
CREATE INDEX "links_category_id_status_is_active_sort_order_slug_idx" ON "links"("category_id", "status", "is_active", "sort_order", "slug");

-- CreateIndex
CREATE INDEX "links_status_is_active_sort_order_slug_idx" ON "links"("status", "is_active", "sort_order", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "site_settings_key_key" ON "site_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_mime_type_idx" ON "media_assets"("mime_type");

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data-integrity constraints that the Prisma schema language cannot express.
-- Application validation is still mandatory; these are the last line of defence
-- so a bug or a manual SQL edit cannot store an incoherent destination state.

-- Every destination type carries exactly the columns it needs and no others.
ALTER TABLE "links" ADD CONSTRAINT "links_destination_shape_check" CHECK (
    ("destination_type" = 'EXTERNAL' AND "destination_url" IS NOT NULL AND "internal_anchor" IS NULL)
    OR ("destination_type" = 'INTERNAL' AND "internal_anchor" IS NOT NULL AND "destination_url" IS NULL)
    OR ("destination_type" = 'NONE' AND "destination_url" IS NULL AND "internal_anchor" IS NULL)
);

-- External destinations are limited to approved schemes. `javascript:`,
-- `data:`, `vbscript:`, protocol-relative and relative values are rejected.
ALTER TABLE "links" ADD CONSTRAINT "links_destination_url_scheme_check" CHECK (
    "destination_url" IS NULL
    OR "destination_url" ~* '^(https?|mailto):[^[:space:]]+$'
);

-- Internal destinations must be in-page fragments only: no scheme, no host,
-- no path, so an internal-anchor field can never become an external redirect.
ALTER TABLE "links" ADD CONSTRAINT "links_internal_anchor_check" CHECK (
    "internal_anchor" IS NULL
    OR "internal_anchor" ~ '^#[A-Za-z][A-Za-z0-9-]*$'
);

-- Publication timestamp must agree with publication status:
-- DRAFT never has one, PUBLISHED always has one, ARCHIVED keeps the historical one.
ALTER TABLE "links" ADD CONSTRAINT "links_published_at_status_check" CHECK (
    ("status" = 'DRAFT' AND "published_at" IS NULL)
    OR ("status" = 'PUBLISHED' AND "published_at" IS NOT NULL)
    OR ("status" = 'ARCHIVED')
);

-- Ordering must be deterministic and non-negative.
ALTER TABLE "categories" ADD CONSTRAINT "categories_sort_order_check" CHECK ("sort_order" >= 0);
ALTER TABLE "links" ADD CONSTRAINT "links_sort_order_check" CHECK ("sort_order" >= 0);

-- Media metadata must not describe a negative size.
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_size_bytes_check" CHECK ("size_bytes" >= 0);

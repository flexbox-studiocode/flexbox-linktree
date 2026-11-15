-- CreateEnum
CREATE TYPE "analytics_event_type" AS ENUM ('PAGE_VIEW', 'LINK_CLICK');

-- CreateEnum
CREATE TYPE "analytics_device_type" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "analytics_browser_family" AS ENUM ('CHROME', 'SAFARI', 'FIREFOX', 'EDGE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "analytics_os_family" AS ENUM ('WINDOWS', 'MACOS', 'LINUX', 'ANDROID', 'IOS', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "analytics_referrer_category" AS ENUM ('DIRECT', 'SEARCH', 'SOCIAL', 'REFERRAL', 'CAMPAIGN', 'INTERNAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "analytics_dimension" AS ENUM ('TOTAL', 'DEVICE', 'BROWSER', 'OS', 'REFERRER');

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "event_type" "analytics_event_type" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitor_key_hash" TEXT,
    "session_key_hash" TEXT,
    "dedupe_key" TEXT,
    "link_id" UUID,
    "link_slug_snapshot" TEXT,
    "link_title_snapshot" TEXT,
    "link_category_snapshot" TEXT,
    "device_type" "analytics_device_type" NOT NULL DEFAULT 'UNKNOWN',
    "browser_family" "analytics_browser_family" NOT NULL DEFAULT 'UNKNOWN',
    "os_family" "analytics_os_family" NOT NULL DEFAULT 'UNKNOWN',
    "referrer_category" "analytics_referrer_category" NOT NULL DEFAULT 'UNKNOWN',
    "campaign_source" TEXT,
    "campaign_medium" TEXT,
    "campaign_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily_metrics" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "event_type" "analytics_event_type" NOT NULL,
    "dimension" "analytics_dimension" NOT NULL,
    "dimension_value" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "analytics_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_link_metrics" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "link_id" UUID NOT NULL,
    "link_slug_snapshot" TEXT,
    "link_title_snapshot" TEXT,
    "link_category_snapshot" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "analytics_link_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_events_dedupe_key_key" ON "analytics_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "analytics_events_occurred_at_idx" ON "analytics_events"("occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_event_type_occurred_at_idx" ON "analytics_events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_link_id_occurred_at_idx" ON "analytics_events"("link_id", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_session_key_hash_occurred_at_idx" ON "analytics_events"("session_key_hash", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_visitor_key_hash_occurred_at_idx" ON "analytics_events"("visitor_key_hash", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_daily_metrics_day_event_type_idx" ON "analytics_daily_metrics"("day", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_metrics_day_event_type_dimension_dimension__key" ON "analytics_daily_metrics"("day", "event_type", "dimension", "dimension_value");

-- CreateIndex
CREATE INDEX "analytics_link_metrics_day_idx" ON "analytics_link_metrics"("day");

-- CreateIndex
CREATE INDEX "analytics_link_metrics_link_id_idx" ON "analytics_link_metrics"("link_id");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_link_metrics_day_link_id_key" ON "analytics_link_metrics"("day", "link_id");

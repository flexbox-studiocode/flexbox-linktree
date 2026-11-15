-- Phase 6 analytics invariants that Prisma cannot express.
--
-- These are defence in depth on top of the Zod/service validation: a bug in the
-- collector must not be able to persist a raw identifier, a free-form campaign
-- string, or a click event without a link identity.

-- Identifier columns hold keyed SHA-256 digests, never raw values.
ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_visitor_hash_format_check"
    CHECK ("visitor_key_hash" IS NULL OR "visitor_key_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "analytics_events_session_hash_format_check"
    CHECK ("session_key_hash" IS NULL OR "session_key_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "analytics_events_dedupe_hash_format_check"
    CHECK ("dedupe_key" IS NULL OR "dedupe_key" ~ '^[0-9a-f]{64}$');

-- A click must name its link; a page view must not.
ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_link_identity_check"
    CHECK (
      ("event_type" = 'LINK_CLICK' AND "link_id" IS NOT NULL)
      OR ("event_type" = 'PAGE_VIEW' AND "link_id" IS NULL)
    );

-- Bounded content snapshots and campaign fields.
ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_snapshot_length_check"
    CHECK (
      coalesce(char_length("link_slug_snapshot"), 0) <= 200
      AND coalesce(char_length("link_title_snapshot"), 0) <= 200
      AND coalesce(char_length("link_category_snapshot"), 0) <= 200
      AND coalesce(char_length("campaign_source"), 0) <= 64
      AND coalesce(char_length("campaign_medium"), 0) <= 64
      AND coalesce(char_length("campaign_name"), 0) <= 64
    );

-- Rollup sanity.
ALTER TABLE "analytics_daily_metrics"
  ADD CONSTRAINT "analytics_daily_metrics_count_check" CHECK ("count" >= 0),
  ADD CONSTRAINT "analytics_daily_metrics_dimension_value_check"
    CHECK (
      ("dimension" = 'TOTAL' AND "dimension_value" = 'ALL')
      OR ("dimension" <> 'TOTAL' AND char_length("dimension_value") BETWEEN 1 AND 64)
    );

ALTER TABLE "analytics_link_metrics"
  ADD CONSTRAINT "analytics_link_metrics_clicks_check" CHECK ("clicks" >= 0);
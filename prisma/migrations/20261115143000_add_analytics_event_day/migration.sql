-- The reporting day is materialized so distinct visitor/click counts can use
-- COUNT(DISTINCT (…, day)) without embedding a timezone expression in SQL.
-- The analytics tables are new in this phase and are empty in every environment,
-- so adding a NOT NULL column needs no backfill.
ALTER TABLE "analytics_events" ADD COLUMN "day" DATE NOT NULL;
CREATE INDEX "analytics_events_day_event_type_idx" ON "analytics_events"("day", "event_type");
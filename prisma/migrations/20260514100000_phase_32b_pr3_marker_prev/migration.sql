-- Phase 32B PR3 post-#9b polish part 2 — snapshot of the previous sweep on
-- the client marker, so the Practice hero KPI strip can show a "change
-- since last sweep" delta without a history table. Purely additive
-- (nullable columns, no backfill needed; null until the second sweep for
-- a given client). CLAUDE.md §12.11 destructive-write checklist N/A.

ALTER TABLE "client_snapshot_markers" ADD COLUMN "previousHealthScore" INTEGER;
ALTER TABLE "client_snapshot_markers" ADD COLUMN "previousTrailStage" TEXT;

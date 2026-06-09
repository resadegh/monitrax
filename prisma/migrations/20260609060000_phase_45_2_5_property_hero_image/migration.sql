-- Phase 45.2.5 — additive nullable columns for the user-uploadable
-- property hero photo. Stored inline as BYTEA (≤5MB JPEG/PNG/WEBP).
-- No backfill, no destructive write. CLAUDE.md §12.11 / §12.12 safe.

ALTER TABLE "properties"
  ADD COLUMN "heroImage" BYTEA,
  ADD COLUMN "heroImageMime" TEXT;

-- Phase 33g.2 polish — per-thread AI-disabled toggle on FeedbackThread
--
-- Adds a single nullable boolean column with a default so the column can
-- be added without backfilling — every existing thread defaults to
-- aiDisabled = false (AI runs as usual).
--
-- CLAUDE.md §12.11 destructive-write checklist: NOT REQUIRED — purely
-- additive ADD COLUMN with a default; no UPDATE / DELETE on existing
-- rows; no DROP / ALTER on existing columns.

ALTER TABLE "feedback_threads"
  ADD COLUMN IF NOT EXISTS "aiDisabled" BOOLEAN NOT NULL DEFAULT false;

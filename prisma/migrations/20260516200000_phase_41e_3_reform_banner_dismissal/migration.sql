-- Phase 41E.3 — "Tax rules are changing" CFO Guide one-time banner dismissal.
--
-- Adds `dismissedReformBanner` to `user_preferences`. Same pattern as
-- the existing `dismissedOnboardingBadge` + `dismissedWelcomeModal`
-- columns. Calm-framing banner per Reza's 5-point confirmation
-- 2026-05-16: one-time, dismissable, accessible later via CFO Guide.
--
-- Per CLAUDE.md §12.11 destructive-write checklist:
--   • Operation: ADD COLUMN with NOT NULL DEFAULT false (Postgres
--     fills the default for every existing row in the same statement
--     — no race, no two-step migration needed).
--   • Columns overwritten: NONE — only NEW column written.
--   • Guard: column is new; no prior data exists.
--   → §12.11 N/A by structural argument. User confirmation: NOT REQUIRED.

ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "dismissedReformBanner" BOOLEAN NOT NULL DEFAULT false;

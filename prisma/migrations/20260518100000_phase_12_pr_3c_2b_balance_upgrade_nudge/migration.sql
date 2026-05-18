-- Phase 12 PR 3c.2b — "Connect your bank for fresh balances" first-
-- visit migration modal dismissal flag.
--
-- Adds `dismissedBalanceUpgradeNudge` to `user_preferences`. Mirrors
-- the pattern set by `dismissedReformBanner` (migration
-- 20260516200000_phase_41e_3_reform_banner_dismissal) — one column,
-- additive, default false.
--
-- Modal behaviour: shown once to existing users with ≥1 MANUAL
-- account; once dismissed (any choice — Connect via Basiq / Upload
-- statement / Keep manual), the flag flips to true and the modal
-- never auto-shows again. Always reachable via Settings > Data Health
-- (PR J) for users who want to revisit the choice.
--
-- Per CLAUDE.md §12.11 destructive-write checklist:
--   • Operation: ADD COLUMN with NOT NULL DEFAULT false (Postgres
--     fills the default for every existing row in the same statement
--     — no race, no two-step migration needed).
--   • Columns overwritten: NONE — only NEW column written.
--   • Guard: column is new; no prior data exists.
--   → §12.11 N/A by structural argument. User confirmation: NOT REQUIRED.

ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "dismissedBalanceUpgradeNudge" BOOLEAN NOT NULL DEFAULT false;

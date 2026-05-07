-- Phase 42 PR6.5b — Pending-actions popup gate columns on engagement_state.
--
-- Per Reza idea 2026-05-07: "have the transaction reconciliation and
-- categorisation be popup when user login to be completed" — a once-per-day
-- bundled-pending-actions overlay on first dashboard render. Three columns:
--
--   lastPromptShownAt     — set when the popup is rendered (gate anchor)
--   lastPromptDismissedAt — set when the user picks "Not today"
--   promptOptedOut        — global off-switch ("Don't show me this again")
--
-- All three are additive and nullable / default-false; CLAUDE.md §12.11 N/A
-- (pure ALTER TABLE ADD COLUMN, no row UPDATE/DELETE, no DROP, no NOT NULL
-- without default).

ALTER TABLE "engagement_state"
  ADD COLUMN "lastPromptShownAt"     TIMESTAMP(3),
  ADD COLUMN "lastPromptDismissedAt" TIMESTAMP(3),
  ADD COLUMN "promptOptedOut"        BOOLEAN NOT NULL DEFAULT false;

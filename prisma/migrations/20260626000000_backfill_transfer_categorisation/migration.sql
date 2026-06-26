-- Phase 55 — backfill stale transfers so storage matches the display.
--
-- Transactions marked isTransfer=true BEFORE the Phase 54.1 confirmed-transfer
-- field-set shipped still carry a null category, so they used to render
-- "Uncategorised / Not confirmed yet" (Reza prod report 2026-06-26). The
-- Phase 55 `deriveRowStatus()` already shows them correctly as "Transfer ·
-- Done" (the label derives from isTransfer, not the stored category), so this
-- backfill is a STORAGE-consistency cleanup, not a display dependency: it gives
-- these rows the canonical Transfer category + confirmed flag so cashflow,
-- exports and the registry see a categorised row.
--
-- §19.1: these are already excluded from spend/income by the actuals engine
-- (isTransfer=true), so no money number changes.
--
-- §12.11 destructive-write checklist:
--   where:    only rows ALREADY marked isTransfer=true that have NO category —
--             cannot touch any non-transfer or already-categorised row.
--   columns:  categorisation metadata only (categoryLevel1/2,
--             userCorrectedCategory, confidenceScore) — never amount/date.
--   guard:    isTransfer=true is the synthetic key; a transfer IS a "Transfer".
--   idempotent: re-running matches nothing (categoryLevel1 is no longer null).

UPDATE "unified_transactions"
SET "categoryLevel1" = 'Transfer',
    "categoryLevel2" = COALESCE("categoryLevel2", 'Internal'),
    "userCorrectedCategory" = true,
    "confidenceScore" = 1.0
WHERE "isTransfer" = true
  AND ("categoryLevel1" IS NULL OR "categoryLevel1" = '');

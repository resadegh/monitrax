-- Phase 42 PR3 — Receipts + cash quick-add foundation
--
-- Three additive schema changes:
--   1. ALTER TYPE "TransactionSource" ADD VALUE 'RECEIPT'
--      For receipt rows that did NOT match an existing bank/QIF tx.
--   2. ALTER TYPE "AccountType" ADD VALUE 'CASH'
--      Sole-trader / market-seller cash log; treated as liquid for
--      emergency-fund + net-worth (LIQUID_ACCOUNT_TYPES extended in
--      lib/types/prisma-enums.ts).
--   3. ALTER TABLE "unified_transactions" ADD COLUMN "matchedDocumentId"
--      Direct pointer for "show me the receipt for this transaction".
--      Nullable; set by the DME analyze/confirm flow on match-or-create.
--
-- Operations: ALTER TYPE × 2 (additive), ALTER TABLE ADD COLUMN × 1
-- (nullable). NO DROP, NO destructive ALTER, NO row UPDATE / DELETE.
-- CLAUDE.md §12.11 N/A.

ALTER TYPE "TransactionSource" ADD VALUE IF NOT EXISTS 'RECEIPT';

ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'CASH';

ALTER TABLE "unified_transactions"
    ADD COLUMN "matchedDocumentId" TEXT;

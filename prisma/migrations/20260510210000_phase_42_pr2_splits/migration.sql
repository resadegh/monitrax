-- Phase 42 PR2 — Transaction Splits
--
-- Adds the per-line split layer on top of the unified ledger. The sum
-- of all splits for a transaction MUST equal `transaction.amount` ± $0.01;
-- validation lives at the service layer (`lib/bookkeeping/splits.ts`)
-- because Postgres CHECK constraints can't reference aggregates across
-- rows in another table.
--
-- The parent transaction's `categoryLevel*` fields stay populated for
-- backwards-compat with every canonical engine
-- (`getMasterFinancialSnapshot`, expense / income aggregators,
-- reconciliation utilities). Splits are an *additive* layer.
--
-- All operations in this migration are ADDITIVE:
--   - CREATE TABLE × 1
--   - CREATE INDEX × 4
--   - FOREIGN KEY × 2
--
-- No DROP. No destructive ALTER. No row UPDATE / DELETE / UPSERT.
-- CLAUDE.md §12.11 N/A.

CREATE TABLE "transaction_splits" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "propertyId" TEXT,
    "loanId" TEXT,
    "expenseId" TEXT,
    "isTaxDeductible" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_splits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transaction_splits_transactionId_idx"
    ON "transaction_splits"("transactionId");
CREATE INDEX "transaction_splits_categoryId_idx"
    ON "transaction_splits"("categoryId");
CREATE INDEX "transaction_splits_propertyId_idx"
    ON "transaction_splits"("propertyId");
CREATE INDEX "transaction_splits_expenseId_idx"
    ON "transaction_splits"("expenseId");

ALTER TABLE "transaction_splits"
    ADD CONSTRAINT "transaction_splits_transactionId_fkey"
        FOREIGN KEY ("transactionId") REFERENCES "unified_transactions"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transaction_splits"
    ADD CONSTRAINT "transaction_splits_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "canonical_category_registry"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

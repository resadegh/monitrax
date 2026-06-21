-- Phase 51 — Loan ledger (the loan's own transactions, quarantined from
-- categorisation + the spending view). Additive only: two new enum types, a
-- new column on "loans" (default 1.0 → back-compat), and the new
-- "loan_transactions" table. No destructive operations (CLAUDE.md §12.11).

-- New enum types
CREATE TYPE "LoanTransactionKind" AS ENUM ('INTEREST_CHARGED', 'REPAYMENT_RECEIVED', 'FEE', 'REDRAW', 'OTHER');
CREATE TYPE "LoanMatchStatus" AS ENUM ('UNMATCHED', 'SUGGESTED', 'LINKED', 'DISMISSED');

-- Loan: deductible fraction (mixed-purpose apportionment foundation; 1.0 = fully deductible)
ALTER TABLE "loans" ADD COLUMN "deductibleFraction" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- The loan ledger
CREATE TABLE "loan_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "postDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "kind" "LoanTransactionKind" NOT NULL,
    "description" TEXT,
    "balanceAfter" DOUBLE PRECISION,
    "interestPortion" DOUBLE PRECISION,
    "principalPortion" DOUBLE PRECISION,
    "matchStatus" "LoanMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchConfidence" DOUBLE PRECISION,
    "matchedTransactionId" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'QIF',
    "externalId" TEXT,
    "basiqTransactionId" TEXT,
    "importBatchId" TEXT,
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loan_transactions_matchedTransactionId_key" ON "loan_transactions"("matchedTransactionId");
CREATE UNIQUE INDEX "loan_transactions_basiqTransactionId_key" ON "loan_transactions"("basiqTransactionId");
CREATE INDEX "loan_transactions_userId_idx" ON "loan_transactions"("userId");
CREATE INDEX "loan_transactions_loanId_idx" ON "loan_transactions"("loanId");
CREATE INDEX "loan_transactions_date_idx" ON "loan_transactions"("date");
CREATE INDEX "loan_transactions_matchStatus_idx" ON "loan_transactions"("matchStatus");
CREATE INDEX "loan_tx_dedup" ON "loan_transactions"("loanId", "date", "amount", "contentHash");

ALTER TABLE "loan_transactions" ADD CONSTRAINT "loan_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_transactions" ADD CONSTRAINT "loan_transactions_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_transactions" ADD CONSTRAINT "loan_transactions_matchedTransactionId_fkey" FOREIGN KEY ("matchedTransactionId") REFERENCES "unified_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

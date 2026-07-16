-- Phase 59 — Managed Rental Income & Agent-Cost Reconciliation
-- (docs/blueprint/PHASE_59_MANAGED_RENTAL_INCOME.md §4). ADDITIVE ONLY:
-- every new column is default-backfilled or nullable — no existing row
-- changes behaviour (rentalMode DIRECT = today's implicit semantics).
-- NOTE: model Income is @@map("income"), Expense is @@map("expenses").

-- CreateEnum
CREATE TYPE "RentalMode" AS ENUM ('DIRECT', 'MANAGED');

-- CreateEnum
CREATE TYPE "ExpenseDerivationSource" AS ENUM ('RECONCILIATION', 'STATEMENT');

-- AlterEnum: agent management & property costs category for derived expenses
ALTER TYPE "ExpenseCategory" ADD VALUE 'PROPERTY_MANAGEMENT';

-- AlterEnum: the agent rental/owner statement document type (Neobrain parser)
ALTER TYPE "DocumentAnalysisType" ADD VALUE 'RENTAL_STATEMENT';

-- AlterTable: managed-rental mode on the income stream (declared gross stays
-- in amount/frequency; MANAGED is opt-in per stream)
ALTER TABLE "income" ADD COLUMN "rentalMode" "RentalMode" NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "income" ADD COLUMN "managingAgentName" TEXT;

-- AlterTable: derived agent-cost expense fields
ALTER TABLE "expenses" ADD COLUMN "derived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "expenses" ADD COLUMN "derivedSource" "ExpenseDerivationSource";
ALTER TABLE "expenses" ADD COLUMN "itemised" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "expenses" ADD COLUMN "derivedFromIncomeId" TEXT;

-- CreateTable: learn-once disbursement rule (one per managed rental stream)
CREATE TABLE "agent_disbursement_rules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "incomeStreamId" TEXT NOT NULL,
    "expectedGrossPerPeriod" DOUBLE PRECISION NOT NULL,
    "cadence" "Frequency" NOT NULL,
    "baselineGapAmount" DOUBLE PRECISION NOT NULL,
    "tolerancePct" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_disbursement_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_disbursement_rules_incomeStreamId_key" ON "agent_disbursement_rules"("incomeStreamId");

-- CreateIndex
CREATE INDEX "agent_disbursement_rules_userId_idx" ON "agent_disbursement_rules"("userId");

-- CreateIndex
CREATE INDEX "expenses_derivedFromIncomeId_idx" ON "expenses"("derivedFromIncomeId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_derivedFromIncomeId_fkey" FOREIGN KEY ("derivedFromIncomeId") REFERENCES "income"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_disbursement_rules" ADD CONSTRAINT "agent_disbursement_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_disbursement_rules" ADD CONSTRAINT "agent_disbursement_rules_incomeStreamId_fkey" FOREIGN KEY ("incomeStreamId") REFERENCES "income"("id") ON DELETE CASCADE ON UPDATE CASCADE;

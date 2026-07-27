-- MON-103 (capture Stage 3): per-entity per-FY Div 152 small-business CGT
-- concession self-assessment facts. Additive only — a new table; no existing
-- row or table is touched. All fact columns nullable (null = never-asked);
-- the assembler's all-or-nothing gate means an incomplete assessment can
-- never produce a concession outcome.
CREATE TABLE "div152_assessments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "gainAfterDiv115" DECIMAL(19,4),
    "maxNetAssetValue" DECIMAL(19,4),
    "aggregatedTurnover" DECIMAL(19,4),
    "monthsHeld" INTEGER,
    "isActiveAsset" BOOLEAN,
    "isRetirementOrIncapacity" BOOLEAN,
    "electActiveAssetReduction" BOOLEAN,
    "electRetirementExemption" BOOLEAN,
    "electRollover" BOOLEAN,
    "retirementExemptionUsedToDate" DECIMAL(19,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "div152_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "div152_assessments_entityId_financialYear_key" ON "div152_assessments"("entityId", "financialYear");
CREATE INDEX "div152_assessments_userId_idx" ON "div152_assessments"("userId");

-- Audit action for the exclusive writer of div152_assessments.
ALTER TYPE "AuditAction" ADD VALUE 'DIV152_ASSESSMENT_SAVED';

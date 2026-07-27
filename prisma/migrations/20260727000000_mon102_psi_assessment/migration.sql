-- MON-102 (capture Stage 2): per-entity per-FY PSI self-assessment facts.
-- Additive only — a new table; no existing row or table is touched. All fact
-- columns nullable (null = never-asked); the assembler's numerics gate means
-- an incomplete assessment can never produce a PSI attribution.
CREATE TABLE "psi_assessments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "totalPsiIncome" DECIMAL(19,4),
    "incomeFromLargestClient" DECIMAL(19,4),
    "unrelatedClientCount" INTEGER,
    "gainedClientsViaDirectAdvertising" BOOLEAN,
    "meetsResultsTest" BOOLEAN,
    "meetsEmploymentTest" BOOLEAN,
    "meetsBusinessPremisesTest" BOOLEAN,
    "hasPsbDetermination" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psi_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "psi_assessments_entityId_financialYear_key" ON "psi_assessments"("entityId", "financialYear");
CREATE INDEX "psi_assessments_userId_idx" ON "psi_assessments"("userId");

-- Audit action for the exclusive writer of psi_assessments.
ALTER TYPE "AuditAction" ADD VALUE 'PSI_ASSESSMENT_SAVED';

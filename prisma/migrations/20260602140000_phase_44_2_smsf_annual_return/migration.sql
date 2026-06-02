-- Phase 44.2: SMSF annual fund-tax figures (persisted input to
-- calculateSmsfIncomeTax). Additive only — new table + unique index + index
-- + two FKs. No DROP, no data mutation. §12.11 destructive-write checklist:
-- N/A (table is created empty; nothing existing is touched).

-- CreateTable
CREATE TABLE "smsf_annual_returns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "assessableInvestmentIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assessableContributions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nonArmsLengthIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isComplying" BOOLEAN NOT NULL DEFAULT true,
    "isInPensionPhase" BOOLEAN NOT NULL DEFAULT false,
    "ecpiExemptProportion" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smsf_annual_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "smsf_annual_returns_legalEntityId_financialYear_key" ON "smsf_annual_returns"("legalEntityId", "financialYear");

-- CreateIndex
CREATE INDEX "smsf_annual_returns_userId_idx" ON "smsf_annual_returns"("userId");

-- AddForeignKey
ALTER TABLE "smsf_annual_returns"
    ADD CONSTRAINT "smsf_annual_returns_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smsf_annual_returns"
    ADD CONSTRAINT "smsf_annual_returns_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "PrivateCompanyBenefitType" AS ENUM ('LOAN', 'PAYMENT', 'DEBT_FORGIVENESS', 'UPE', 'SUB_TRUST_ARRANGEMENT');

-- CreateEnum
CREATE TYPE "TrustDeedRuleType" AS ENUM ('BENEFICIARY_CLASS', 'DISTRIBUTION_METHOD', 'DEFAULT_BENEFICIARY', 'STREAMING_POWER', 'VESTING_DATE', 'INCOME_DEFINITION', 'SUB_TRUST_UPE_CLAUSE');

-- CreateTable
CREATE TABLE "distribution_resolutions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trustEntityId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "trustNetIncome" DECIMAL(19,4) NOT NULL,
    "distributableIncome" DECIMAL(19,4),
    "resolutionDate" TIMESTAMP(3),
    "frankedDividendPool" DECIMAL(19,4),
    "capitalGainPool" DECIMAL(19,4),
    "hasFamilyTrustElection" BOOLEAN NOT NULL DEFAULT false,
    "status" "ResolutionStatus" NOT NULL DEFAULT 'DRAFT',
    "accountantVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "sourceDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distribution_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribution_allocations" (
    "id" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "beneficiaryEntityId" TEXT NOT NULL,
    "presentlyEntitledShare" DECIMAL(9,6) NOT NULL,
    "streamedFrankedDividends" DECIMAL(19,4),
    "streamedCapitalGains" DECIMAL(19,4),
    "notes" TEXT,

    CONSTRAINT "distribution_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_distributions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyEntityId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "declaredDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(19,4) NOT NULL,
    "frankingPercentage" DECIMAL(5,2) NOT NULL,
    "frankingCreditsTotal" DECIMAL(19,4) NOT NULL,
    "status" "ResolutionStatus" NOT NULL DEFAULT 'DRAFT',
    "accountantVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dividend_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_payments" (
    "id" TEXT NOT NULL,
    "dividendDistributionId" TEXT NOT NULL,
    "shareholderEntityId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "frankingCredits" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "dividend_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_company_benefits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyEntityId" TEXT NOT NULL,
    "recipientEntityId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "benefitType" "PrivateCompanyBenefitType" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "openingBalance" DECIMAL(19,4),
    "loanTermYears" INTEGER,
    "benchmarkRate" DECIMAL(7,4),
    "repaymentsThisFy" DECIMAL(19,4),
    "hasComplianceAgreement" BOOLEAN NOT NULL DEFAULT false,
    "isSubTrustUpe" BOOLEAN NOT NULL DEFAULT false,
    "accountantVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "private_company_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_deed_rules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trustEntityId" TEXT NOT NULL,
    "sourceExtractionId" TEXT,
    "ruleType" "TrustDeedRuleType" NOT NULL,
    "ruleValue" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "extractedConfidence" DECIMAL(4,3),
    "accountantVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trust_deed_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "distribution_resolutions_userId_idx" ON "distribution_resolutions"("userId");

-- CreateIndex
CREATE INDEX "distribution_resolutions_trustEntityId_financialYear_idx" ON "distribution_resolutions"("trustEntityId", "financialYear");

-- CreateIndex
CREATE INDEX "distribution_allocations_resolutionId_idx" ON "distribution_allocations"("resolutionId");

-- CreateIndex
CREATE INDEX "distribution_allocations_beneficiaryEntityId_idx" ON "distribution_allocations"("beneficiaryEntityId");

-- CreateIndex
CREATE INDEX "dividend_distributions_userId_idx" ON "dividend_distributions"("userId");

-- CreateIndex
CREATE INDEX "dividend_distributions_companyEntityId_financialYear_idx" ON "dividend_distributions"("companyEntityId", "financialYear");

-- CreateIndex
CREATE INDEX "dividend_payments_dividendDistributionId_idx" ON "dividend_payments"("dividendDistributionId");

-- CreateIndex
CREATE INDEX "dividend_payments_shareholderEntityId_idx" ON "dividend_payments"("shareholderEntityId");

-- CreateIndex
CREATE INDEX "private_company_benefits_userId_idx" ON "private_company_benefits"("userId");

-- CreateIndex
CREATE INDEX "private_company_benefits_companyEntityId_financialYear_idx" ON "private_company_benefits"("companyEntityId", "financialYear");

-- CreateIndex
CREATE INDEX "trust_deed_rules_userId_idx" ON "trust_deed_rules"("userId");

-- CreateIndex
CREATE INDEX "trust_deed_rules_trustEntityId_ruleType_idx" ON "trust_deed_rules"("trustEntityId", "ruleType");

-- AddForeignKey
ALTER TABLE "distribution_resolutions" ADD CONSTRAINT "distribution_resolutions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_allocations" ADD CONSTRAINT "distribution_allocations_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "distribution_resolutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_distributions" ADD CONSTRAINT "dividend_distributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_payments" ADD CONSTRAINT "dividend_payments_dividendDistributionId_fkey" FOREIGN KEY ("dividendDistributionId") REFERENCES "dividend_distributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_company_benefits" ADD CONSTRAINT "private_company_benefits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_deed_rules" ADD CONSTRAINT "trust_deed_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


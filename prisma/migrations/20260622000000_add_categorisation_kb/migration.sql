-- Phase 52 — Shared categorisation knowledge base (de-identified, RAG).
-- Additive only: two enum types + two tables. The shared `transaction_signatures`
-- table holds NO userId (de-identified aggregate); the private
-- `signature_contributions` ledger is per-(signature,user) with a UNIQUE pair
-- (the anti-bloat + distinct-user-count guarantee). No destructive ops (§12.11).

CREATE TYPE "SignatureMatchType" AS ENUM ('EXACT', 'TOKEN', 'MCC', 'REGEX', 'EMBEDDING');
CREATE TYPE "SignatureSource" AS ENUM ('SEED', 'USER_CONFIRMED', 'AI_SUGGESTED');

CREATE TABLE "transaction_signatures" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'AU',
    "pattern" TEXT NOT NULL,
    "matchType" "SignatureMatchType" NOT NULL DEFAULT 'EXACT',
    "mcc" TEXT,
    "categoryVotes" JSONB NOT NULL DEFAULT '{}',
    "topCategory" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distinctUserCount" INTEGER NOT NULL DEFAULT 0,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "amountHintMin" DOUBLE PRECISION,
    "amountHintMed" DOUBLE PRECISION,
    "amountHintMax" DOUBLE PRECISION,
    "source" "SignatureSource" NOT NULL DEFAULT 'USER_CONFIRMED',
    "lastConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_signatures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transaction_signatures_region_pattern_matchType_key" ON "transaction_signatures"("region", "pattern", "matchType");
CREATE INDEX "transaction_signatures_region_pattern_idx" ON "transaction_signatures"("region", "pattern");
CREATE INDEX "transaction_signatures_mcc_idx" ON "transaction_signatures"("mcc");
CREATE INDEX "transaction_signatures_isGlobal_idx" ON "transaction_signatures"("isGlobal");

CREATE TABLE "signature_contributions" (
    "id" TEXT NOT NULL,
    "signatureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_contributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "signature_contributions_signatureId_userId_key" ON "signature_contributions"("signatureId", "userId");
CREATE INDEX "signature_contributions_signatureId_idx" ON "signature_contributions"("signatureId");
CREATE INDEX "signature_contributions_userId_idx" ON "signature_contributions"("userId");

ALTER TABLE "signature_contributions" ADD CONSTRAINT "signature_contributions_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "transaction_signatures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signature_contributions" ADD CONSTRAINT "signature_contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

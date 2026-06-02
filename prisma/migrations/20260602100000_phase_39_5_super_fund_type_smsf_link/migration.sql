-- Phase 39.5: Superannuation fund-type classification + SMSF entity link.
--
-- Additive only — new enum + two nullable/defaulted columns + index + FK.
-- No DROP, no data backfill (existing rows default to INDUSTRY, ownerEntityId
-- NULL). §12.11 destructive-write checklist: N/A (no existing data mutated).
--
-- Distinguishes retail/industry super (member of an external APRA fund,
-- userId-scoped, counted in net worth) from SMSF (a LegalEntity that OWNS its
-- assets; member accounts carry ownerEntityId and are EXCLUDED from the
-- net-worth super sum to avoid double-counting with the entity's assets).

-- CreateEnum
CREATE TYPE "SuperFundType" AS ENUM ('INDUSTRY', 'RETAIL', 'SMSF');

-- AlterTable
ALTER TABLE "superannuation_accounts"
    ADD COLUMN "fundType" "SuperFundType" NOT NULL DEFAULT 'INDUSTRY',
    ADD COLUMN "ownerEntityId" TEXT;

-- CreateIndex
CREATE INDEX "superannuation_accounts_ownerEntityId_idx" ON "superannuation_accounts"("ownerEntityId");

-- AddForeignKey
ALTER TABLE "superannuation_accounts"
    ADD CONSTRAINT "superannuation_accounts_ownerEntityId_fkey"
    FOREIGN KEY ("ownerEntityId") REFERENCES "legal_entities"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

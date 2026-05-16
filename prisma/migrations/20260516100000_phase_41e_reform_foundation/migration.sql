-- Phase 41E reform 2026-27 — Stage 1 foundation (CLAUDE.md §12.14)
--
-- Additive schema changes to support the 12 May 2026 Federal Budget tax-law
-- reforms. Reza directive 2026-05-16 confirmed: contract-date grandfathering;
-- one PR for Stage 1 (scaffolding only, zero behavioural change); auto-backfill
-- `acquisitionContractDate := purchaseDate` for unambiguously-grandfathered
-- pre-cut-over properties.
--
-- Cut-over moment (CLAUDE.md §12.14, lib/tax-engine/config/reformConstants.ts):
--   `2026-05-12T09:30:00Z` UTC (= 7:30pm AEST 12 May 2026)
--
-- Per CLAUDE.md §12.11 (destructive-write checklist):
--   • Operation: ADD COLUMN × 7 (nullable, no default-backfill) + CREATE TYPE × 2
--     + ADD COLUMN on `legal_entities` × 2 + ADD INDEX × 2 + CREATE TABLE × 1.
--   • where clause: each ADD COLUMN is unguarded; new columns + new enums.
--   • Columns overwritten: NONE — only NEW columns are written. The
--     `acquisitionContractDate` backfill UPDATE is guarded by
--     `WHERE acquisitionContractDate IS NULL AND purchase_date < cutOver`.
--     The `trustType` backfill UPDATE is guarded by `WHERE trustType IS NULL
--     AND type = 'DISCRETIONARY_TRUST'` (unambiguous mapping).
--   • Guard: the WHERE clauses fail-closed — re-running the migration is a
--     no-op because the columns are non-NULL after the first run.
--   → §12.11 N/A by structural argument (additive + the backfills only write
--     rows the migration itself just created columns for). User confirmation:
--     NOT REQUIRED.

-- --------------------------------------------------------------------------
-- 1. NewBuildEvidence enum (Measure 1 — audits the isNewBuild claim)
-- --------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "NewBuildEvidence" AS ENUM (
    'NEVER_SOLD',
    'BUILDER_FIRST_OWNER_UNDER_12M',
    'VACANT_LAND_BUILD',
    'OFF_THE_PLAN',
    'DEMO_REBUILD_NET_ADD'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------------------------
-- 2. TrustType enum (Measure 3 — only DISCRETIONARY is subject to 30% min)
-- --------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "TrustType" AS ENUM (
    'DISCRETIONARY',
    'FIXED',
    'UNIT',
    'TESTAMENTARY_FIXED',
    'CHARITABLE',
    'DECEASED_ESTATE',
    'SPECIAL_DISABILITY',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------------------------
-- 3. Property — grandfathering inputs (Measures 1 + 2 + 4)
-- --------------------------------------------------------------------------
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "acquisitionContractDate"    TIMESTAMP(3);
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "acquisitionSettlementDate"  TIMESTAMP(3);
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "isNewBuild"                 BOOLEAN;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "newBuildEvidence"           "NewBuildEvidence";
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "isRenewablesInfrastructure" BOOLEAN;

CREATE INDEX IF NOT EXISTS "properties_acquisitionContractDate_idx"
  ON "properties" ("acquisitionContractDate");

-- --------------------------------------------------------------------------
-- 4. LegalEntity — Measure 3 (trustType) + Measure 4 (isForeignResident)
-- --------------------------------------------------------------------------
ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "trustType"         "TrustType";
ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "isForeignResident" BOOLEAN;

CREATE INDEX IF NOT EXISTS "legal_entities_trustType_idx"
  ON "legal_entities" ("trustType");

-- --------------------------------------------------------------------------
-- 5. CompanyTaxHistory — Measure 5 (loss refundability carry-back)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "company_tax_history" (
  "id"                     TEXT       NOT NULL,
  "legalEntityId"          TEXT       NOT NULL,
  "financialYear"          TEXT       NOT NULL,
  "taxablePosition"        DOUBLE PRECISION NOT NULL,
  "taxPaid"                DOUBLE PRECISION NOT NULL DEFAULT 0,
  "frankingAccountBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"                  TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_tax_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_tax_history_legalEntityId_financialYear_key"
  ON "company_tax_history" ("legalEntityId", "financialYear");

CREATE INDEX IF NOT EXISTS "company_tax_history_legalEntityId_idx"
  ON "company_tax_history" ("legalEntityId");

-- FK + cascade on legal-entity deletion. Defensive ALTER guarded so re-run is a no-op.
DO $$ BEGIN
  ALTER TABLE "company_tax_history"
    ADD CONSTRAINT "company_tax_history_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------------------------
-- 6. One-time safe backfill — `Property.acquisitionContractDate`
-- --------------------------------------------------------------------------
-- Per Reza 5-point confirmation 2026-05-16: for properties whose existing
-- `purchaseDate` is unambiguously BEFORE the cut-over moment, write the
-- contract date := purchaseDate. These are unambiguously grandfathered.
-- For post-cut-over `purchaseDate` rows, leave acquisitionContractDate NULL
-- so the UI nudges the user to confirm the actual contract date (which
-- around the cut-over could differ from settlement by days).
--
-- The cut-over moment is `2026-05-12T09:30:00Z` (7:30pm AEST 12 May 2026).
-- Guard: `WHERE acquisitionContractDate IS NULL` makes the update idempotent.

UPDATE "properties"
SET "acquisitionContractDate" = "purchaseDate"
WHERE "acquisitionContractDate" IS NULL
  AND "purchaseDate" < TIMESTAMP '2026-05-12 09:30:00+00';

-- --------------------------------------------------------------------------
-- 7. One-time safe backfill — `LegalEntity.trustType`
-- --------------------------------------------------------------------------
-- Phase 41a's `LegalEntityType.DISCRETIONARY_TRUST` is unambiguous — those
-- entities are exactly discretionary trusts, so backfill `trustType` =
-- DISCRETIONARY without user confirmation. Other trust subtypes (UNIT,
-- CHARITABLE, etc.) need user confirmation in the entity-detail UI; until
-- set, engine treats as OTHER + surfaces UC-TRUST-TYPE-UNKNOWN.

UPDATE "legal_entities"
SET "trustType" = 'DISCRETIONARY'
WHERE "trustType" IS NULL
  AND "type" = 'DISCRETIONARY_TRUST';

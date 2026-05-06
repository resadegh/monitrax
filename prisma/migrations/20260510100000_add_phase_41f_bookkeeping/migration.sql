-- Phase 41f.1 — Personal Bookkeeping Integration (schema migration)
--
-- Implements the schema changes described in
-- docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md §4 + §6.
--
-- Three concerns in one migration:
--   1. Extend the existing `accounting_integrations` table with a scope
--      discriminator (ORG | USER_ENTITY) + nullable user_id +
--      legal_entity_id columns. Replace the original
--      @@unique([organizationId, provider]) with two PARTIAL unique
--      indexes (one per scope). Enforce the XOR invariant via a
--      CHECK constraint.
--   2. Create the new `entity_accounting_snapshots` table — caches the
--      latest BS + P&L + tax-engine inputs per (legalEntityId,
--      fiscalPeriod). Idempotent on overwrite. Keyed for Phase 41e tax
--      engine consumption.
--   3. Create the new `trust_deed_extracted_rules` table — stores the
--      AI-extracted structural reading of a user's existing trust deed
--      PDF. Storage + understanding only per §1.1 scope boundary.
--      EXTRACTED → CONFIRMED | REJECTED lifecycle; tax engines consume
--      CONFIRMED rules only.
--
-- =============================================================================
-- CLAUDE.md §12.11 destructive-write checklist (filled in advance per
-- spec doc §4):
--
-- 1. WHERE clause matches: N/A — pure ALTER TABLE / CREATE INDEX /
--    CREATE TABLE. No row UPDATE / DELETE / UPSERT.
-- 2. Columns overwritten / rows deleted: NONE.
-- 3. Guard ensuring this only mutates rows I created: N/A — schema only.
--    Pre-flight verified zero rows in `accounting_integrations` (no Phase
--    32 portal user has connected accounting yet — confirmed via
--    `lib/portal/services/integrations.ts` callers shipping outside the
--    stub layer).
--
-- The one existing-constraint touch is `ALTER COLUMN organization_id
-- DROP NOT NULL`. This is structurally non-destructive (it relaxes a
-- constraint, doesn't tighten one). The new XOR CHECK constraint
-- catches any malformed insert (an insert with both NULL would have
-- failed the old NOT NULL too; an insert with both set fails the new
-- CHECK).
-- =============================================================================

-- =============================================================================
-- 1. NEW ENUMS
-- =============================================================================

CREATE TYPE "AccountingIntegrationScope" AS ENUM (
  'ORG',
  'USER_ENTITY'
);

CREATE TYPE "TrustDeedRuleStatus" AS ENUM (
  'EXTRACTED',
  'CONFIRMED',
  'REJECTED'
);

-- =============================================================================
-- 2. EXTEND accounting_integrations TABLE
-- =============================================================================

-- 2a. Add the new columns. `scope` defaults to 'ORG' so existing rows
-- (if any — pre-flight expects zero) continue to behave as Phase 32
-- portal integrations.
ALTER TABLE "accounting_integrations"
  ADD COLUMN "scope" "AccountingIntegrationScope" NOT NULL DEFAULT 'ORG',
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "legalEntityId" TEXT;

-- 2b. Make organizationId nullable. Pre-existing Phase 32 rows (if any)
-- already satisfy organization_id IS NOT NULL; this loosen does not
-- mutate any row.
ALTER TABLE "accounting_integrations"
  ALTER COLUMN "organizationId" DROP NOT NULL;

-- 2c. Drop the original full-table unique constraint. The replacement
-- partial unique indexes ship in step 2d. Naming follows the Prisma
-- convention `<table>_<col1>_<col2>_key`.
DROP INDEX IF EXISTS "accounting_integrations_organizationId_provider_key";

-- 2d. Add per-scope partial unique indexes. Postgres supports
-- partial-index uniqueness; Prisma cannot model `WHERE` clauses on
-- @@unique so this is raw SQL.
CREATE UNIQUE INDEX "accounting_integrations_org_provider_uniq"
  ON "accounting_integrations" ("organizationId", "provider")
  WHERE "scope" = 'ORG';

CREATE UNIQUE INDEX "accounting_integrations_entity_provider_uniq"
  ON "accounting_integrations" ("legalEntityId", "provider")
  WHERE "scope" = 'USER_ENTITY';

-- 2e. XOR invariant: exactly one of (organizationId) or (userId +
-- legalEntityId) is set per row, matching `scope`.
ALTER TABLE "accounting_integrations"
  ADD CONSTRAINT "accounting_integration_scope_check"
  CHECK (
    (
      "scope" = 'ORG'
      AND "organizationId" IS NOT NULL
      AND "userId" IS NULL
      AND "legalEntityId" IS NULL
    )
    OR
    (
      "scope" = 'USER_ENTITY'
      AND "organizationId" IS NULL
      AND "userId" IS NOT NULL
      AND "legalEntityId" IS NOT NULL
    )
  );

-- 2f. Foreign keys for the new columns. ON DELETE CASCADE so
-- deleting a User or LegalEntity cleans up their connections.
ALTER TABLE "accounting_integrations"
  ADD CONSTRAINT "accounting_integrations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "accounting_integrations"
  ADD CONSTRAINT "accounting_integrations_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 2g. Indexes for the new columns + scope discriminator.
CREATE INDEX "accounting_integrations_userId_idx"
  ON "accounting_integrations" ("userId");

CREATE INDEX "accounting_integrations_legalEntityId_idx"
  ON "accounting_integrations" ("legalEntityId");

CREATE INDEX "accounting_integrations_scope_idx"
  ON "accounting_integrations" ("scope");

-- =============================================================================
-- 3. NEW TABLE: entity_accounting_snapshots
-- =============================================================================

CREATE TABLE "entity_accounting_snapshots" (
  "id" TEXT NOT NULL,
  "legalEntityId" TEXT NOT NULL,

  -- Provenance
  "sourceProvider" "AccountingProvider" NOT NULL,
  "sourceTenantId" TEXT NOT NULL,
  "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pulledByUserId" TEXT NOT NULL,

  -- Period
  "fiscalPeriod" TEXT NOT NULL,
  "periodStartDate" TIMESTAMP(3) NOT NULL,
  "periodEndDate" TIMESTAMP(3) NOT NULL,

  -- Balance Sheet
  "totalAssets" DECIMAL(18, 2) NOT NULL,
  "totalLiabilities" DECIMAL(18, 2) NOT NULL,
  "totalEquity" DECIMAL(18, 2) NOT NULL,
  "cashAndEquivalents" DECIMAL(18, 2),
  "tradeReceivables" DECIMAL(18, 2),
  "inventoryValue" DECIMAL(18, 2),
  "fixedAssetsNet" DECIMAL(18, 2),
  "tradePayables" DECIMAL(18, 2),
  "shortTermDebt" DECIMAL(18, 2),
  "longTermDebt" DECIMAL(18, 2),
  "retainedEarnings" DECIMAL(18, 2),

  -- P&L Summary
  "revenue" DECIMAL(18, 2) NOT NULL,
  "costOfGoodsSold" DECIMAL(18, 2),
  "operatingExpenses" DECIMAL(18, 2) NOT NULL,
  "netProfitBeforeTax" DECIMAL(18, 2) NOT NULL,
  "taxExpense" DECIMAL(18, 2),
  "netProfitAfterTax" DECIMAL(18, 2) NOT NULL,
  "depreciation" DECIMAL(18, 2),
  "interest" DECIMAL(18, 2),

  -- Tax-engine inputs
  "distributableSurplus" DECIMAL(18, 2),
  "trustNetIncome" DECIMAL(18, 2),
  "smsfMemberBalances" JSONB,

  -- Forensic
  "rawProviderPayload" JSONB NOT NULL,

  -- Timestamps
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "entity_accounting_snapshots_pkey" PRIMARY KEY ("id")
);

-- Idempotent overwrite key — pulling the same period overwrites the row.
CREATE UNIQUE INDEX "entity_accounting_snapshots_legalEntityId_fiscalPeriod_key"
  ON "entity_accounting_snapshots" ("legalEntityId", "fiscalPeriod");

CREATE INDEX "entity_accounting_snapshots_legalEntityId_idx"
  ON "entity_accounting_snapshots" ("legalEntityId");

CREATE INDEX "entity_accounting_snapshots_sourceProvider_idx"
  ON "entity_accounting_snapshots" ("sourceProvider");

CREATE INDEX "entity_accounting_snapshots_pulledAt_idx"
  ON "entity_accounting_snapshots" ("pulledAt");

ALTER TABLE "entity_accounting_snapshots"
  ADD CONSTRAINT "entity_accounting_snapshots_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- =============================================================================
-- 4. NEW TABLE: trust_deed_extracted_rules
-- =============================================================================
--
-- Storage + understanding only (per spec doc §1.1 scope boundary).
-- Monitrax does NOT generate / draft / modify trust deeds. We store
-- the user's existing PDF (Phase 26 vault), extract structural rules
-- via OCR + Gemini, and persist them here for the user to confirm.
-- Phase 41e.4 (Div 6E streaming) and 41e.5 (s100A zone classifier)
-- consume CONFIRMED rules only.

CREATE TABLE "trust_deed_extracted_rules" (
  "id" TEXT NOT NULL,
  "legalEntityId" TEXT NOT NULL,

  -- Provenance
  "uploadedDocumentId" TEXT NOT NULL,
  "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "extractorVersion" TEXT NOT NULL,
  "extractedByUserId" TEXT NOT NULL,

  -- Lifecycle (4-step confirm-before-apply per D-41F-3)
  "status" "TrustDeedRuleStatus" NOT NULL DEFAULT 'EXTRACTED',
  "confirmedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,

  -- Extracted rules (typed JSON; Zod-validated at write time)
  "beneficiaries" JSONB NOT NULL,
  "distributionRules" JSONB NOT NULL,
  "vestingDate" TIMESTAMP(3),
  "trusteePower" JSONB,
  "loanProvisions" JSONB,
  "uncomputedNotes" JSONB NOT NULL,

  -- Forensic
  "rawExtractorPayload" JSONB NOT NULL,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "trust_deed_extracted_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trust_deed_extracted_rules_legalEntityId_idx"
  ON "trust_deed_extracted_rules" ("legalEntityId");

CREATE INDEX "trust_deed_extracted_rules_status_idx"
  ON "trust_deed_extracted_rules" ("status");

ALTER TABLE "trust_deed_extracted_rules"
  ADD CONSTRAINT "trust_deed_extracted_rules_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

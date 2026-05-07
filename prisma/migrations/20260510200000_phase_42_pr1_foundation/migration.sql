-- Phase 42 PR1 — Consumer Bookkeeping Foundation
--
-- Adds the schema scaffold for Phase 42 (XERO-complementary consumer
-- bookkeeping). Spec: docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md.
--
-- All operations in this migration are ADDITIVE:
--   - CREATE TYPE (new enum)
--   - CREATE TABLE × 3 (new models)
--   - ALTER TABLE ... ADD COLUMN (nullable, no default)
--   - UPDATE backfill (writes to a column that did not exist before this
--     migration — no existing user data is overwritten; §12.11 disclosure
--     in the PR description for the backfill UPDATE)
--   - CREATE INDEX (non-unique partial). The matching UNIQUE promotion is
--     deferred to PR1.1 after a one-time prod audit confirms zero existing
--     duplicates in the QIF/CSV/OFX subset.
--
-- No DROP. No destructive ALTER. CLAUDE.md §12.11 N/A for the schema-level
-- ops; the backfill UPDATE is disclosed in the PR body.

-- 1. New enum -----------------------------------------------------------------
CREATE TYPE "BookkeepingPeriodStatus" AS ENUM ('OPEN', 'REVIEWED', 'LOCKED');

-- 2. CanonicalCategoryRegistry -----------------------------------------------
CREATE TABLE "canonical_category_registry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level1" TEXT NOT NULL,
    "level2" TEXT,
    "subcategory" TEXT,
    "type" "CategoryType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "customCategoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "taxCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canonical_category_registry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "canonical_category_registry_userId_level1_level2_subcategor_key"
    ON "canonical_category_registry"("userId", "level1", "level2", "subcategory");
CREATE INDEX "canonical_category_registry_userId_idx"
    ON "canonical_category_registry"("userId");
CREATE INDEX "canonical_category_registry_userId_type_idx"
    ON "canonical_category_registry"("userId", "type");

ALTER TABLE "canonical_category_registry"
    ADD CONSTRAINT "canonical_category_registry_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. BookkeepingPeriod -------------------------------------------------------
CREATE TABLE "bookkeeping_periods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "status" "BookkeepingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedAt" TIMESTAMP(3),
    "reviewedTransactionCount" INTEGER NOT NULL DEFAULT 0,
    "totalTransactionCount" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookkeeping_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bookkeeping_periods_userId_periodMonth_key"
    ON "bookkeeping_periods"("userId", "periodMonth");
CREATE INDEX "bookkeeping_periods_userId_status_idx"
    ON "bookkeeping_periods"("userId", "status");

ALTER TABLE "bookkeeping_periods"
    ADD CONSTRAINT "bookkeeping_periods_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. TransactionEdit (per-mutation audit) ------------------------------------
CREATE TABLE "transaction_edits" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "editType" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_edits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transaction_edits_transactionId_idx"
    ON "transaction_edits"("transactionId");
CREATE INDEX "transaction_edits_userId_editedAt_idx"
    ON "transaction_edits"("userId", "editedAt");

ALTER TABLE "transaction_edits"
    ADD CONSTRAINT "transaction_edits_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. UnifiedTransaction.normalisedDescriptionHash ---------------------------
-- Nullable; backfilled below. Phase 42 PR1.1 will promote (accountId, date,
-- amount, normalisedDescriptionHash) to UNIQUE for QIF/CSV/OFX rows after
-- a prod-audit pass.
ALTER TABLE "unified_transactions"
    ADD COLUMN "normalisedDescriptionHash" TEXT;

-- Deterministic backfill — must match `lib/bookkeeping/normaliseDescription.ts`.
-- Mirror logic:
--   1. lower(coalesce(merchantStandardised, description, ''))
--   2. regexp_replace non-alphanumeric → space
--   3. regexp_replace whitespace+ → single space
--   4. trim
--   5. left(., 64)
--   6. md5
-- Only QIF / CSV / OFX rows need the hash (BASIQ has its own canonical key,
-- MANUAL is user-explicit).
UPDATE "unified_transactions"
SET "normalisedDescriptionHash" = md5(
    left(
        regexp_replace(
            regexp_replace(
                lower(coalesce("merchantStandardised", "description", '')),
                '[^a-z0-9]+', ' ', 'g'
            ),
            '\s+', ' ', 'g'
        ),
        64
    )
)
WHERE "source" IN ('QIF', 'CSV', 'OFX')
  AND "normalisedDescriptionHash" IS NULL;

-- Non-unique partial index. The dedup *check* lives at the API layer in
-- `lib/bookkeeping/normaliseDescription.ts`. Promotion to UNIQUE is queued
-- under Phase 42 PR1.1 (after prod audit confirms zero existing duplicates).
CREATE INDEX "ut_dedup_qif_csv_ofx"
    ON "unified_transactions"("accountId", "date", "amount", "normalisedDescriptionHash")
    WHERE "source" IN ('QIF', 'CSV', 'OFX');

-- Phase 12 twin-track (2026-04-15): add EntrySource enum + source column
-- to 9 financial entity models.
--
-- Consumer: the refined /dashboard/setup page reads `source` to decide
-- whether to render an "Estimated" badge (source = 'ONBOARDING') or
-- "Verified" (anything else). The new /onboarding wizard writes rows
-- with source = 'ONBOARDING' so it never overwrites real financial data.
--
-- This migration is strictly additive and safe to roll forward without
-- code changes:
--   * No existing code reads the `source` column, so existing queries,
--     services, and dashboard widgets keep working identically.
--   * All existing rows get the default value 'MANUAL', which accurately
--     reflects their provenance (every row pre-migration was entered via
--     the legacy wizard bulk-create or the per-entity manual dialogs).
--   * No rows are updated, deleted, or modified — only a new column added.
--
-- See docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md §3 for the data
-- model strategy and §11 R1 for the rollback risk assessment.

-- =============================================================================
-- Step 1: Create the EntrySource enum type
-- =============================================================================

CREATE TYPE "EntrySource" AS ENUM (
  'ONBOARDING',  -- Written by the /onboarding wizard (estimated, low confidence)
  'MANUAL',      -- Written by the user via /dashboard/setup or entity dialogs
  'BASIQ',       -- Imported from Basiq Open Banking
  'IMPORT',      -- Imported from CSV / OFX / QIF file
  'CALCULATED'   -- Derived by a system engine
);

-- =============================================================================
-- Step 2: Add `source` column to each of the 9 financial entity tables
-- =============================================================================
-- Column is NOT NULL with a default of 'MANUAL'. Existing rows are backfilled
-- to 'MANUAL' automatically via the default. No separate UPDATE needed.

-- Property
ALTER TABLE "properties"
  ADD COLUMN "source" "EntrySource" NOT NULL DEFAULT 'MANUAL';

-- Loan
ALTER TABLE "loans"
  ADD COLUMN "source" "EntrySource" NOT NULL DEFAULT 'MANUAL';

-- Account — note: distinct from the existing `balanceSource` column, which
-- tracks provenance of the BALANCE VALUE. `source` tracks provenance of the
-- ROW ITSELF. Both columns coexist.
ALTER TABLE "accounts"
  ADD COLUMN "source" "EntrySource" NOT NULL DEFAULT 'MANUAL';

-- Income — maps to "income" (singular) per schema.prisma @@map directive
ALTER TABLE "income"
  ADD COLUMN "source" "EntrySource" NOT NULL DEFAULT 'MANUAL';

-- Expense
ALTER TABLE "expenses"
  ADD COLUMN "source" "EntrySource" NOT NULL DEFAULT 'MANUAL';

-- InvestmentAccount
ALTER TABLE "investment_accounts"
  ADD COLUMN "source" "EntrySource" NOT NULL DEFAULT 'MANUAL';

-- SuperannuationAccount
ALTER TABLE "superannuation_accounts"
  ADD COLUMN "source" "EntrySource" NOT NULL DEFAULT 'MANUAL';

-- Asset
ALTER TABLE "assets"
  ADD COLUMN "source" "EntrySource" NOT NULL DEFAULT 'MANUAL';

-- HouseholdProfile
ALTER TABLE "household_profiles"
  ADD COLUMN "source" "EntrySource" NOT NULL DEFAULT 'MANUAL';

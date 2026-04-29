-- Sync user_preferences columns with prisma/schema.prisma.
--
-- Why: the production database was originally created outside the Prisma
-- migration workflow (see CLAUDE.md §12.12 — R12 incident note). The
-- 0_init migration is a `SELECT 1;` no-op baseline, so any column added
-- to `model UserPreference` after the baseline never reached prod.
--
-- The current symptom: clicking "Launch dashboard" on the onboarding
-- Review step throws
--   Invalid `prisma.userPreference.upsert()` invocation: The column
--   `taxYear` does not exist in the current database.
-- because bulk-create writes `taxYear` but the column is missing in prod.
--
-- This migration is fully **idempotent** — every statement uses
-- `ADD COLUMN IF NOT EXISTS`, so it is safe to run against any of:
--   * monitrax-db-dev (where the columns probably exist already from
--     historical `prisma db push`) — every statement is a no-op
--   * monitrax-db-prod (where most/all columns are missing) — adds them
--     with the same defaults the schema declares
--
-- Per CLAUDE.md §12.11 this is **not** a destructive write: every
-- statement is `ADD COLUMN ... DEFAULT ...` (or nullable). No DROP,
-- no ALTER ... DROP, no TRUNCATE, no NOT NULL backfill on existing
-- rows. Existing rows take the supplied defaults.

ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "hasSeenGuidedTour" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "tourSkippedAt" TIMESTAMP(3);
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "tourCompletedAt" TIMESTAMP(3);

ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "dismissedOnboardingBadge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "dismissedWelcomeModal" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "preferredCurrency" TEXT NOT NULL DEFAULT 'AUD';
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "preferredDateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY';
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'AU';
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "taxYear" TEXT;

ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "onboardingDraft" JSONB;

ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "emailWeeklyDigest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "emailMonthlyReport" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "emailAlerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "emailProductUpdates" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "pushCashflowAlerts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "pushSpendingAlerts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "pushGoalUpdates" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "pushBillReminders" BOOLEAN NOT NULL DEFAULT false;

-- AlterEnum: add HALF_YEARLY (every 6 months, 2x/year) to the billing-cadence
-- frequency enums. Insurance and many AU bills are commonly paid half-yearly.
-- Additive only (no existing value removed/renamed) → non-destructive.
-- Each ADD VALUE runs outside a transaction (PostgreSQL requirement); Prisma
-- migrate deploy executes these statements without wrapping them in BEGIN/COMMIT.
ALTER TYPE "Frequency" ADD VALUE IF NOT EXISTS 'HALF_YEARLY';
ALTER TYPE "PayFrequency" ADD VALUE IF NOT EXISTS 'HALF_YEARLY';

-- Phase 44.2 slice 2: SMSF franking credit refunds. Additive — one nullable-
-- defaulted column. No DROP, no data mutation; existing rows default to 0
-- (no franking offset, identical to prior behaviour). §12.11 N/A.

-- AlterTable
ALTER TABLE "smsf_annual_returns" ADD COLUMN "frankingCredits" DOUBLE PRECISION NOT NULL DEFAULT 0;

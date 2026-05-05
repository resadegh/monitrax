-- Phase 32C PR6b — Lead-fee invoice integration
--
-- Additive migration. Extends `professional_requests` with Stripe invoice
-- linkage columns + introduces `LeadFeeStatus` enum. CLAUDE.md §12.11 N/A.

-- 1. New enum

CREATE TYPE "LeadFeeStatus" AS ENUM (
  'PENDING_CREATE',
  'PENDING_PAYMENT',
  'PAID',
  'FAILED',
  'VOIDED'
);

-- 2. New columns on professional_requests (all nullable; existing rows
--    untouched and remain in the prior PR4c state where stripeInvoiceId
--    is null and leadFeeStatus is null)

ALTER TABLE "professional_requests"
  ADD COLUMN "stripeInvoiceId"   TEXT,
  ADD COLUMN "leadFeeStatus"     "LeadFeeStatus",
  ADD COLUMN "leadFeeInvoiceUrl" TEXT,
  ADD COLUMN "leadFeePaidAt"     TIMESTAMP(3),
  ADD COLUMN "leadFeeFailedAt"   TIMESTAMP(3);

CREATE UNIQUE INDEX "professional_requests_stripeInvoiceId_key"
  ON "professional_requests"("stripeInvoiceId");

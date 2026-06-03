-- Q-DEC PR 1.5 (Phase 45 gate): additive Decimal sibling columns for the
-- supplementary money-bearing models that Q-DEC PR 1 deferred. Same
-- additive pattern as PR 1 (PR #974 merged 2026-06-03). 7 models, ~23
-- columns. After this PR, every Float money column the engines compose
-- has a Decimal sibling. Q-DEC PR 2 (adapter layer) can then begin.
--
-- Models in scope (per @@map):
--   transactions, investment_transactions, capital_gain_events,
--   capital_gain_lot_allocations, recurring_payments,
--   smsf_annual_returns, super_contributions
--
-- Models OUT of scope:
--   - Phase 41E models (distribution_resolutions, distribution_allocations,
--     dividend_distributions, dividend_payments, private_company_benefits)
--     are ALREADY Decimal — built fresh in Phase 41E + Phase 44 per
--     CLAUDE.md §0 with Decimal from day one. Nothing to migrate.
--   - tax_positions: derived cache layer (not user-input). Can be added
--     in a follow-up if engine cutover proves it matters; out of scope
--     for the precision-foundation gate.
--
-- Pattern per column (idempotent — re-runnable):
--   ALTER TABLE "..." ADD COLUMN IF NOT EXISTS "x_decimal" DECIMAL(19, 4);
--   UPDATE "..." SET "x_decimal" = "x"::DECIMAL(19, 4) WHERE "x_decimal" IS NULL;
--
-- CLAUDE.md compliance:
--   - §12.11 destructive-write checklist: N/A — additive only. Backfill
--     writes only to new *_decimal columns. No DROP, no overwrite.
--   - §12.12 schema-change deploy protocol: migration file ships in same
--     PR as the schema.prisma change. `prisma migrate deploy` runs on
--     Vercel build for preview (monitrax-db-dev) + production
--     (monitrax-db-prod). Migration failure aborts the deploy.
--   - §16 doc-sync: workstream 0·WI in IMPLEMENTATION_PLAN.md + Phase
--     45 spec doc + this day's CHANGELOG.
--
-- Table-name discipline (lesson from PR 1's `incomes` typo): every
-- @@map verified BEFORE writing SQL via grep on the schema. All 7
-- targets confirmed plural.

-- =============================================================================
-- Transaction (transactions)
-- =============================================================================
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "amountDecimal" DECIMAL(19, 4);

UPDATE "transactions" SET "amountDecimal" = "amount"::DECIMAL(19, 4)
 WHERE "amountDecimal" IS NULL;

-- =============================================================================
-- InvestmentTransaction (investment_transactions)
-- =============================================================================
ALTER TABLE "investment_transactions" ADD COLUMN IF NOT EXISTS "priceDecimal" DECIMAL(19, 4);
ALTER TABLE "investment_transactions" ADD COLUMN IF NOT EXISTS "unitsDecimal" DECIMAL(19, 4);
ALTER TABLE "investment_transactions" ADD COLUMN IF NOT EXISTS "feesDecimal" DECIMAL(19, 4);
ALTER TABLE "investment_transactions" ADD COLUMN IF NOT EXISTS "totalAmountDecimal" DECIMAL(19, 4);

UPDATE "investment_transactions" SET "priceDecimal" = "price"::DECIMAL(19, 4)               WHERE "priceDecimal" IS NULL;
UPDATE "investment_transactions" SET "unitsDecimal" = "units"::DECIMAL(19, 4)               WHERE "unitsDecimal" IS NULL;
UPDATE "investment_transactions" SET "feesDecimal" = "fees"::DECIMAL(19, 4)                 WHERE "feesDecimal" IS NULL AND "fees" IS NOT NULL;
UPDATE "investment_transactions" SET "totalAmountDecimal" = "totalAmount"::DECIMAL(19, 4)   WHERE "totalAmountDecimal" IS NULL AND "totalAmount" IS NOT NULL;

-- =============================================================================
-- CapitalGainEvent (capital_gain_events)
-- =============================================================================
ALTER TABLE "capital_gain_events" ADD COLUMN IF NOT EXISTS "unitsSoldDecimal" DECIMAL(19, 4);
ALTER TABLE "capital_gain_events" ADD COLUMN IF NOT EXISTS "salePriceDecimal" DECIMAL(19, 4);
ALTER TABLE "capital_gain_events" ADD COLUMN IF NOT EXISTS "saleFeesDecimal" DECIMAL(19, 4);
ALTER TABLE "capital_gain_events" ADD COLUMN IF NOT EXISTS "grossProceedsDecimal" DECIMAL(19, 4);
ALTER TABLE "capital_gain_events" ADD COLUMN IF NOT EXISTS "totalCostBasisDecimal" DECIMAL(19, 4);
ALTER TABLE "capital_gain_events" ADD COLUMN IF NOT EXISTS "capitalGainDecimal" DECIMAL(19, 4);
ALTER TABLE "capital_gain_events" ADD COLUMN IF NOT EXISTS "cgtDiscountDecimal" DECIMAL(19, 4);
ALTER TABLE "capital_gain_events" ADD COLUMN IF NOT EXISTS "taxableGainDecimal" DECIMAL(19, 4);

UPDATE "capital_gain_events" SET "unitsSoldDecimal" = "unitsSold"::DECIMAL(19, 4)             WHERE "unitsSoldDecimal" IS NULL;
UPDATE "capital_gain_events" SET "salePriceDecimal" = "salePrice"::DECIMAL(19, 4)             WHERE "salePriceDecimal" IS NULL;
UPDATE "capital_gain_events" SET "saleFeesDecimal" = "saleFees"::DECIMAL(19, 4)               WHERE "saleFeesDecimal" IS NULL;
UPDATE "capital_gain_events" SET "grossProceedsDecimal" = "grossProceeds"::DECIMAL(19, 4)     WHERE "grossProceedsDecimal" IS NULL;
UPDATE "capital_gain_events" SET "totalCostBasisDecimal" = "totalCostBasis"::DECIMAL(19, 4)   WHERE "totalCostBasisDecimal" IS NULL;
UPDATE "capital_gain_events" SET "capitalGainDecimal" = "capitalGain"::DECIMAL(19, 4)         WHERE "capitalGainDecimal" IS NULL;
UPDATE "capital_gain_events" SET "cgtDiscountDecimal" = "cgtDiscount"::DECIMAL(19, 4)         WHERE "cgtDiscountDecimal" IS NULL;
UPDATE "capital_gain_events" SET "taxableGainDecimal" = "taxableGain"::DECIMAL(19, 4)         WHERE "taxableGainDecimal" IS NULL;

-- =============================================================================
-- CapitalGainLotAllocation (capital_gain_lot_allocations)
-- =============================================================================
ALTER TABLE "capital_gain_lot_allocations" ADD COLUMN IF NOT EXISTS "unitsAllocatedDecimal" DECIMAL(19, 4);
ALTER TABLE "capital_gain_lot_allocations" ADD COLUMN IF NOT EXISTS "costBasisAllocatedDecimal" DECIMAL(19, 4);

UPDATE "capital_gain_lot_allocations" SET "unitsAllocatedDecimal" = "unitsAllocated"::DECIMAL(19, 4)         WHERE "unitsAllocatedDecimal" IS NULL;
UPDATE "capital_gain_lot_allocations" SET "costBasisAllocatedDecimal" = "costBasisAllocated"::DECIMAL(19, 4) WHERE "costBasisAllocatedDecimal" IS NULL;

-- =============================================================================
-- RecurringPayment (recurring_payments)
-- =============================================================================
ALTER TABLE "recurring_payments" ADD COLUMN IF NOT EXISTS "expectedAmountDecimal" DECIMAL(19, 4);
ALTER TABLE "recurring_payments" ADD COLUMN IF NOT EXISTS "lastPriceChangeDecimal" DECIMAL(19, 4);

UPDATE "recurring_payments" SET "expectedAmountDecimal" = "expectedAmount"::DECIMAL(19, 4)   WHERE "expectedAmountDecimal" IS NULL;
UPDATE "recurring_payments" SET "lastPriceChangeDecimal" = "lastPriceChange"::DECIMAL(19, 4) WHERE "lastPriceChangeDecimal" IS NULL AND "lastPriceChange" IS NOT NULL;

-- =============================================================================
-- SmsfAnnualReturn (smsf_annual_returns)
-- =============================================================================
ALTER TABLE "smsf_annual_returns" ADD COLUMN IF NOT EXISTS "assessableInvestmentIncomeDecimal" DECIMAL(19, 4);
ALTER TABLE "smsf_annual_returns" ADD COLUMN IF NOT EXISTS "deductionsDecimal" DECIMAL(19, 4);
ALTER TABLE "smsf_annual_returns" ADD COLUMN IF NOT EXISTS "assessableContributionsDecimal" DECIMAL(19, 4);
ALTER TABLE "smsf_annual_returns" ADD COLUMN IF NOT EXISTS "nonArmsLengthIncomeDecimal" DECIMAL(19, 4);
ALTER TABLE "smsf_annual_returns" ADD COLUMN IF NOT EXISTS "frankingCreditsDecimal" DECIMAL(19, 4);

UPDATE "smsf_annual_returns" SET "assessableInvestmentIncomeDecimal" = "assessableInvestmentIncome"::DECIMAL(19, 4) WHERE "assessableInvestmentIncomeDecimal" IS NULL;
UPDATE "smsf_annual_returns" SET "deductionsDecimal" = "deductions"::DECIMAL(19, 4)                                 WHERE "deductionsDecimal" IS NULL;
UPDATE "smsf_annual_returns" SET "assessableContributionsDecimal" = "assessableContributions"::DECIMAL(19, 4)       WHERE "assessableContributionsDecimal" IS NULL;
UPDATE "smsf_annual_returns" SET "nonArmsLengthIncomeDecimal" = "nonArmsLengthIncome"::DECIMAL(19, 4)               WHERE "nonArmsLengthIncomeDecimal" IS NULL;
UPDATE "smsf_annual_returns" SET "frankingCreditsDecimal" = "frankingCredits"::DECIMAL(19, 4)                       WHERE "frankingCreditsDecimal" IS NULL;

-- =============================================================================
-- SuperContribution (super_contributions)
-- =============================================================================
ALTER TABLE "super_contributions" ADD COLUMN IF NOT EXISTS "amountDecimal" DECIMAL(19, 4);

UPDATE "super_contributions" SET "amountDecimal" = "amount"::DECIMAL(19, 4) WHERE "amountDecimal" IS NULL;

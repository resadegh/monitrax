-- Q-DEC PR 4 — drop the DORMANT Decimal sibling columns (audit 2026-06-07).
--
-- ============================================================================
-- WHY THIS IS THE INVERSE OF WHAT THE PLAN ORIGINALLY DOCUMENTED
-- ============================================================================
-- Q-DEC was originally documented as "PR 4 drops the Float columns after a
-- 7-day parallel-run shows zero diff." Audit 2026-06-07 (Q-DEC follow-up,
-- ahead of Phase 45 PR 1) revealed the actual code state:
--
--   - Engines read Float from Prisma (single source of truth at the data
--     layer).
--   - Engines IMMEDIATELY convert via `toDecimal(float)` at the engine
--     boundary (`lib/calculations/*.ts`, `lib/cfo/scenarios/*.ts`).
--   - All arithmetic happens in Decimal precision from there.
--   - The `*Decimal` schema columns added by Q-DEC PR 1/1.5 are POPULATED
--     by the migration backfill but NEVER READ.
--
-- Verification (Grep over `lib/`, `app/`, `components/`, `tests/`):
--   - ZERO `.purchasePriceDecimal` / `.currentBalanceDecimal` /
--     `.principalDecimal` / `.amountDecimal` reads.
--   - ZERO Prisma `select: { *Decimal: true }` clauses.
--   - Function names like `getGrossAmountDecimal()` exist, but these are
--     DECIMAL-PRODUCING FUNCTIONS that read from the FLOAT column via
--     `toDecimal()` — they don't read the schema's `*Decimal` column.
--
-- ============================================================================
-- WHAT THIS MIGRATION DOES
-- ============================================================================
-- Drops 63 dormant `*Decimal` columns across 17 tables. Float columns
-- remain — they are the canonical data layer; Decimal precision is
-- achieved at the engine boundary via `toDecimal()`. This brings the
-- schema into line with the actual code state and removes ~3-4 GB of
-- dead duplicate storage at scale.
--
-- ============================================================================
-- CLAUDE.md COMPLIANCE
-- ============================================================================
--
-- §12.11 destructive-write checklist:
--   1. WHERE clause matches: every row in each table — the DROP COLUMN is
--      schema-level, not row-level. It affects every row that has the
--      column being dropped.
--   2. Columns dropped: 63 `*Decimal` columns listed below. Each column
--      is POPULATED but NOT READ by any application code (verified via
--      Grep — zero matches in `lib/`, `app/`, `components/`, `tests/`).
--      Dropping these columns therefore CANNOT break any caller.
--   3. Guard ensuring this only removes unused data: the verification
--      above. Reza directive 2026-06-07 explicitly authorized "drop the
--      dormant *Decimal columns" after surfacing the audit finding
--      (the originally-planned "drop Float" was structurally incoherent
--      since engines actively read Float).
--   User confirmation: GRANTED 2026-06-07 (Reza via AskUserQuestion —
--   "Drop the DORMANT *Decimal columns (Recommended)" selected).
--
-- §12.12 schema-change deploy protocol:
--   - Migration file ships in the same PR as the `schema.prisma` change
--     (which removes the `*Decimal` field declarations).
--   - `prisma migrate deploy` runs on Vercel build for preview
--     (monitrax-db-dev) and production (monitrax-db-prod). If the
--     migration fails, the deploy aborts and the previous code keeps
--     running on the previous schema.
--   - Migration uses `DROP COLUMN IF EXISTS` so it is idempotent and safe
--     to re-run after a partial failure.
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- These columns were added by:
--   prisma/migrations/20260603120000_q_dec_pr1_additive_decimal_columns
--   prisma/migrations/20260603130000_q_dec_pr1_5_supplementary_decimal_columns
-- If a rollback is needed, re-apply the relevant ALTER TABLE ADD COLUMN
-- statements from those migrations. The backfill UPDATE statements are
-- equally re-applicable: `<field>Decimal = <field>::DECIMAL(19, 4)`.
-- No data is lost since the Float columns retain the canonical values.

-- =============================================================================
-- Property (2 columns)
-- =============================================================================
ALTER TABLE "properties" DROP COLUMN IF EXISTS "purchasePriceDecimal";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "currentValueDecimal";

-- =============================================================================
-- Loan (3 columns)
-- =============================================================================
ALTER TABLE "loans" DROP COLUMN IF EXISTS "principalDecimal";
ALTER TABLE "loans" DROP COLUMN IF EXISTS "minRepaymentDecimal";
ALTER TABLE "loans" DROP COLUMN IF EXISTS "extraRepaymentCapDecimal";

-- =============================================================================
-- Account (2 columns)
-- =============================================================================
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "currentBalanceDecimal";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "lastImportedBalanceDecimal";

-- =============================================================================
-- Income (10 columns)
-- =============================================================================
ALTER TABLE "income" DROP COLUMN IF EXISTS "amountDecimal";
ALTER TABLE "income" DROP COLUMN IF EXISTS "grossAmountDecimal";
ALTER TABLE "income" DROP COLUMN IF EXISTS "netAmountDecimal";
ALTER TABLE "income" DROP COLUMN IF EXISTS "paygWithholdingDecimal";
ALTER TABLE "income" DROP COLUMN IF EXISTS "superGuaranteeAmountDecimal";
ALTER TABLE "income" DROP COLUMN IF EXISTS "salarySacrificeDecimal";
ALTER TABLE "income" DROP COLUMN IF EXISTS "taxableAmountDecimal";
ALTER TABLE "income" DROP COLUMN IF EXISTS "taxExemptAmountDecimal";
ALTER TABLE "income" DROP COLUMN IF EXISTS "frankingCreditsDecimal";
ALTER TABLE "income" DROP COLUMN IF EXISTS "budgetedAmountDecimal";

-- =============================================================================
-- Expense (2 columns)
-- =============================================================================
ALTER TABLE "expenses" DROP COLUMN IF EXISTS "amountDecimal";
ALTER TABLE "expenses" DROP COLUMN IF EXISTS "budgetedAmountDecimal";

-- =============================================================================
-- Transaction (1 column)
-- =============================================================================
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "amountDecimal";

-- =============================================================================
-- InvestmentAccount (1 column)
-- =============================================================================
ALTER TABLE "investment_accounts" DROP COLUMN IF EXISTS "totalWithdrawalsDecimal";

-- =============================================================================
-- InvestmentHolding (6 columns)
-- =============================================================================
ALTER TABLE "investment_holdings" DROP COLUMN IF EXISTS "unitsDecimal";
ALTER TABLE "investment_holdings" DROP COLUMN IF EXISTS "averagePriceDecimal";
ALTER TABLE "investment_holdings" DROP COLUMN IF EXISTS "totalCostBasisDecimal";
ALTER TABLE "investment_holdings" DROP COLUMN IF EXISTS "currentPriceDecimal";
ALTER TABLE "investment_holdings" DROP COLUMN IF EXISTS "currentValueDecimal";
ALTER TABLE "investment_holdings" DROP COLUMN IF EXISTS "unrealizedGainDecimal";

-- =============================================================================
-- InvestmentTransaction (4 columns)
-- =============================================================================
ALTER TABLE "investment_transactions" DROP COLUMN IF EXISTS "priceDecimal";
ALTER TABLE "investment_transactions" DROP COLUMN IF EXISTS "unitsDecimal";
ALTER TABLE "investment_transactions" DROP COLUMN IF EXISTS "feesDecimal";
ALTER TABLE "investment_transactions" DROP COLUMN IF EXISTS "totalAmountDecimal";

-- =============================================================================
-- PurchaseLot (5 columns)
-- =============================================================================
ALTER TABLE "purchase_lots" DROP COLUMN IF EXISTS "unitsDecimal";
ALTER TABLE "purchase_lots" DROP COLUMN IF EXISTS "unitCostDecimal";
ALTER TABLE "purchase_lots" DROP COLUMN IF EXISTS "totalCostDecimal";
ALTER TABLE "purchase_lots" DROP COLUMN IF EXISTS "feesDecimal";
ALTER TABLE "purchase_lots" DROP COLUMN IF EXISTS "unitsRemainingDecimal";

-- =============================================================================
-- CapitalGainEvent (8 columns)
-- =============================================================================
ALTER TABLE "capital_gain_events" DROP COLUMN IF EXISTS "unitsSoldDecimal";
ALTER TABLE "capital_gain_events" DROP COLUMN IF EXISTS "salePriceDecimal";
ALTER TABLE "capital_gain_events" DROP COLUMN IF EXISTS "saleFeesDecimal";
ALTER TABLE "capital_gain_events" DROP COLUMN IF EXISTS "grossProceedsDecimal";
ALTER TABLE "capital_gain_events" DROP COLUMN IF EXISTS "totalCostBasisDecimal";
ALTER TABLE "capital_gain_events" DROP COLUMN IF EXISTS "capitalGainDecimal";
ALTER TABLE "capital_gain_events" DROP COLUMN IF EXISTS "cgtDiscountDecimal";
ALTER TABLE "capital_gain_events" DROP COLUMN IF EXISTS "taxableGainDecimal";

-- =============================================================================
-- CapitalGainLotAllocation (2 columns)
-- =============================================================================
ALTER TABLE "capital_gain_lot_allocations" DROP COLUMN IF EXISTS "unitsAllocatedDecimal";
ALTER TABLE "capital_gain_lot_allocations" DROP COLUMN IF EXISTS "costBasisAllocatedDecimal";

-- =============================================================================
-- RecurringPayment (2 columns)
-- =============================================================================
ALTER TABLE "recurring_payments" DROP COLUMN IF EXISTS "expectedAmountDecimal";
ALTER TABLE "recurring_payments" DROP COLUMN IF EXISTS "lastPriceChangeDecimal";

-- =============================================================================
-- SuperannuationAccount (8 columns)
-- =============================================================================
ALTER TABLE "superannuation_accounts" DROP COLUMN IF EXISTS "currentBalanceDecimal";
ALTER TABLE "superannuation_accounts" DROP COLUMN IF EXISTS "taxableComponentDecimal";
ALTER TABLE "superannuation_accounts" DROP COLUMN IF EXISTS "taxFreeComponentDecimal";
ALTER TABLE "superannuation_accounts" DROP COLUMN IF EXISTS "concessionalYTDDecimal";
ALTER TABLE "superannuation_accounts" DROP COLUMN IF EXISTS "nonConcessionalYTDDecimal";
ALTER TABLE "superannuation_accounts" DROP COLUMN IF EXISTS "concessionalCapDecimal";
ALTER TABLE "superannuation_accounts" DROP COLUMN IF EXISTS "nonConcessionalCapDecimal";
ALTER TABLE "superannuation_accounts" DROP COLUMN IF EXISTS "carryForwardAvailableDecimal";

-- =============================================================================
-- SmsfAnnualReturn (5 columns)
-- =============================================================================
ALTER TABLE "smsf_annual_returns" DROP COLUMN IF EXISTS "assessableInvestmentIncomeDecimal";
ALTER TABLE "smsf_annual_returns" DROP COLUMN IF EXISTS "deductionsDecimal";
ALTER TABLE "smsf_annual_returns" DROP COLUMN IF EXISTS "assessableContributionsDecimal";
ALTER TABLE "smsf_annual_returns" DROP COLUMN IF EXISTS "nonArmsLengthIncomeDecimal";
ALTER TABLE "smsf_annual_returns" DROP COLUMN IF EXISTS "frankingCreditsDecimal";

-- =============================================================================
-- SuperContribution (1 column)
-- =============================================================================
ALTER TABLE "super_contributions" DROP COLUMN IF EXISTS "amountDecimal";

-- =============================================================================
-- Asset (4 columns)
-- =============================================================================
ALTER TABLE "assets" DROP COLUMN IF EXISTS "purchasePriceDecimal";
ALTER TABLE "assets" DROP COLUMN IF EXISTS "currentValueDecimal";
ALTER TABLE "assets" DROP COLUMN IF EXISTS "salePriceDecimal";
ALTER TABLE "assets" DROP COLUMN IF EXISTS "residualValueDecimal";

-- =============================================================================
-- VERIFICATION (post-migration)
-- =============================================================================
-- Run the following to confirm no `*Decimal` columns remain (excluding the
-- handful of ORIGINAL Decimal columns that were never Float duals — e.g.
-- LegalEntity.sharePct (9, 6), DistributionAllocation.streamed* (19, 4),
-- Phase 41E company financial fields (18, 2), ProfessionalListing.averageRating
-- (3, 2)):
--
--   SELECT table_name, column_name
--     FROM information_schema.columns
--    WHERE column_name LIKE '%Decimal'
--      AND table_schema = 'public'
--    ORDER BY table_name, column_name;
--
-- Expected: zero rows. (All 63 Q-DEC duals dropped; the original Decimal
-- columns don't carry a `Decimal` name suffix.)

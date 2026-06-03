-- Q-DEC PR 1 (Phase 45 gate): additive Decimal sibling columns for every
-- money-bearing Float field on the 10 core models that Phase 45's five
-- levers compose (refinance / salary-sacrifice / sell property / extra
-- debt repayment / buy investment property).
--
-- Pattern per column:
--   1. ALTER TABLE ... ADD COLUMN ..._decimal DECIMAL(19, 4) — nullable.
--   2. UPDATE ... SET ..._decimal = ...::DECIMAL(19, 4) WHERE ..._decimal IS NULL
--      — idempotent backfill (re-running the migration is a no-op).
--
-- Engines still WRITE to the Float columns in PR 1 and PR 2. PR 2 adds
-- the Prisma.Decimal adapter layer at engine boundaries. PR 3 cuts the
-- engines over to write Decimal alongside Float (parallel-run for the
-- shadow-comparison harness). PR 4 drops the Float columns after a 7-day
-- parallel-run shows zero diff.
--
-- CLAUDE.md compliance:
--   - §12.11 destructive-write checklist: N/A — additive only. The
--     backfill UPDATE writes only to the new *_decimal column; existing
--     Float data is read but never overwritten. No row deletion, no
--     column drop.
--   - §12.12 schema-change deploy protocol: migration file ships in the
--     same PR as the schema.prisma change. `prisma migrate deploy` runs
--     on Vercel build for both preview (monitrax-db-dev) and production
--     (monitrax-db-prod). If the migration fails, the deploy aborts and
--     the previous code keeps running on the previous schema.
--   - §16 doc-sync: see docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md §5
--     (Q-DEC is the gate) + workstream 0·WI in IMPLEMENTATION_PLAN.md.
--
-- Scope (10 models, ~45 columns):
--   Property, Loan, Account, Income, Expense,
--   InvestmentAccount, InvestmentHolding, PurchaseLot,
--   SuperannuationAccount, Asset.
--
-- Out of scope for this PR (deferred to Q-DEC PR 1.5 — same pattern,
-- separate review): Transaction, RecurringPayment, BudgetCategory,
-- BudgetActual, DistributionAllocation, DividendPayment, the Phase 41E
-- per-FY tax-engine throughput tables (CompanyFyTaxPosition etc.), and
-- the InvestmentTransaction / CapitalGainEvent supplementary rows. These
-- represent ~50 additional columns; bundling them in a single PR creates
-- review fatigue. Phase 45's lever inputs only read the 10 models in PR 1.

-- =============================================================================
-- Property
-- =============================================================================
ALTER TABLE "properties" ADD COLUMN "purchasePriceDecimal" DECIMAL(19, 4);
ALTER TABLE "properties" ADD COLUMN "currentValueDecimal" DECIMAL(19, 4);

UPDATE "properties"
   SET "purchasePriceDecimal" = "purchasePrice"::DECIMAL(19, 4)
 WHERE "purchasePriceDecimal" IS NULL;
UPDATE "properties"
   SET "currentValueDecimal" = "currentValue"::DECIMAL(19, 4)
 WHERE "currentValueDecimal" IS NULL;

-- =============================================================================
-- Loan
-- =============================================================================
ALTER TABLE "loans" ADD COLUMN "principalDecimal" DECIMAL(19, 4);
ALTER TABLE "loans" ADD COLUMN "minRepaymentDecimal" DECIMAL(19, 4);
ALTER TABLE "loans" ADD COLUMN "extraRepaymentCapDecimal" DECIMAL(19, 4);

UPDATE "loans"
   SET "principalDecimal" = "principal"::DECIMAL(19, 4)
 WHERE "principalDecimal" IS NULL;
UPDATE "loans"
   SET "minRepaymentDecimal" = "minRepayment"::DECIMAL(19, 4)
 WHERE "minRepaymentDecimal" IS NULL;
UPDATE "loans"
   SET "extraRepaymentCapDecimal" = "extraRepaymentCap"::DECIMAL(19, 4)
 WHERE "extraRepaymentCapDecimal" IS NULL AND "extraRepaymentCap" IS NOT NULL;

-- =============================================================================
-- Account
-- =============================================================================
ALTER TABLE "accounts" ADD COLUMN "currentBalanceDecimal" DECIMAL(19, 4);
ALTER TABLE "accounts" ADD COLUMN "lastImportedBalanceDecimal" DECIMAL(19, 4);

UPDATE "accounts"
   SET "currentBalanceDecimal" = "currentBalance"::DECIMAL(19, 4)
 WHERE "currentBalanceDecimal" IS NULL;
UPDATE "accounts"
   SET "lastImportedBalanceDecimal" = "lastImportedBalance"::DECIMAL(19, 4)
 WHERE "lastImportedBalanceDecimal" IS NULL AND "lastImportedBalance" IS NOT NULL;

-- =============================================================================
-- Income
-- =============================================================================
ALTER TABLE "incomes" ADD COLUMN "amountDecimal" DECIMAL(19, 4);
ALTER TABLE "incomes" ADD COLUMN "grossAmountDecimal" DECIMAL(19, 4);
ALTER TABLE "incomes" ADD COLUMN "netAmountDecimal" DECIMAL(19, 4);
ALTER TABLE "incomes" ADD COLUMN "paygWithholdingDecimal" DECIMAL(19, 4);
ALTER TABLE "incomes" ADD COLUMN "superGuaranteeAmountDecimal" DECIMAL(19, 4);
ALTER TABLE "incomes" ADD COLUMN "salarySacrificeDecimal" DECIMAL(19, 4);
ALTER TABLE "incomes" ADD COLUMN "taxableAmountDecimal" DECIMAL(19, 4);
ALTER TABLE "incomes" ADD COLUMN "taxExemptAmountDecimal" DECIMAL(19, 4);
ALTER TABLE "incomes" ADD COLUMN "frankingCreditsDecimal" DECIMAL(19, 4);
ALTER TABLE "incomes" ADD COLUMN "budgetedAmountDecimal" DECIMAL(19, 4);

UPDATE "incomes" SET "amountDecimal" = "amount"::DECIMAL(19, 4)                                 WHERE "amountDecimal" IS NULL;
UPDATE "incomes" SET "grossAmountDecimal" = "grossAmount"::DECIMAL(19, 4)                       WHERE "grossAmountDecimal" IS NULL AND "grossAmount" IS NOT NULL;
UPDATE "incomes" SET "netAmountDecimal" = "netAmount"::DECIMAL(19, 4)                           WHERE "netAmountDecimal" IS NULL AND "netAmount" IS NOT NULL;
UPDATE "incomes" SET "paygWithholdingDecimal" = "paygWithholding"::DECIMAL(19, 4)               WHERE "paygWithholdingDecimal" IS NULL AND "paygWithholding" IS NOT NULL;
UPDATE "incomes" SET "superGuaranteeAmountDecimal" = "superGuaranteeAmount"::DECIMAL(19, 4)     WHERE "superGuaranteeAmountDecimal" IS NULL AND "superGuaranteeAmount" IS NOT NULL;
UPDATE "incomes" SET "salarySacrificeDecimal" = "salarySacrifice"::DECIMAL(19, 4)               WHERE "salarySacrificeDecimal" IS NULL AND "salarySacrifice" IS NOT NULL;
UPDATE "incomes" SET "taxableAmountDecimal" = "taxableAmount"::DECIMAL(19, 4)                   WHERE "taxableAmountDecimal" IS NULL AND "taxableAmount" IS NOT NULL;
UPDATE "incomes" SET "taxExemptAmountDecimal" = "taxExemptAmount"::DECIMAL(19, 4)               WHERE "taxExemptAmountDecimal" IS NULL AND "taxExemptAmount" IS NOT NULL;
UPDATE "incomes" SET "frankingCreditsDecimal" = "frankingCredits"::DECIMAL(19, 4)               WHERE "frankingCreditsDecimal" IS NULL AND "frankingCredits" IS NOT NULL;
UPDATE "incomes" SET "budgetedAmountDecimal" = "budgetedAmount"::DECIMAL(19, 4)                 WHERE "budgetedAmountDecimal" IS NULL AND "budgetedAmount" IS NOT NULL;

-- =============================================================================
-- Expense
-- =============================================================================
ALTER TABLE "expenses" ADD COLUMN "amountDecimal" DECIMAL(19, 4);
ALTER TABLE "expenses" ADD COLUMN "budgetedAmountDecimal" DECIMAL(19, 4);

UPDATE "expenses" SET "amountDecimal" = "amount"::DECIMAL(19, 4)                       WHERE "amountDecimal" IS NULL;
UPDATE "expenses" SET "budgetedAmountDecimal" = "budgetedAmount"::DECIMAL(19, 4)       WHERE "budgetedAmountDecimal" IS NULL AND "budgetedAmount" IS NOT NULL;

-- =============================================================================
-- InvestmentAccount
-- =============================================================================
ALTER TABLE "investment_accounts" ADD COLUMN "openingBalanceDecimal" DECIMAL(19, 4);
ALTER TABLE "investment_accounts" ADD COLUMN "cashBalanceDecimal" DECIMAL(19, 4);
ALTER TABLE "investment_accounts" ADD COLUMN "totalDepositsDecimal" DECIMAL(19, 4);
ALTER TABLE "investment_accounts" ADD COLUMN "totalWithdrawalsDecimal" DECIMAL(19, 4);

UPDATE "investment_accounts" SET "openingBalanceDecimal" = "openingBalance"::DECIMAL(19, 4)         WHERE "openingBalanceDecimal" IS NULL;
UPDATE "investment_accounts" SET "cashBalanceDecimal" = "cashBalance"::DECIMAL(19, 4)               WHERE "cashBalanceDecimal" IS NULL;
UPDATE "investment_accounts" SET "totalDepositsDecimal" = "totalDeposits"::DECIMAL(19, 4)           WHERE "totalDepositsDecimal" IS NULL;
UPDATE "investment_accounts" SET "totalWithdrawalsDecimal" = "totalWithdrawals"::DECIMAL(19, 4)     WHERE "totalWithdrawalsDecimal" IS NULL;

-- =============================================================================
-- InvestmentHolding
-- =============================================================================
ALTER TABLE "investment_holdings" ADD COLUMN "unitsDecimal" DECIMAL(19, 4);
ALTER TABLE "investment_holdings" ADD COLUMN "averagePriceDecimal" DECIMAL(19, 4);
ALTER TABLE "investment_holdings" ADD COLUMN "totalCostBasisDecimal" DECIMAL(19, 4);
ALTER TABLE "investment_holdings" ADD COLUMN "currentPriceDecimal" DECIMAL(19, 4);
ALTER TABLE "investment_holdings" ADD COLUMN "currentValueDecimal" DECIMAL(19, 4);
ALTER TABLE "investment_holdings" ADD COLUMN "unrealizedGainDecimal" DECIMAL(19, 4);

UPDATE "investment_holdings" SET "unitsDecimal" = "units"::DECIMAL(19, 4)                           WHERE "unitsDecimal" IS NULL;
UPDATE "investment_holdings" SET "averagePriceDecimal" = "averagePrice"::DECIMAL(19, 4)             WHERE "averagePriceDecimal" IS NULL;
UPDATE "investment_holdings" SET "totalCostBasisDecimal" = "totalCostBasis"::DECIMAL(19, 4)         WHERE "totalCostBasisDecimal" IS NULL;
UPDATE "investment_holdings" SET "currentPriceDecimal" = "currentPrice"::DECIMAL(19, 4)             WHERE "currentPriceDecimal" IS NULL AND "currentPrice" IS NOT NULL;
UPDATE "investment_holdings" SET "currentValueDecimal" = "currentValue"::DECIMAL(19, 4)             WHERE "currentValueDecimal" IS NULL AND "currentValue" IS NOT NULL;
UPDATE "investment_holdings" SET "unrealizedGainDecimal" = "unrealizedGain"::DECIMAL(19, 4)         WHERE "unrealizedGainDecimal" IS NULL AND "unrealizedGain" IS NOT NULL;

-- =============================================================================
-- PurchaseLot
-- =============================================================================
ALTER TABLE "purchase_lots" ADD COLUMN "unitsDecimal" DECIMAL(19, 4);
ALTER TABLE "purchase_lots" ADD COLUMN "unitCostDecimal" DECIMAL(19, 4);
ALTER TABLE "purchase_lots" ADD COLUMN "totalCostDecimal" DECIMAL(19, 4);
ALTER TABLE "purchase_lots" ADD COLUMN "feesDecimal" DECIMAL(19, 4);
ALTER TABLE "purchase_lots" ADD COLUMN "unitsRemainingDecimal" DECIMAL(19, 4);

UPDATE "purchase_lots" SET "unitsDecimal" = "units"::DECIMAL(19, 4)                                 WHERE "unitsDecimal" IS NULL;
UPDATE "purchase_lots" SET "unitCostDecimal" = "unitCost"::DECIMAL(19, 4)                           WHERE "unitCostDecimal" IS NULL;
UPDATE "purchase_lots" SET "totalCostDecimal" = "totalCost"::DECIMAL(19, 4)                         WHERE "totalCostDecimal" IS NULL;
UPDATE "purchase_lots" SET "feesDecimal" = "fees"::DECIMAL(19, 4)                                   WHERE "feesDecimal" IS NULL;
UPDATE "purchase_lots" SET "unitsRemainingDecimal" = "unitsRemaining"::DECIMAL(19, 4)               WHERE "unitsRemainingDecimal" IS NULL;

-- =============================================================================
-- SuperannuationAccount
-- =============================================================================
ALTER TABLE "superannuation_accounts" ADD COLUMN "currentBalanceDecimal" DECIMAL(19, 4);
ALTER TABLE "superannuation_accounts" ADD COLUMN "taxableComponentDecimal" DECIMAL(19, 4);
ALTER TABLE "superannuation_accounts" ADD COLUMN "taxFreeComponentDecimal" DECIMAL(19, 4);
ALTER TABLE "superannuation_accounts" ADD COLUMN "concessionalYTDDecimal" DECIMAL(19, 4);
ALTER TABLE "superannuation_accounts" ADD COLUMN "nonConcessionalYTDDecimal" DECIMAL(19, 4);
ALTER TABLE "superannuation_accounts" ADD COLUMN "concessionalCapDecimal" DECIMAL(19, 4);
ALTER TABLE "superannuation_accounts" ADD COLUMN "nonConcessionalCapDecimal" DECIMAL(19, 4);
ALTER TABLE "superannuation_accounts" ADD COLUMN "carryForwardAvailableDecimal" DECIMAL(19, 4);

UPDATE "superannuation_accounts" SET "currentBalanceDecimal" = "currentBalance"::DECIMAL(19, 4)             WHERE "currentBalanceDecimal" IS NULL;
UPDATE "superannuation_accounts" SET "taxableComponentDecimal" = "taxableComponent"::DECIMAL(19, 4)         WHERE "taxableComponentDecimal" IS NULL;
UPDATE "superannuation_accounts" SET "taxFreeComponentDecimal" = "taxFreeComponent"::DECIMAL(19, 4)         WHERE "taxFreeComponentDecimal" IS NULL;
UPDATE "superannuation_accounts" SET "concessionalYTDDecimal" = "concessionalYTD"::DECIMAL(19, 4)           WHERE "concessionalYTDDecimal" IS NULL;
UPDATE "superannuation_accounts" SET "nonConcessionalYTDDecimal" = "nonConcessionalYTD"::DECIMAL(19, 4)     WHERE "nonConcessionalYTDDecimal" IS NULL;
UPDATE "superannuation_accounts" SET "concessionalCapDecimal" = "concessionalCap"::DECIMAL(19, 4)           WHERE "concessionalCapDecimal" IS NULL;
UPDATE "superannuation_accounts" SET "nonConcessionalCapDecimal" = "nonConcessionalCap"::DECIMAL(19, 4)     WHERE "nonConcessionalCapDecimal" IS NULL;
UPDATE "superannuation_accounts" SET "carryForwardAvailableDecimal" = "carryForwardAvailable"::DECIMAL(19, 4) WHERE "carryForwardAvailableDecimal" IS NULL;

-- =============================================================================
-- Asset
-- =============================================================================
ALTER TABLE "assets" ADD COLUMN "purchasePriceDecimal" DECIMAL(19, 4);
ALTER TABLE "assets" ADD COLUMN "currentValueDecimal" DECIMAL(19, 4);
ALTER TABLE "assets" ADD COLUMN "salePriceDecimal" DECIMAL(19, 4);
ALTER TABLE "assets" ADD COLUMN "residualValueDecimal" DECIMAL(19, 4);

UPDATE "assets" SET "purchasePriceDecimal" = "purchasePrice"::DECIMAL(19, 4)         WHERE "purchasePriceDecimal" IS NULL;
UPDATE "assets" SET "currentValueDecimal" = "currentValue"::DECIMAL(19, 4)           WHERE "currentValueDecimal" IS NULL;
UPDATE "assets" SET "salePriceDecimal" = "salePrice"::DECIMAL(19, 4)                 WHERE "salePriceDecimal" IS NULL AND "salePrice" IS NOT NULL;
UPDATE "assets" SET "residualValueDecimal" = "residualValue"::DECIMAL(19, 4)         WHERE "residualValueDecimal" IS NULL AND "residualValue" IS NOT NULL;

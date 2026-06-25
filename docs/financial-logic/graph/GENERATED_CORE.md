<!-- GENERATED FROM financial-graph.json — DO NOT EDIT BY HAND.
     Regenerate: `npm run neomatrix:generate`. The JSON is the SSOT (Phase 53 §8). -->

# Neomatrix — Generated Core View

> Rendered from `financial-graph.json` (v0.28.0, reviewed 2026-06-25). 
> This file is derived — edit the JSON, not this. Markdown and JSON cannot diverge (CI-checked).

## Coverage & trust (C10)

- **Nodes:** 104 · **Edges:** 140
- **By kind:** orchestrator 4 · engine 44 · input-field 19 · number 8 · ui-surface 8 · law 21
- **By status:** documented 104
- **Edge provenance:** verified 140 *(verified > graphify > inferred)*

## Engine / orchestrator registry

| Node | File:line | Layer | Domain | Produces | Authority | Verified | Status |
|---|---|---|---|---|---|---|---|
| **Master financial snapshot** | `lib/services/masterFinancialService.ts:1704` | service | core | The single financial snapshot: totals, expense/income breakdowns, cashflow (declared), quickMetrics (incl. actual* fields), emergency fund, health score, net worth, debt. | CLAUDE.md §6.1 / §12.2 (Master Financial Service SSOT) | docs/financial-logic/00b_RELATIONSHIPS_AND_LINEAGE.md §2 | documented |
| **Net worth** | `lib/calculations/netWorthCalculator.ts:217` | engine | core | netWorth + asset summary (properties/accounts/investments/super/personalAssets/total), liability summary (mortgages/personalLoans/creditCards/total), breakdown (propertyEquity/liquidAssets/investmentAssets). | Accounting identity: net worth = total assets − total liabilities. | tests/calculations/netWorthCalculator.decimal.test.ts + tests/neomatrix/financialAudit.test.ts (A1 law-referenced executable audit) | documented |
| **Holding market value (canonical helper)** | `lib/calculations/assetValuation.ts:44` | engine | core | Market value of one investment holding = units × (currentPrice \|\| averagePrice). The §12.2 read-model SSOT mirroring netWorthCalculator. | lib/calculations/netWorthCalculator.ts calculateTotalAssets (Float path) — value = units × (currentPrice\|\|averagePrice) | tests/neomatrix/financialAudit.test.ts (A1 law-referenced) + lib/calculations/assetValuation.ts:44 | documented |
| **Loan current balance (canonical helper)** | `lib/calculations/assetValuation.ts:71` | engine | core | Current outstanding loan balance = principal ?? currentBalance ?? balance. The §12.2 read-model SSOT mirroring netWorthCalculator. | lib/calculations/netWorthCalculator.ts calculateTotalLiabilities — Number(loan.principal\|\|0); prisma schema: Loan.principal = current balance | tests/neomatrix/financialAudit.test.ts (A1 law-referenced) + lib/calculations/assetValuation.ts:71 | documented |
| **Net-worth history trend (honest, from stored snapshots)** | `lib/calculations/netWorthHistory.ts:47` | engine | core | NetWorthHistoryResult — trend[] (oldest→newest, literal stored rows), deltaAbsolute, deltaPct. The §12.2 single canonical reader of NetWorthSnapshot. | CLAUDE.md §0 financial-adviser lens (honesty: never invent data) + §12.2 SSOT | tests/neomatrix/netWorthHistoryAudit.test.ts (A1 law-referenced, prisma-mocked boundary) + lib/calculations/netWorthHistory.ts:47 | documented |
| **Per-entity position breakdown (additive view)** | `lib/calculations/entityBreakdown.ts:86` | engine | core | EntityPosition[] — per owning-entity netWorth/assets/liabilities/monthlyIncome/expenses/cashflow. ADDITIVE: only adds the byEntity view beside the flat household numbers. | Phase 47 Stage C1 additivity contract (Σ per-entity == household) + §12.2/§12.3 (reuse calculateNetWorth, never re-implement) | tests/neomatrix/financialAudit.test.ts (A1 law-referenced) + lib/calculations/entityBreakdown.ts:86 | documented |
| **Money Story 12-month trend (earned vs spent)** | `lib/calculations/moneyStoryTrend.ts:68` | engine | core | MoneyStoryTrendResult — per-month RibbonPoint{spent, kept}, currentMargin, baselineMargin, marginDeltaPoints, monthly earned/spent/netCashflow series + KPI deltas. Powers the Money Story v2 hero + KPI sparklines. | CLAUDE.md §0 financial-adviser honesty contract (never invent data; zero months render zero, never interpolated) + §19.1 (actual transactions) | tests/neomatrix/moneyStoryTrendAudit.test.ts (A1 law-referenced, prisma-mocked + fake timers) + lib/calculations/moneyStoryTrend.ts:77 (SSOT: reads UnifiedTransaction, transfers excluded — 2026-06-25) | documented |
| **Declared cashflow** | `lib/calculations/cashflowOrchestrator.ts:302` | engine | core | CashflowResult — monthly/annual gross+net income, PAYG, expenses, loan repayments, cashflow (surplus), ratios (savingsRate/expenseRatio/debtServiceRatio), essential/discretionary split. DECLARED basis (records × frequency), NOT actual bank spend. | CLAUDE.md §19.1 (declared = the 'plan' side; fallback only when no transactions) | tests/calculations/aggregators.decimal.test.ts | documented |
| **Actual cashflow** | `lib/calculations/actualCashflow.ts:104` | engine | core | ActualCashflowResult — current-month outflow/inflow/net, trailing-avg monthly outflow+inflow, current-month outflow-by-category (incl. 'Uncategorised'), hasActualData. From actual UnifiedTransaction rows. | CLAUDE.md §19.1 (actuals; transfers excluded; uncategorised INCLUDED) | tests/calculations/actualCashflow.test.ts | documented |
| **Canonical monthly cashflow** | `lib/calculations/canonicalCashflow.ts:114` | engine | core | CanonicalMonthlyCashflow { inflow, outflow, net, savingsRate, avgMonthlyOutflow, basis } where basis ∈ {actual, declared}. THE SSOT for 'money in/out/net this month'. | CLAUDE.md §19.1 (actuals-vs-declared SSOT) | tests/calculations/canonicalCashflow.test.ts, tests/calculations/cashflowSurfacesUseCanonical.test.ts | documented |
| **Resolve canonical cashflow (the rule)** | `lib/calculations/canonicalCashflow.ts:78` | engine | core | The pure actuals-vs-declared resolution (actual, declared) → canonical result. For routes that compute actuals locally. | CLAUDE.md §19.1 (actuals-vs-declared SSOT) | tests/calculations/canonicalCashflow.test.ts + tests/neomatrix/financialAudit.test.ts (A1 law-referenced executable audit) | documented |
| **Master tax position** | `lib/tax-engine/orchestrator/masterTaxPosition.ts:186` | service | tax | Household-wide MasterTaxPositionV2: per-entity dispatch + cross-cutting (land tax/stamp duty/GST) + loss overlays + citations + boundary footer. | CLAUDE.md §6.1 (tax SSOT) + ITAA 1997 | lib/tax-engine/orchestrator/masterTaxPosition.ts:186 (read this session) | documented |
| **Per-entity tax dispatch** | `lib/tax-engine/entity/entityTaxRouter.ts:300` | service | tax | Routes per legal-entity type; PERSONAL_NAME / SOLE_TRADER → wraps calculateTaxPosition(). | ITAA 1997; entity-type tax treatment | lib/tax-engine/entity/entityTaxRouter.ts:300,332 (read this session) | documented |
| **Income tax position** | `lib/tax-engine/position/taxPositionCalculator.ts:92` | engine | tax | TaxPositionResult — assessable income breakdown, deductions, taxable income, tax on income (marginal brackets), Medicare, marginal rate, PAYG, net tax payable/refund. | ITAA 1997 (income tax) + ATO individual income tax rates + Medicare Levy Act 1986 | lib/tax-engine/position/taxPositionCalculator.ts:92 (read this session) | documented |
| **Salary take-home (PAYG)** | `lib/tax-engine/income/salaryProcessor.ts:46` | engine | tax | SalaryBreakdown — gross↔net take-home (handles GROSS and NET input), PAYG, salary-sacrifice, tax-free-threshold flag, step-by-step calc trail. | ITAA 1997 (income tax) + ATO PAYG withholding | lib/tax-engine/income/salaryProcessor.ts:46 (read this session) | documented |
| **FY tax thresholds (canonical)** | `lib/tax-engine/config/taxYearConfig.ts:370` | service | tax | The canonical TaxYearConfig for the current FY (brackets, Medicare, LITO, super caps, transfer-balance cap, etc.) — the SSOT for AU tax thresholds (CLAUDE.md §12.2). | ATO individual income tax rates / Medicare Levy / Super thresholds + ITAA sections (cited inline in source) | lib/tax-engine/config/taxYearConfig.ts:370 (read this session) | documented |
| **CGT discount (Div 115 / reform Measure 2)** | `lib/tax-engine/divisions/cgtDiscount.ts:166` | engine | tax | CgtDiscountResult — the discounted/indexed taxable capital gain that flows into the CAPITAL_GAIN income line of calculateTaxPosition. | ITAA 1997 Div 115 (CGT discount); 2026-27 reform Measure 2; CLAUDE.md §12.14 FW-1/FW-2 | lib/tax-engine/divisions/cgtDiscount.ts:166 (read this session) + tests/neomatrix/financialAudit.test.ts (A1 law-referenced) | documented |
| **CGT indexation (post-reform)** | `lib/tax-engine/divisions/cgtIndexation.ts:87` | engine | tax | CgtIndexationResult — indexed cost base OR UNCOMPUTED flag (pre-reform fallback). | 2026-27 reform Measure 2; CLAUDE.md §12.14 FW-2 | lib/tax-engine/divisions/cgtIndexation.ts:87 (read this session) | documented |
| **CGT minimum rate (30% floor, post-reform)** | `lib/tax-engine/divisions/cgtMinimumRate.ts:80` | engine | tax | CgtMinimumRateResult — the floored taxable gain (post-reform). | 2026-27 reform Measure 2; CLAUDE.md §12.14 | lib/tax-engine/divisions/cgtMinimumRate.ts:80 (read this session) | documented |
| **Negative-gearing regime classifier (Measure 1)** | `lib/tax-engine/divisions/negativeGearingRegime.ts:147` | engine | tax | NegativeGearingRegime discriminant — which regime governs loss-offset for this property. | 2026-27 reform Measure 1; CLAUDE.md §12.14 FW-1 | lib/tax-engine/divisions/negativeGearingRegime.ts:147 (read this session) | documented |
| **Super guarantee (SG)** | `lib/tax-engine/super/contributionCalculator.ts:61` | engine | tax | SG contribution amount. | SGAA 1992; ATO SG rate + max contribution base | lib/tax-engine/super/contributionCalculator.ts:61 (read this session) + tests/neomatrix/financialAudit.test.ts (A1 law-referenced) | documented |
| **Super contributions + tax saved** | `lib/tax-engine/super/contributionCalculator.ts:115` | engine | tax | Concessional/non-concessional totals, 15% contributions tax, tax saved. | ITAA 1997 s295-485 (15% taxed-in-fund) | lib/tax-engine/super/contributionCalculator.ts:115 (read this session) | documented |
| **Concessional carry-forward** | `lib/tax-engine/super/capTracker.ts:96` | engine | tax | Available carry-forward concessional cap. | ITAA 1997 s291-20 | lib/tax-engine/super/capTracker.ts:96 (read this session) | documented |
| **Non-concessional bring-forward** | `lib/tax-engine/super/capTracker.ts:148` | engine | tax | Bring-forward non-concessional availability. | ITAA 1997 s292-85 | lib/tax-engine/super/capTracker.ts:148 (read this session) | documented |
| **Div 293 + Div 296 high-income/balance tax** | `lib/tax-engine/super/highIncomeSuperTax.ts:77` | engine | tax | Div 293 surcharge (+ Div 296 when commenced). | ITAA 1997 Div 293; Div 296 (proposed); CLAUDE.md §12.14 FW-2 | lib/tax-engine/super/highIncomeSuperTax.ts:77 (read this session) + tests/neomatrix/financialAudit.test.ts (A1 law-referenced) | documented |
| **SMSF income tax (Div 295)** | `lib/tax-engine/super/smsfIncomeTax.ts:151` | engine | tax | SMSF tax payable (15% concessional / 45% NALI). | ITAA 1997 Div 295; s295-385/390 (ECPI); s295-550 (NALI) | lib/tax-engine/super/smsfIncomeTax.ts:151 (read this session) + tests/neomatrix/financialAudit.test.ts (A1 law-referenced) | documented |
| **State land tax (per state)** | `lib/tax-engine/landTax/stateLandTax.ts:374` | engine | tax | Per-state land tax payable. | State Land Tax Acts (NSW 1956 / VIC 2005 / QLD / SA / WA / TAS) | tests/neomatrix/financialAudit.test.ts (A1 law-referenced, NSW Land Tax Act 1956 s27/s5A/Sch1A) + lib/tax-engine/landTax/stateLandTax.ts:374 | documented |
| **Cross-state land tax (household)** | `lib/tax-engine/landTax/crossStateAggregator.ts:105` | engine | tax | Household-wide land-tax position. | State Land Tax Acts (per-state aggregation) | tests/neomatrix/financialAudit.test.ts (A1 law-referenced, within-state grouping + across-state independence) + lib/tax-engine/landTax/crossStateAggregator.ts:105 | documented |
| **Stamp duty / transfer duty (per state)** | `lib/tax-engine/stampDuty/stateStampDuty.ts:285` | engine | tax | Transfer duty payable (+ foreign surcharge). | State Duties Acts (NSW Duties Act 1997 / VIC Duties Act 2000 / …) | tests/neomatrix/financialAudit.test.ts (A1 law-referenced, NSW Duties Act 1997 Sch 1) + lib/tax-engine/stampDuty/stateStampDuty.ts:285 | documented |
| **GST / BAS** | `lib/tax-engine/gst/gstCalculator.ts:104` | engine | tax | GST/BAS net position. | A New Tax System (GST) Act 1999 — s9-70 (10%), s23-15 (threshold) | lib/tax-engine/gst/gstCalculator.ts:104 (read this session) + tests/neomatrix/financialAudit.test.ts (A1 law-referenced) | documented |
| **Income tax (marginal brackets)** | `lib/tax-engine/core/incomeTaxCalculator.ts:21` | engine | tax | IncomeTaxResult { taxPayable, marginalRate, effectiveRate }. | ITAA 1997; ATO individual income tax rates (FY24-25 Stage 3) | tests/neomatrix/financialAudit.test.ts (A1 ATO-law-referenced) + lib/tax-engine/core/incomeTaxCalculator.ts:21 | documented |
| **Low Income Tax Offset (LITO) — two-tier phase-out** | `lib/tax-engine/core/taxOffsets.ts:36` | engine | tax | LITO offset (AUD) for FY24-25 — a non-refundable offset that reduces income tax. | ATO Individual income tax rates — LITO FY24-25 (two-tier: 5c/$ 37.5k–45k, 1.5c/$ 45k–66,667) | tests/neomatrix/financialAudit.test.ts (A1 law-referenced) + lib/tax-engine/core/taxOffsets.ts:36 | documented |
| **Apply offsets to gross tax (refundable vs non-refundable)** | `lib/tax-engine/core/taxOffsets.ts:434` | engine | tax | netTax + refundableAmount + usedOffsets — applies offsets to gross tax. | ATO: LITO/SAPTO are non-refundable (reduce to $0); franking credits (Div 207) are refundable | tests/neomatrix/financialAudit.test.ts (A1 law-referenced) + lib/tax-engine/core/taxOffsets.ts:434 | documented |
| **Medicare levy (2% + shade-in)** | `lib/tax-engine/core/medicareLevyCalculator.ts:38` | engine | tax | MedicareLevyResult { medicareLevy, medicareSurcharge, total, isShadeIn }. | Medicare Levy Act 1986; ATO Medicare Levy | tests/neomatrix/financialAudit.test.ts (A1 ATO-law-referenced) + lib/tax-engine/core/medicareLevyCalculator.ts:38 | documented |
| **Health aggregate score** | `lib/health/aggregateEngine.ts:106` | engine | health | The 0-100 aggregate health score from weighted category scores − penalties. | Monitrax health-score methodology (Phase 12 — weighted category scores − penalties, clamped 0-100) | tests/neomatrix/financialAudit.test.ts (A1 methodology-referenced) + lib/health/aggregateEngine.ts:106 | documented |
| **Health score (with trend/band)** | `lib/health/aggregateEngine.ts:315` | engine | health | HealthScore { score, trend, band } from the aggregate. | Monitrax health-score methodology (Phase 12 — weighted category scores − penalties, clamped 0-100) | lib/health/aggregateEngine.ts:315 (read this session) | documented |
| **Financial health report (SSOT)** | `lib/health/aggregateEngine.ts:338` | service | health | FinancialHealthReport — the canonical §12.3 health output. | Monitrax health-score methodology (Phase 12 — weighted category scores − penalties, clamped 0-100) | lib/health/aggregateEngine.ts:338 (read this session) | documented |
| **CFO overall score (weighted)** | `lib/cfo/scoreCalculator.ts:730` | engine | cfo | The 0-100 CFO score from the 6 weighted component sub-scores (Decimal sibling). | Monitrax CFO-score methodology (6 weighted components: cashflow 25% / debt 20% / emergency 15% / diversification 15% / spending 15% / savings 10%) | tests/neomatrix/financialAudit.test.ts (A1 methodology-referenced) + lib/cfo/scoreCalculator.ts:730 | documented |
| **CFO score (orchestrator)** | `lib/cfo/scoreCalculator.ts:33` | service | cfo | CFOScore { overall, components, trend } — the §6.4 CFO SSOT. | Monitrax CFO-score methodology (6 weighted components: cashflow 25% / debt 20% / emergency 15% / diversification 15% / spending 15% / savings 10%) | lib/cfo/scoreCalculator.ts:33 (read this session) | documented |
| **What-if: cut a spend category** | `lib/cfo/scenarios/cutSpendCategory.ts:18` | engine | cfo | ScenarioResult — monthly cashflow + annual saving + savings-rate + emergency-months impact of cutting a category. | Monitrax what-if methodology (annual = monthly delta × 12, held constant 12 months; reduction capped at actual spend) | tests/neomatrix/financialAudit.test.ts (A1 methodology-referenced) + lib/cfo/scenarios/cutSpendCategory.ts:18 | documented |
| **Cashflow health score (5-category)** | `lib/cashflow-intelligence/healthScoreAggregator.ts:248` | engine | intelligence | CashflowHealthScore — overall 0-100 + per-category breakdown (liquidity/stability/forecast/budget/debt). | Monitrax cashflow-intelligence methodology (Phase 13/14) | tests/neomatrix/financialAudit.test.ts (A1 methodology-referenced) + lib/cashflow-intelligence/healthScoreAggregator.ts:248 | documented |
| **GRDCS linkage health** | `lib/intelligence/linkageHealthService.ts:306` | service | intelligence | LinkageHealthResponse — completeness, orphan/missing counts, module breakdown, severity. | Monitrax GRDCS linkage-health Blueprint thresholds (§04 GRDCS) | lib/intelligence/linkageHealthService.ts:306 (read this session) | documented |
| **Property portfolio report** | `lib/reports/generators/propertyPortfolio.ts:8` | service | reports | Report sections: portfolio metrics (total value/equity/purchase, capital growth + growth%, avg LVR, count) + tax benefits. | Standard property-portfolio metrics (report aggregation of canonical per-property values) | tests/neomatrix/financialAudit.test.ts (A1 methodology-referenced) + lib/reports/generators/propertyPortfolio.ts:8 | documented |
| **Loan/debt aggregation (interest)** | `lib/calculations/loanAggregator.ts:69` | engine | core | LoanAggregation — totalPrincipal, totalRepayments, totalInterest, weightedInterestRate, byType. The §6.2 debt SSOT. | Standard interest = principal × annual rate; CLAUDE.md §19.2 (interestRateAnnual decimal — the prior 100× bug, P0-fixed 2026-06-23) | tests/neomatrix/financialAudit.test.ts (A1 law-referenced — locks the 100× class) + lib/calculations/loanAggregator.ts:69 | documented |
| **Declared expense aggregation** | `lib/calculations/expenseAggregator.ts:76` | engine | core | ExpenseAggregation — total, essential, discretionary, taxDeductible, byCategory. The §6.2 expense SSOT. | CLAUDE.md §6.2 (expense SSOT) + lib/utils/frequencies.ts toMonthly | tests/neomatrix/financialAudit.test.ts (A1 law-referenced) + lib/calculations/expenseAggregator.ts:76 | documented |
| **Declared income aggregation (gross / net / PAYG)** | `lib/calculations/incomeAggregator.ts:143` | engine | core | IncomeAggregation — grossTotal, netTotal, paygWithholding, byType, taxableIncome, nonTaxableIncome. The §6.2 income SSOT. | CLAUDE.md §6.2 (income SSOT) + lib/utils/frequencies.ts toMonthly/toAnnual | tests/neomatrix/financialAudit.test.ts (A1 law-referenced) + lib/calculations/incomeAggregator.ts:143 | documented |
| **Dashboard insights composer** | `app/api/dashboard/insights/route.ts:156` | route | core | The dashboard insights payload — composes the master snapshot (core position) AND the Money Story 12-month trend into one response the dashboard renders. | CLAUDE.md §6.1 (Master Financial Service SSOT) — this route is a thin composer, no inline calc | app/api/dashboard/insights/route.ts:156,161,173 (read this session) | documented |
| **Portfolio relational snapshot (SnapshotV2 — GRDCS SSOT)** | `app/api/portfolio/snapshot/route.ts:519` | route | intelligence | SnapshotV2 (v2.0) — the GRDCS relational snapshot: per-entity _links/_meta, entityCounts, linkageHealth, moduleCompleteness, relationalInsights. The second SSOT (§12.2), distinct from master. | CLAUDE.md §12.2 (the GRDCS/relational snapshot SSOT — NOT a duplicate of master) | app/api/portfolio/snapshot/route.ts:519,525-596,918 (read this session) | documented |

## Worked examples (the A1 fixtures — §14)

| Engine | Worked example (input → expected output) |
|---|---|
| **Net worth** | property 800,000 + account 20,000 + (100 units × 50) − loan 600,000 = 225,000 |
| **Holding market value (canonical helper)** | 100u×$50=$5,000; 200u×avg$25 (no current)=$5,000; 100u, current 0→avg $25 = $2,500 |
| **Loan current balance (canonical helper)** | principal $600,000→$600,000; currentBalance $300,000→$300,000; sum [$600k,balance $100k]=$700,000 |
| **Net-worth history trend (honest, from stored snapshots)** | rows [100k,120k]→ΔAbs +20,000, Δ% +20.0; 1 row→honesty gate empty; first 0→Δ% 0; [-10k,-5k]→ΔAbs +5,000, Δ% +50.0 (abs baseline) |
| **Per-entity position breakdown (additive view)** | e1 (prop 800k, loan 600k) netWorth 200k, income 10k/mo − exp 3k/mo = cashflow 7k; e2 (cash 20k) netWorth 20k; Σ = 220k = household; null-owned 50k → Unattributed bucket |
| **Money Story 12-month trend (earned vs spent)** | May earned 10k/spent 6k, June earned 12k/spent 6k → currentMargin 50, baselineMargin 40, marginΔ +10pts, incomeΔ +20.0%, cashflowΔ +2,000, outgoingsΔvsAvg +5,000; kept clamps ≥0; <2 months → empty |
| **Declared cashflow** | net income 8,000/mo − expenses 5,000 − loans 1,000 = 2,000/mo; savingsRate = 2,000/8,000 = 25% |
| **Actual cashflow** | Mar 10 + May 600 both populated, Apr empty → divisor 2 → avg 305 (a month with no txns is missing data, excluded from sum AND divisor) |
| **Canonical monthly cashflow** | In 25,827 / Out 46,741 → net −20,914; savingsRate ≈ −80.98%; basis 'actual' (the real deficit the old declared hero hid as +$10,505 / 51.9%) |
| **State land tax (per state)** | NSW CY2025: $1.0M (<threshold)→$0; $2.0M→general $14,900 (100 + 925,000×0.016); trust $2M→surcharge $16,125 (1.5%×$1.075M); foreign residential $2M→surcharge $80,000 (×0.04), total $94,900; foreign non-residential→$0 (residential-only) |
| **Cross-state land tax (household)** | Two NSW parcels $700k+$500k → aggregated $1.2M (>threshold) → NSW general $2,100 (would be $0+$0 if assessed separately!); + VIC $400k → $2,050; grandTotal $4,150, statesAssessed 2 |
| **Stamp duty / transfer duty (per state)** | NSW: $600k→general $22,090 (9,805 + 273,000×0.045); $100k→$1,860 (1,405 + 13,000×0.035); foreign residential $600k→FPAD $48,000 (×0.08), total $70,090; non-residential→FPAD $0 |
| **Low Income Tax Offset (LITO) — two-tier phase-out** | $30k→$700; $40k→$575 (700−125); $45k→$325 (700−375); $50k→$250 (700−450); ≥$66,667→$0 |
| **Apply offsets to gross tax (refundable vs non-refundable)** | gross $1,000 + LITO $700 → netTax $300; gross $500 + LITO $700 → netTax $0 (non-refundable floor); gross $0 + franking $1,000 → netTax −$1,000, refundable $1,000 |
| **Loan/debt aggregation (interest)** | 500,000 × 0.0625/12 = 2,604.17/mo; ×12 = 31,250/yr |
| **Declared expense aggregation** | $1,200 ANNUAL → $100/mo; $500 MONTHLY + $1,200 ANNUAL → $600/mo |
| **Declared income aggregation (gross / net / PAYG)** | SALARY GROSS $120k/yr + rental $2k/mo → grossTotal $12,000/mo; PAYG $30k → $2,500/mo; SALARY NET grossAmount $100k (annual target) → grossTotal $100,000 |

## Number lineage — how each displayed number is born

| Number (semanticKey) | Engine ancestor(s) | Rendered at | Formula | Authority |
|---|---|---|---|---|
| **Net-worth trend Δ / Δ% (displayed)** (`netWorthTrend`) | Net-worth history trend (honest, from stored snapshots), Net worth, Holding market value (canonical helper), Loan current balance (canonical helper), Per-entity position breakdown (additive view) | Dashboard — Net Worth Trend tile | = getNetWorthHistory(...).{ deltaAbsolute, deltaPct } | CLAUDE.md §0 honesty contract |
| **Money Story kept margin (displayed)** (`moneyStoryMargin`) | Money Story 12-month trend (earned vs spent) | Dashboard — Money Story hero + KPI strip | = getMoneyStoryTrend(...).{ currentMargin, marginDeltaPoints } | CLAUDE.md §0 honesty contract |
| **Net worth (displayed)** (`netWorth`) | Net worth, Holding market value (canonical helper), Loan current balance (canonical helper), Per-entity position breakdown (additive view) | Home — Net worth tile | = calculateNetWorth(...).netWorth | Accounting identity |
| **Monthly cash flow (this month)** (`monthlyCashflow`) | Canonical monthly cashflow, Actual cashflow, Declared cashflow, Net worth, Loan/debt aggregation (interest), Declared expense aggregation, Declared income aggregation (gross / net / PAYG), Holding market value (canonical helper), Loan current balance (canonical helper), Per-entity position breakdown (additive view) | /cashflow — hero, /activity — This month tiles (Spending / Income / Net) | = getCanonicalMonthlyCashflow(snapshot).net | CLAUDE.md §19.1 |
| **Saving rate** (`savingsRate`) | Canonical monthly cashflow, Actual cashflow, Declared cashflow, Net worth, Loan/debt aggregation (interest), Declared expense aggregation, Declared income aggregation (gross / net / PAYG), Holding market value (canonical helper), Loan current balance (canonical helper), Per-entity position breakdown (additive view) | /cashflow — hero | = getCanonicalMonthlyCashflow(snapshot).savingsRate | CLAUDE.md §19.1 |
| **Net tax payable** (`taxPayable`) | Income tax position, FY tax thresholds (canonical), Income tax (marginal brackets), Medicare levy (2% + shade-in) | Tax position surface | = calculateTaxPosition(...).netTaxPayable (gross tax − offsets − PAYG) | ITAA 1997 + Medicare Levy Act 1986 |
| **Financial health score** (`healthScore`) | Health score (with trend/band), Health aggregate score | Home — Health tile | = generateHealthScore(...).score | Monitrax health methodology |
| **CFO score** (`cfoScore`) | CFO score (orchestrator) | /dashboard/cfo — CFO score | = calculateCFOScore(...).overall | Monitrax CFO methodology |

## Governing laws / authorities (B6)

| Law | Statement | Authority | Governs |
|---|---|---|---|
| **Net worth = assets − liabilities** | net worth = total assets − total liabilities | Standard accounting identity | Net worth |
| **Actuals-vs-declared SSOT** | actuals win when present; declared is fallback only | CLAUDE.md §19.1 | Canonical monthly cashflow, Resolve canonical cashflow (the rule) |
| **ITAA 1997 — income tax + ATO rates** | tax on income via marginal brackets; LITO offset applied. | ITAA 1997; ATO Individual income tax rates (https://www.ato.gov.au/rates/individual-income-tax-rates/) | Income tax position, Salary take-home (PAYG), Income tax (marginal brackets), Low Income Tax Offset (LITO) — two-tier phase-out |
| **Medicare Levy Act 1986** | levy = 2% of taxable income above the threshold (shade-in to 125%). | Medicare Levy Act 1986; ATO Medicare Levy | Income tax position, Medicare levy (2% + shade-in) |
| **2026-27 reform cut-over (Phase 41E)** | asset acquired after the cut-over → post-reform regime (per measure commencement). | 2026-27 Federal Budget; CLAUDE.md §12.14 | CGT discount (Div 115 / reform Measure 2), CGT indexation (post-reform), CGT minimum rate (30% floor, post-reform), Negative-gearing regime classifier (Measure 1) |
| **ITAA 1997 Div 115 — CGT 50% discount** | Capital gains 50% discount for assets held ≥ 12 months (pre-reform). | ITAA 1997 Div 115 | CGT discount (Div 115 / reform Measure 2) |
| **s295-485 — 15% taxed-in-fund** | Concessional contributions / fund income taxed at 15% in the fund. | ITAA 1997 s295-485 | Super contributions + tax saved, SMSF income tax (Div 295) |
| **Contribution caps + carry/bring-forward** | Concessional cap (s291), non-concessional cap (s292), carry-forward (s291-20), bring-forward (s292-85). | ITAA 1997 s291 / s292 | Super guarantee (SG), Concessional carry-forward, Non-concessional bring-forward |
| **Div 293 — extra 15% (high income)** | Additional 15% tax on concessional contributions for income above the threshold. | ITAA 1997 Div 293 (s293-15) | Div 293 + Div 296 high-income/balance tax |
| **Div 296 — extra 15% on TSB earnings (proposed)** | Proposed additional 15% on earnings attributable to TSB above the threshold — pending commencement (FW-2). | ITAA 1997 Div 296 (proposed) | Div 293 + Div 296 high-income/balance tax |
| **Div 295 — taxation of complying super funds** | Complying fund taxed at 15%; ECPI exemption (s295-385/390); NALI at top rate (s295-550). | ITAA 1997 Div 295 | SMSF income tax (Div 295) |
| **State Land Tax Acts** | Progressive land tax on aggregated taxable land value, per state (NT = none). | NSW Land Tax Act 1956; VIC Land Tax Act 2005; QLD/SA/WA/TAS equivalents | State land tax (per state), Cross-state land tax (household) |
| **State Duties Acts** | Transfer (stamp) duty on dutiable property value + foreign-purchaser surcharge. | NSW Duties Act 1997; VIC Duties Act 2000; state equivalents | Stamp duty / transfer duty (per state) |
| **GST Act 1999** | 10% GST on taxable supplies; $75k registration threshold. | A New Tax System (Goods and Services Tax) Act 1999 — s9-70, s23-15 | GST / BAS |
| **Monitrax health-score methodology** | score = round(clamp(0,100, Σ(catScore×catWeight) − totalPenalty)) | Monitrax health methodology (Phase 12 Financial Health Engine) | Health aggregate score |
| **CFO score component weights** | overall = Σ component_i × weight_i | Monitrax CFO methodology (Phase 17 Personal CFO Engine) | CFO overall score (weighted), CFO score (orchestrator) |
| **What-if annualisation rule** | annual = monthlyDelta × 12 | Monitrax CFO what-if methodology | What-if: cut a spend category |
| **Cashflow health category weights** | overall = Σ category × weight | Monitrax cashflow-intelligence methodology | Cashflow health score (5-category) |
| **GRDCS linkage severity thresholds** | severity = f(orphanPct, missingPct) by Blueprint thresholds | Monitrax GRDCS Blueprint (docs/architecture/04_GRDCS_SPECIFICATION.md) | GRDCS linkage health |
| **Report aggregation rules** | total = Σ value; growth% = (value−cost)/cost×100; avg = Σ/n | Monitrax reporting methodology + §12.2 SSOT (reports consume canonical values) | Property portfolio report |
| **Loan interest = principal × annual rate** | monthlyInterest = P × r/12 | Standard interest formula | Loan/debt aggregation (interest) |

## Edges (verified, with evidence)

| From | → | To | Type | Units | Source | Evidence |
|---|---|---|---|---|---|---|
| Property.currentValue | → | Net worth | feeds | AUD→AUD | verified | netWorthCalculator.ts:217 sums property.currentValue |
| Account.currentBalance | → | Net worth | feeds | AUD→AUD | verified | netWorthCalculator.ts:217 |
| Investment units × price | → | Net worth | feeds | AUD→AUD | verified | netWorthCalculator.ts:217 units×price |
| Superannuation.balance | → | Net worth | feeds | AUD→AUD | verified | netWorthCalculator.ts:217 non-SMSF only |
| Asset.currentValue | → | Net worth | feeds | AUD→AUD | verified | netWorthCalculator.ts:217 |
| Loan.principal | → | Net worth | feeds | AUD→AUD | verified | netWorthCalculator.ts:217 liabilities |
| Income (declared) | → | Declared cashflow | feeds | AUD/period→AUD/month | verified | cashflowOrchestrator.ts:302 toMonthly() |
| Expense (declared) | → | Declared cashflow | feeds | AUD/period→AUD/month | verified | cashflowOrchestrator.ts:302 toMonthly() |
| Loan.minRepayment | → | Declared cashflow | feeds | AUD/period→AUD/month | verified | cashflowOrchestrator.ts:302 minRepayment toMonthly() |
| UnifiedTransaction | → | Actual cashflow | feeds | AUD→AUD/month | verified | actualCashflow.ts:104 buckets non-transfer rows by month |
| Net worth | → | Master financial snapshot | feeds | AUD→AUD | verified | masterFinancialService.ts:1767 |
| Declared cashflow | → | Master financial snapshot | feeds | AUD/month→AUD/month | verified | masterFinancialService.ts:1819 |
| Actual cashflow | → | Master financial snapshot | feeds | AUD/month→AUD/month | verified | masterFinancialService.ts:1857 |
| Master financial snapshot | → | Canonical monthly cashflow | feeds | AUD/month→AUD/month | verified | canonicalCashflow.ts:114 takes a master snapshot slice (quickMetrics + cashflow) |
| Actual cashflow | → | Canonical monthly cashflow | feeds | AUD/month→AUD/month | verified | canonicalCashflow.ts reads quickMetrics.actual* (actual branch) |
| Declared cashflow | → | Canonical monthly cashflow | falls-back-to | AUD/month→AUD/month | verified | canonicalCashflow.ts declared fallback when !hasActualData |
| Canonical monthly cashflow | → | Resolve canonical cashflow (the rule) | depends-on | — | verified | canonicalCashflow.ts:119 delegates the rule to resolveCanonicalCashflow |
| Net worth | → | Net worth = assets − liabilities | governed-by | — | verified | netWorth = assets − liabilities (01_CORE §1) |
| Canonical monthly cashflow | → | Actuals-vs-declared SSOT | governed-by | — | verified | CLAUDE.md §19.1 |
| Resolve canonical cashflow (the rule) | → | Actuals-vs-declared SSOT | governed-by | — | verified | CLAUDE.md §19.1 |
| Net worth | → | Net worth (displayed) | feeds | AUD→AUD | verified | 00b §3 net worth lineage |
| Net worth (displayed) | → | Home — Net worth tile | rendered-at | AUD→AUD | verified | 00b §3 Home Net worth |
| Canonical monthly cashflow | → | Monthly cash flow (this month) | feeds | AUD/month→AUD/month | verified | 00b §3 monthly cash flow lineage (canonical .net) |
| Monthly cash flow (this month) | → | /cashflow — hero | rendered-at | AUD/month→AUD/month | verified | 00b §3 /cashflow hero (converged) |
| Monthly cash flow (this month) | → | /activity — This month tiles (Spending / Income / Net) | rendered-at | AUD/month→AUD/month | verified | activity/page.tsx fetchSummary getCanonicalMonthlyCashflow(masterSnapshot) → Spending/Income/Net 'This month' tiles (Phase 2c — was rolling-30-day analytics) |
| Canonical monthly cashflow | → | Saving rate | feeds | %→% | verified | 00b §3 saving rate (canonical .savingsRate) |
| Saving rate | → | /cashflow — hero | rendered-at | %→% | verified | 00b §3 /cashflow hero |
| Marginal tax brackets (config) | → | FY tax thresholds (canonical) | feeds | — | verified | taxYearConfig.ts:41 brackets are part of the returned config (:370) |
| Medicare levy config | → | FY tax thresholds (canonical) | feeds | — | verified | taxYearConfig.ts:61 medicare config in the returned config |
| Low Income Tax Offset (config) | → | FY tax thresholds (canonical) | feeds | — | verified | taxYearConfig.ts:85 LITO config in the returned config |
| FY tax thresholds (canonical) | → | Income tax position | feeds | thresholds→thresholds | verified | taxPositionCalculator.ts:96 config \|\| getCurrentTaxYearConfig() |
| FY tax thresholds (canonical) | → | Salary take-home (PAYG) | feeds | thresholds→thresholds | verified | salaryProcessor.ts:48 default config = getCurrentTaxYearConfig() |
| Income tax position | → | Per-entity tax dispatch | feeds | AUD/year→AUD/year | verified | entityTaxRouter.ts:332 calls calculateTaxPosition for individuals |
| Per-entity tax dispatch | → | Master tax position | feeds | AUD/year→AUD/year | verified | masterTaxPosition.ts:193 maps calculateEntityTaxPosition over entities |
| Income tax position | → | ITAA 1997 — income tax + ATO rates | governed-by | — | verified | marginal brackets + LITO from FY config (taxYearConfig.ts:41,85) |
| Income tax position | → | Medicare Levy Act 1986 | governed-by | — | verified | medicare in grossTax (taxPositionCalculator.ts:242); rate at taxYearConfig.ts:61 |
| Salary take-home (PAYG) | → | ITAA 1997 — income tax + ATO rates | governed-by | — | verified | PAYG take-home uses the same FY brackets/LITO |
| Income tax position | → | Net tax payable | feeds | AUD/year→AUD/year | verified | taxPositionCalculator.ts netTaxPayable output |
| Net tax payable | → | Tax position surface | rendered-at | AUD/year→AUD/year | verified | tax position surface renders netTaxPayable |
| CGT discount (Div 115 / reform Measure 2) | → | ITAA 1997 Div 115 — CGT 50% discount | governed-by | — | verified | cgtDiscount.ts:166 pre-reform 50% discount default |
| CGT discount (Div 115 / reform Measure 2) | → | 2026-27 reform cut-over (Phase 41E) | governed-by | — | verified | cgtDiscount.ts:184 acquisitionContractDate > REFORM_CUT_OVER_UTC (Measure 2 gate) |
| CGT indexation (post-reform) | → | 2026-27 reform cut-over (Phase 41E) | governed-by | — | verified | cgtIndexation.ts:87/96 post-reform indexation, UNCOMPUTED until commencement |
| CGT minimum rate (30% floor, post-reform) | → | 2026-27 reform cut-over (Phase 41E) | governed-by | — | verified | cgtMinimumRate.ts:80 post-reform 30% floor (Measure 2) |
| Negative-gearing regime classifier (Measure 1) | → | 2026-27 reform cut-over (Phase 41E) | governed-by | — | verified | negativeGearingRegime.ts:147 + :31 import REFORM_CUT_OVER_UTC (Measure 1) |
| Super guarantee rate (config) | → | FY tax thresholds (canonical) | feeds | — | verified | taxYearConfig.ts:104 in returned config |
| Concessional cap (config) | → | FY tax thresholds (canonical) | feeds | — | verified | taxYearConfig.ts:106 in returned config |
| Non-concessional cap (config) | → | FY tax thresholds (canonical) | feeds | — | verified | taxYearConfig.ts:107 in returned config |
| Div 293 threshold (config) | → | FY tax thresholds (canonical) | feeds | — | verified | taxYearConfig.ts:108 in returned config |
| Taxed-in-fund 15% rate (config) | → | FY tax thresholds (canonical) | feeds | — | verified | taxYearConfig.ts:109 in returned config |
| FY tax thresholds (canonical) | → | Super guarantee (SG) | feeds | — | verified | contributionCalculator.ts:63 default config; :72 superGuaranteeQuarterlyCap |
| FY tax thresholds (canonical) | → | Super contributions + tax saved | feeds | — | verified | contributionCalculator.ts:115 uses config (15% concessional) |
| FY tax thresholds (canonical) | → | Concessional carry-forward | feeds | — | verified | capTracker.ts:96 default config |
| FY tax thresholds (canonical) | → | Non-concessional bring-forward | feeds | — | verified | capTracker.ts:150 default config; :157 nonConcessionalCap |
| FY tax thresholds (canonical) | → | Div 293 + Div 296 high-income/balance tax | feeds | — | verified | highIncomeSuperTax.ts:85 division293Threshold; :97 superContributionsTaxRate |
| FY tax thresholds (canonical) | → | SMSF income tax (Div 295) | feeds | — | verified | smsfIncomeTax.ts:155 superContributionsTaxRate |
| Super guarantee (SG) | → | Contribution caps + carry/bring-forward | governed-by | — | verified | SG max contribution base (config.superGuaranteeQuarterlyCap) |
| Super contributions + tax saved | → | s295-485 — 15% taxed-in-fund | governed-by | — | verified | contributionCalculator.ts:171 15% concessional contributions tax |
| Concessional carry-forward | → | Contribution caps + carry/bring-forward | governed-by | — | verified | capTracker.ts:96 s291-20 carry-forward |
| Non-concessional bring-forward | → | Contribution caps + carry/bring-forward | governed-by | — | verified | capTracker.ts:148/166 s292-85 bring-forward |
| Div 293 + Div 296 high-income/balance tax | → | Div 293 — extra 15% (high income) | governed-by | — | verified | highIncomeSuperTax.ts:7,97 Div 293 s293-15 |
| Div 293 + Div 296 high-income/balance tax | → | Div 296 — extra 15% on TSB earnings (proposed) | governed-by | — | verified | highIncomeSuperTax.ts:9,101 Div 296 (pending div296CommencementVerified) |
| SMSF income tax (Div 295) | → | Div 295 — taxation of complying super funds | governed-by | — | verified | smsfIncomeTax.ts:13-21 Div 295 + ECPI + NALI |
| SMSF income tax (Div 295) | → | s295-485 — 15% taxed-in-fund | governed-by | — | verified | smsfIncomeTax.ts:155 15% concessional rate s295-485 |
| State land tax (per state) | → | Cross-state land tax (household) | feeds | — | verified | crossStateAggregator.ts:136 calls calculateLandTax per state |
| Cross-state land tax (household) | → | Master tax position | feeds | — | verified | masterTaxPosition.ts:200 crossCutting.landTax = calculateCrossStateLandTax(...) |
| Stamp duty / transfer duty (per state) | → | Master tax position | feeds | — | verified | masterTaxPosition.ts:213 calculateStampDuty(stampInput, config) |
| GST / BAS | → | Master tax position | feeds | — | verified | masterTaxPosition.ts:226 crossCutting.gst = calculateGst(input.gst) |
| State land tax (per state) | → | State Land Tax Acts | governed-by | — | verified | stateLandTax.ts header — per-state Land Tax Acts |
| Cross-state land tax (household) | → | State Land Tax Acts | governed-by | — | verified | cross-state land-tax aggregation |
| Stamp duty / transfer duty (per state) | → | State Duties Acts | governed-by | — | verified | stateStampDuty.ts header — state Duties Acts + foreign surcharge |
| GST / BAS | → | GST Act 1999 | governed-by | — | verified | gstCalculator.ts:38 s9-70 10%; :40 s23-15 threshold |
| FY tax thresholds (canonical) | → | Income tax (marginal brackets) | feeds | — | verified | incomeTaxCalculator.ts:23 default config = getCurrentTaxYearConfig() |
| FY tax thresholds (canonical) | → | Medicare levy (2% + shade-in) | feeds | — | verified | medicareLevyCalculator.ts:40 default config = getCurrentTaxYearConfig() |
| Income tax (marginal brackets) | → | Income tax position | feeds | — | verified | taxPositionCalculator.ts:220 calculateIncomeTax(taxableIncome, fyConfig) |
| Medicare levy (2% + shade-in) | → | Income tax position | feeds | — | verified | taxPositionCalculator.ts:223 calculateMedicareLevy({taxableIncome}, fyConfig) |
| Income tax (marginal brackets) | → | ITAA 1997 — income tax + ATO rates | governed-by | — | verified | ATO marginal brackets from FY config |
| Medicare levy (2% + shade-in) | → | Medicare Levy Act 1986 | governed-by | — | verified | medicareLevyCalculator.ts 2% + shade-in |
| Health aggregate score | → | Health score (with trend/band) | feeds | — | verified | aggregateEngine.ts:321 generateHealthScore calls calculateAggregateScore |
| Health score (with trend/band) | → | Financial health report (SSOT) | feeds | — | verified | aggregateEngine.ts:343 generateHealthReport calls generateHealthScore |
| Health aggregate score | → | Monitrax health-score methodology | governed-by | — | verified | weighted sum − penalty, clamped 0-100 (aggregateEngine.ts:106) |
| Health score (with trend/band) | → | Financial health score | feeds | — | verified | generateHealthScore produces the displayed score |
| Financial health score | → | Home — Health tile | rendered-at | score→score | verified | 00b §3 Home Health tile |
| CFO overall score (weighted) | → | CFO score component weights | governed-by | — | verified | scoreCalculator.ts:730 weighted sum over SCORE_WEIGHTS |
| CFO score (orchestrator) | → | CFO score component weights | governed-by | — | verified | scoreCalculator.ts:64-71 inline weighted sum |
| CFO score (orchestrator) | → | CFO score | feeds | — | verified | calculateCFOScore.overall is the displayed score |
| CFO score | → | /dashboard/cfo — CFO score | rendered-at | score→score | verified | /dashboard/cfo renders the CFO score |
| What-if: cut a spend category | → | What-if annualisation rule | governed-by | — | verified | cutSpendCategory.ts:73 annual = realisedReduction × 12; :12 cap at currentMonthlySpend |
| Cashflow health score (5-category) | → | Cashflow health category weights | governed-by | — | verified | healthScoreAggregator.ts:257-263 weighted sum over CATEGORY_WEIGHTS |
| GRDCS linkage health | → | GRDCS linkage severity thresholds | governed-by | — | verified | linkageHealthService.ts:286-296 severity thresholds |
| Property portfolio report | → | Report aggregation rules | governed-by | — | verified | propertyPortfolio.ts:17-24 Σ aggregations + growth% |
| Loan/debt aggregation (interest) | → | Master financial snapshot | feeds | — | verified | masterFinancialService.ts:1831 aggregateLoanRepayments(loanInputs,"monthly") |
| Declared expense aggregation | → | Master financial snapshot | feeds | — | verified | masterFinancialService.ts:874 aggregateExpenses(...) |
| Loan/debt aggregation (interest) | → | Loan interest = principal × annual rate | governed-by | — | verified | loanAggregator.ts:99-101 principal × interestRateAnnual/12 |
| Loan.principal | → | Loan/debt aggregation (interest) | feeds | — | verified | loanAggregator.ts:90 Number(loan.principal) |
| Expense (declared) | → | Declared expense aggregation | feeds | — | verified | expenseAggregator.ts:94 toMonthly(expense.amount, frequency) |
| Income (declared) | → | Declared income aggregation (gross / net / PAYG) | feeds | AUD/period→AUD/month | verified | incomeAggregator.ts:82 converter(item.amount, item.frequency) |
| Declared income aggregation (gross / net / PAYG) | → | Master financial snapshot | feeds | — | verified | masterFinancialService.ts:1005 aggregateIncome(income.map(mapIncome), targetFrequency) |
| Investment units × price | → | Holding market value (canonical helper) | feeds | —→AUD | verified | assetValuation.ts:45 units × (currentPrice\|\|averagePrice) |
| Holding market value (canonical helper) | → | Net worth | depends-on | — | verified | assetValuation.ts:9-23 — helper mirrors netWorthCalculator basis; read-models share the SSOT |
| Loan.principal | → | Loan current balance (canonical helper) | feeds | AUD→AUD | verified | assetValuation.ts:72 principal ?? currentBalance ?? balance |
| Loan current balance (canonical helper) | → | Net worth | depends-on | — | verified | assetValuation.ts:9-23 — helper mirrors netWorthCalculator liabilities basis |
| NetWorthSnapshot (stored monthly) | → | Net-worth history trend (honest, from stored snapshots) | feeds | AUD→AUD | verified | netWorthHistory.ts:56 prisma.netWorthSnapshot.findMany |
| Net-worth history trend (honest, from stored snapshots) | → | Net-worth trend Δ / Δ% (displayed) | feeds | — | verified | netWorthHistory.ts:85-89 deltaAbsolute/deltaPct |
| Net-worth trend Δ / Δ% (displayed) | → | Dashboard — Net Worth Trend tile | rendered-at | — | verified | app/api/dashboard/charts/route.ts:95 |
| Per-entity position breakdown (additive view) | → | Net worth | depends-on | — | verified | entityBreakdown.ts:134 calculateNetWorth per partition (SSOT reuse) |
| Property.currentValue | → | Per-entity position breakdown (additive view) | feeds | AUD→AUD | verified | entityBreakdown.ts:118 partition by ownerEntityId |
| Loan.principal | → | Per-entity position breakdown (additive view) | feeds | AUD→AUD | verified | entityBreakdown.ts:123 partition by ownerEntityId |
| UnifiedTransaction | → | Money Story 12-month trend (earned vs spent) | feeds | AUD→AUD | verified | moneyStoryTrend.ts:77 prisma.unifiedTransaction.findMany (isTransfer:false) — SSOT repoint 2026-06-25 (legacy Transaction table was dead) |
| Money Story 12-month trend (earned vs spent) | → | Money Story kept margin (displayed) | feeds | —→% | verified | moneyStoryTrend.ts:156,181 currentMargin/marginDeltaPoints |
| Money Story kept margin (displayed) | → | Dashboard — Money Story hero + KPI strip | rendered-at | %→% | verified | app/api/dashboard/insights/route.ts:173 |
| Low Income Tax Offset (config) | → | Low Income Tax Offset (LITO) — two-tier phase-out | feeds | — | verified | taxOffsets.ts:41 const { lito } = config |
| Low Income Tax Offset (LITO) — two-tier phase-out | → | ITAA 1997 — income tax + ATO rates | governed-by | — | verified | ATO Individual income tax rates — LITO (law.itaa1997.incomeTax covers brackets + LITO) |
| Low Income Tax Offset (LITO) — two-tier phase-out | → | Apply offsets to gross tax (refundable vs non-refundable) | feeds | AUD→AUD | verified | taxOffsets.ts:443 nonRefundableOffsets includes offsets.lito |
| Account.currentBalance | → | CFO score (orchestrator) | feeds | — | verified | lib/cfo/scoreCalculator.ts:43 prisma.account.findMany |
| Loan.principal | → | CFO score (orchestrator) | feeds | — | verified | lib/cfo/scoreCalculator.ts:44 prisma.loan.findMany |
| Income (declared) | → | CFO score (orchestrator) | feeds | — | verified | lib/cfo/scoreCalculator.ts:45 prisma.income.findMany |
| Expense (declared) | → | CFO score (orchestrator) | feeds | — | verified | lib/cfo/scoreCalculator.ts:46 prisma.expense.findMany |
| Investment units × price | → | CFO score (orchestrator) | feeds | — | verified | lib/cfo/scoreCalculator.ts:47 prisma.investmentAccount.findMany |
| Property.currentValue | → | CFO score (orchestrator) | feeds | — | verified | lib/cfo/scoreCalculator.ts:51 prisma.property.findMany |
| Property.currentValue | → | Financial health report (SSOT) | feeds | — | verified | app/api/financial-health/route.ts:61 prisma.property → :277 generateHealthReport(input) |
| Loan.principal | → | Financial health report (SSOT) | feeds | — | verified | app/api/financial-health/route.ts:69 prisma.loan |
| Account.currentBalance | → | Financial health report (SSOT) | feeds | — | verified | app/api/financial-health/route.ts:76 prisma.account |
| Income (declared) | → | Financial health report (SSOT) | feeds | — | verified | app/api/financial-health/route.ts:79 prisma.income |
| Expense (declared) | → | Financial health report (SSOT) | feeds | — | verified | app/api/financial-health/route.ts:82 prisma.expense |
| Investment units × price | → | Financial health report (SSOT) | feeds | — | verified | app/api/financial-health/route.ts:85 prisma.investmentAccount |
| Income (declared) | → | Income tax (marginal brackets) | feeds | AUD/year→AUD/year | verified | app/api/tax/route.ts:149 taxableIncome = assessableIncome − deductions (from income) → :257 calculateIncomeTax/Medicare |
| Master financial snapshot | → | Cashflow health score (5-category) | feeds | — | verified | app/api/cashflow/intelligence/route.ts:598 getMasterFinancialSnapshot → :650 calculateCashflowHealthScore |
| Property.currentValue | → | Property portfolio report | feeds | — | verified | app/api/reports/route.ts:107 buildReportContext → lib/reports/generators/index.ts:46 generatePropertyPortfolioReport(context) |
| Master financial snapshot | → | What-if: cut a spend category | feeds | — | verified | lib/cfo/scenarios/cutSpendCategory.ts:22 const {snapshot}=ctx; types.ts:15 ScenarioContext wraps MasterFinancialSnapshot |
| Net worth | → | NetWorthSnapshot (stored monthly) | feeds | — | verified | lib/services/netWorthSnapshotRecorder.ts:52 prisma.netWorthSnapshot.upsert records computed netWorth/totalAssets/totalLiabilities |
| Investment units × price | → | CGT discount (Div 115 / reform Measure 2) | feeds | — | verified | app/api/investments/capital-gains/route.ts:103 CGT discount applied to investment disposal events |
| Master financial snapshot | → | Dashboard insights composer | feeds | — | verified | app/api/dashboard/insights/route.ts:161 getMasterFinancialSnapshot(userId) |
| Money Story 12-month trend (earned vs spent) | → | Dashboard insights composer | feeds | — | verified | app/api/dashboard/insights/route.ts:173 getMoneyStoryTrend(userId,12) — same route composes both |
| Property.currentValue | → | Portfolio relational snapshot (SnapshotV2 — GRDCS SSOT) | feeds | AUD→AUD | verified | app/api/portfolio/snapshot/route.ts:525 prisma.property.findMany |
| Loan.principal | → | Portfolio relational snapshot (SnapshotV2 — GRDCS SSOT) | feeds | AUD→AUD | verified | app/api/portfolio/snapshot/route.ts:538 prisma.loan.findMany |
| Account.currentBalance | → | Portfolio relational snapshot (SnapshotV2 — GRDCS SSOT) | feeds | AUD→AUD | verified | app/api/portfolio/snapshot/route.ts:546 prisma.account.findMany |
| Income (declared) | → | Portfolio relational snapshot (SnapshotV2 — GRDCS SSOT) | feeds | AUD→AUD | verified | app/api/portfolio/snapshot/route.ts:552 prisma.income.findMany |
| Expense (declared) | → | Portfolio relational snapshot (SnapshotV2 — GRDCS SSOT) | feeds | AUD→AUD | verified | app/api/portfolio/snapshot/route.ts:559 prisma.expense.findMany |
| Investment units × price | → | Portfolio relational snapshot (SnapshotV2 — GRDCS SSOT) | feeds | AUD→AUD | verified | app/api/portfolio/snapshot/route.ts:568 prisma.investmentAccount.findMany |
| Portfolio relational snapshot (SnapshotV2 — GRDCS SSOT) | → | GRDCS linkage health | feeds | — | verified | app/api/linkage/health/route.ts:45 calculateLinkageHealth(snapshot) — snapshot is this route's SnapshotV2 (fetchSnapshot :33) |

---

*Generated by `scripts/neomatrix/generate-financial-logic.mjs` from `financial-graph.json`. Part of `0·NEOMATRIX` (Phase 53). Documentation/model only — no financial logic.*

<!-- GENERATED FROM financial-graph.json — DO NOT EDIT BY HAND.
     Regenerate: `npm run neomatrix:generate`. The JSON is the SSOT (Phase 53 §8). -->

# Neomatrix — Generated Core View

> Rendered from `financial-graph.json` (v0.2.0, reviewed 2026-06-23). 
> This file is derived — edit the JSON, not this. Markdown and JSON cannot diverge (CI-checked).

## Coverage & trust (C10)

- **Nodes:** 36 · **Edges:** 38
- **By kind:** orchestrator 2 · engine 9 · input-field 13 · law 5 · number 4 · ui-surface 3
- **By status:** documented 36
- **Edge provenance:** verified 38 *(verified > graphify > inferred)*

## Engine / orchestrator registry

| Node | File:line | Layer | Domain | Produces | Authority | Verified | Status |
|---|---|---|---|---|---|---|---|
| **Master financial snapshot** | `lib/services/masterFinancialService.ts:1704` | service | core | The single financial snapshot: totals, expense/income breakdowns, cashflow (declared), quickMetrics (incl. actual* fields), emergency fund, health score, net worth, debt. | CLAUDE.md §6.1 / §12.2 (Master Financial Service SSOT) | docs/financial-logic/00b_RELATIONSHIPS_AND_LINEAGE.md §2 | documented |
| **Net worth** | `lib/calculations/netWorthCalculator.ts:217` | engine | core | netWorth + asset summary (properties/accounts/investments/super/personalAssets/total), liability summary (mortgages/personalLoans/creditCards/total), breakdown (propertyEquity/liquidAssets/investmentAssets). | Accounting identity: net worth = total assets − total liabilities. | tests/calculations/netWorthCalculator.decimal.test.ts | documented |
| **Declared cashflow** | `lib/calculations/cashflowOrchestrator.ts:302` | engine | core | CashflowResult — monthly/annual gross+net income, PAYG, expenses, loan repayments, cashflow (surplus), ratios (savingsRate/expenseRatio/debtServiceRatio), essential/discretionary split. DECLARED basis (records × frequency), NOT actual bank spend. | CLAUDE.md §19.1 (declared = the 'plan' side; fallback only when no transactions) | tests/calculations/aggregators.decimal.test.ts | documented |
| **Actual cashflow** | `lib/calculations/actualCashflow.ts:104` | engine | core | ActualCashflowResult — current-month outflow/inflow/net, trailing-avg monthly outflow+inflow, current-month outflow-by-category (incl. 'Uncategorised'), hasActualData. From actual UnifiedTransaction rows. | CLAUDE.md §19.1 (actuals; transfers excluded; uncategorised INCLUDED) | tests/calculations/actualCashflow.test.ts | documented |
| **Canonical monthly cashflow** | `lib/calculations/canonicalCashflow.ts:114` | engine | core | CanonicalMonthlyCashflow { inflow, outflow, net, savingsRate, avgMonthlyOutflow, basis } where basis ∈ {actual, declared}. THE SSOT for 'money in/out/net this month'. | CLAUDE.md §19.1 (actuals-vs-declared SSOT) | tests/calculations/canonicalCashflow.test.ts, tests/calculations/cashflowSurfacesUseCanonical.test.ts | documented |
| **Resolve canonical cashflow (the rule)** | `lib/calculations/canonicalCashflow.ts:78` | engine | core | The pure actuals-vs-declared resolution (actual, declared) → canonical result. For routes that compute actuals locally. | CLAUDE.md §19.1 (actuals-vs-declared SSOT) | tests/calculations/canonicalCashflow.test.ts | documented |
| **Master tax position** | `lib/tax-engine/orchestrator/masterTaxPosition.ts:186` | service | tax | Household-wide MasterTaxPositionV2: per-entity dispatch + cross-cutting (land tax/stamp duty/GST) + loss overlays + citations + boundary footer. | CLAUDE.md §6.1 (tax SSOT) + ITAA 1997 | lib/tax-engine/orchestrator/masterTaxPosition.ts:186 (read this session) | documented |
| **Per-entity tax dispatch** | `lib/tax-engine/entity/entityTaxRouter.ts:300` | service | tax | Routes per legal-entity type; PERSONAL_NAME / SOLE_TRADER → wraps calculateTaxPosition(). | ITAA 1997; entity-type tax treatment | lib/tax-engine/entity/entityTaxRouter.ts:300,332 (read this session) | documented |
| **Income tax position** | `lib/tax-engine/position/taxPositionCalculator.ts:92` | engine | tax | TaxPositionResult — assessable income breakdown, deductions, taxable income, tax on income (marginal brackets), Medicare, marginal rate, PAYG, net tax payable/refund. | ITAA 1997 (income tax) + ATO individual income tax rates + Medicare Levy Act 1986 | lib/tax-engine/position/taxPositionCalculator.ts:92 (read this session) | documented |
| **Salary take-home (PAYG)** | `lib/tax-engine/income/salaryProcessor.ts:46` | engine | tax | SalaryBreakdown — gross↔net take-home (handles GROSS and NET input), PAYG, salary-sacrifice, tax-free-threshold flag, step-by-step calc trail. | ITAA 1997 (income tax) + ATO PAYG withholding | lib/tax-engine/income/salaryProcessor.ts:46 (read this session) | documented |
| **FY tax thresholds (canonical)** | `lib/tax-engine/config/taxYearConfig.ts:370` | service | tax | The canonical TaxYearConfig for the current FY (brackets, Medicare, LITO, super caps, transfer-balance cap, etc.) — the SSOT for AU tax thresholds (CLAUDE.md §12.2). | ATO individual income tax rates / Medicare Levy / Super thresholds + ITAA sections (cited inline in source) | lib/tax-engine/config/taxYearConfig.ts:370 (read this session) | documented |

## Worked examples (the A1 fixtures — §14)

| Engine | Worked example (input → expected output) |
|---|---|
| **Net worth** | property 800,000 + account 20,000 + (100 units × 50) − loan 600,000 = 225,000 |
| **Declared cashflow** | net income 8,000/mo − expenses 5,000 − loans 1,000 = 2,000/mo; savingsRate = 2,000/8,000 = 25% |
| **Actual cashflow** | Mar 10 + May 600 both populated, Apr empty → divisor 2 → avg 305 (a month with no txns is missing data, excluded from sum AND divisor) |
| **Canonical monthly cashflow** | In 25,827 / Out 46,741 → net −20,914; savingsRate ≈ −80.98%; basis 'actual' (the real deficit the old declared hero hid as +$10,505 / 51.9%) |

## Number lineage — how each displayed number is born

| Number (semanticKey) | Engine ancestor(s) | Rendered at | Formula | Authority |
|---|---|---|---|---|
| **Net worth (displayed)** (`netWorth`) | Net worth | Home — Net worth tile | = calculateNetWorth(...).netWorth | Accounting identity |
| **Monthly cash flow (this month)** (`monthlyCashflow`) | Canonical monthly cashflow, Actual cashflow, Declared cashflow, Net worth | /cashflow — hero | = getCanonicalMonthlyCashflow(snapshot).net | CLAUDE.md §19.1 |
| **Saving rate** (`savingsRate`) | Canonical monthly cashflow, Actual cashflow, Declared cashflow, Net worth | /cashflow — hero | = getCanonicalMonthlyCashflow(snapshot).savingsRate | CLAUDE.md §19.1 |
| **Net tax payable** (`taxPayable`) | Income tax position, FY tax thresholds (canonical) | Tax position surface | = calculateTaxPosition(...).netTaxPayable (gross tax − offsets − PAYG) | ITAA 1997 + Medicare Levy Act 1986 |

## Governing laws / authorities (B6)

| Law | Statement | Authority | Governs |
|---|---|---|---|
| **Net worth = assets − liabilities** | net worth = total assets − total liabilities | Standard accounting identity | Net worth |
| **Actuals-vs-declared SSOT** | actuals win when present; declared is fallback only | CLAUDE.md §19.1 | Canonical monthly cashflow, Resolve canonical cashflow (the rule) |
| **ITAA 1997 — income tax + ATO rates** | tax on income via marginal brackets; LITO offset applied. | ITAA 1997; ATO Individual income tax rates (https://www.ato.gov.au/rates/individual-income-tax-rates/) | Income tax position, Salary take-home (PAYG) |
| **Medicare Levy Act 1986** | levy = 2% of taxable income above the threshold (shade-in to 125%). | Medicare Levy Act 1986; ATO Medicare Levy | Income tax position |
| **2026-27 reform cut-over (Phase 41E)** | asset acquired after the cut-over → post-reform regime (per measure commencement). | 2026-27 Federal Budget; CLAUDE.md §12.14 |  |

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

---

*Generated by `scripts/neomatrix/generate-financial-logic.mjs` from `financial-graph.json`. Part of `0·NEOMATRIX` (Phase 53). Documentation/model only — no financial logic.*

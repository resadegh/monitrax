<!-- GENERATED FROM financial-graph.json — DO NOT EDIT BY HAND.
     Regenerate: `npm run neomatrix:generate`. The JSON is the SSOT (Phase 53 §8). -->

# Neomatrix — Generated Core View

> Rendered from `financial-graph.json` (v0.1.0, reviewed 2026-06-23). 
> This file is derived — edit the JSON, not this. Markdown and JSON cannot diverge (CI-checked).

## Coverage & trust (C10)

- **Nodes:** 23 · **Edges:** 26
- **By kind:** orchestrator 1 · engine 5 · input-field 10 · law 2 · number 3 · ui-surface 2
- **By status:** documented 23
- **Edge provenance:** verified 26 *(verified > graphify > inferred)*

## Engine / orchestrator registry

| Node | File:line | Layer | Domain | Produces | Authority | Verified | Status |
|---|---|---|---|---|---|---|---|
| **Master financial snapshot** | `lib/services/masterFinancialService.ts:1704` | service | core | The single financial snapshot: totals, expense/income breakdowns, cashflow (declared), quickMetrics (incl. actual* fields), emergency fund, health score, net worth, debt. | CLAUDE.md §6.1 / §12.2 (Master Financial Service SSOT) | docs/financial-logic/00b_RELATIONSHIPS_AND_LINEAGE.md §2 | documented |
| **Net worth** | `lib/calculations/netWorthCalculator.ts:217` | engine | core | netWorth + asset summary (properties/accounts/investments/super/personalAssets/total), liability summary (mortgages/personalLoans/creditCards/total), breakdown (propertyEquity/liquidAssets/investmentAssets). | Accounting identity: net worth = total assets − total liabilities. | tests/calculations/netWorthCalculator.decimal.test.ts | documented |
| **Declared cashflow** | `lib/calculations/cashflowOrchestrator.ts:302` | engine | core | CashflowResult — monthly/annual gross+net income, PAYG, expenses, loan repayments, cashflow (surplus), ratios (savingsRate/expenseRatio/debtServiceRatio), essential/discretionary split. DECLARED basis (records × frequency), NOT actual bank spend. | CLAUDE.md §19.1 (declared = the 'plan' side; fallback only when no transactions) | tests/calculations/aggregators.decimal.test.ts | documented |
| **Actual cashflow** | `lib/calculations/actualCashflow.ts:104` | engine | core | ActualCashflowResult — current-month outflow/inflow/net, trailing-avg monthly outflow+inflow, current-month outflow-by-category (incl. 'Uncategorised'), hasActualData. From actual UnifiedTransaction rows. | CLAUDE.md §19.1 (actuals; transfers excluded; uncategorised INCLUDED) | tests/calculations/actualCashflow.test.ts | documented |
| **Canonical monthly cashflow** | `lib/calculations/canonicalCashflow.ts:114` | engine | core | CanonicalMonthlyCashflow { inflow, outflow, net, savingsRate, avgMonthlyOutflow, basis } where basis ∈ {actual, declared}. THE SSOT for 'money in/out/net this month'. | CLAUDE.md §19.1 (actuals-vs-declared SSOT) | tests/calculations/canonicalCashflow.test.ts, tests/calculations/cashflowSurfacesUseCanonical.test.ts | documented |
| **Resolve canonical cashflow (the rule)** | `lib/calculations/canonicalCashflow.ts:78` | engine | core | The pure actuals-vs-declared resolution (actual, declared) → canonical result. For routes that compute actuals locally. | CLAUDE.md §19.1 (actuals-vs-declared SSOT) | tests/calculations/canonicalCashflow.test.ts | documented |

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

## Governing laws / authorities (B6)

| Law | Statement | Authority | Governs |
|---|---|---|---|
| **Net worth = assets − liabilities** | net worth = total assets − total liabilities | Standard accounting identity | Net worth |
| **Actuals-vs-declared SSOT** | actuals win when present; declared is fallback only | CLAUDE.md §19.1 | Canonical monthly cashflow, Resolve canonical cashflow (the rule) |

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

---

*Generated by `scripts/neomatrix/generate-financial-logic.mjs` from `financial-graph.json`. Part of `0·NEOMATRIX` (Phase 53). Documentation/model only — no financial logic.*

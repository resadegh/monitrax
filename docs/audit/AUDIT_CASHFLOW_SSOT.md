# Audit — Cashflow, Net-Worth & SSOT Correctness

**Date:** 2026-06-23
**Scope:** READ-ONLY. No app code changed. Verifies that CASHFLOW, NET-WORTH and the SSOT
surfaces produce correct numbers that reflect REAL transactions.
**Method:** every claim cites `file:line` with the quoted line; every verdict carries a
worked example (hand-computed in → expected out) or an AU-law/financial-definition citation.
Worked examples were re-implemented and run in Node (`node verify.mjs`) and the existing
vitest suites (`actualCashflow.test.ts`, `assetValuation.test.ts`) were executed — both PASS.

**Verdict legend:** ✅ verified correct · ❌ wrong (wrong vs correct number shown) ·
⚠️ UNVERIFIABLE (reason stated).

**Already-fixed items NOT re-reported** (per brief): loan-interest `/100` 100× bug,
income-tax bracket-boundary `<=` bug, the Phase-1 cashflow ACTUALS path baseline.

---

## 1. Verdict table

| # | Surface / formula | file:line | Implemented | Correct? | Worked-example / law evidence | Basis | Sev | Fix |
|---|---|---|---|---|---|---|---|---|
| 1 | `toAnnual` WEEKLY ×52 / FORTNIGHTLY ×26 / QUARTERLY ×4 / HALF_YEARLY ×2 / ANNUAL ×1 | `lib/utils/frequencies.ts:9-23` | `WEEKLY: amount*52` … `QUARTERLY: amount*4` | ✅ | $500/wk → `500*52 = 26,000`/yr; $1,000/fn → `1000*26/12 = 2,166.67`/mo; $300/qtr → `300*4/12 = 100`/mo. All exact. | n/a | — | none |
| 2 | `toMonthly = toAnnual / 12` | `lib/utils/frequencies.ts:30` | `return toAnnual(amount, frequency) / 12` | ✅ | $12,000/yr → `12000/12 = 1,000`/mo. Note: WEEKLY→monthly is `×52/12 = ×4.333` (calendar-correct, NOT ×4.0). Confirmed exact. | n/a | — | none |
| 3 | `toMonthlyDecimal` / `toAnnualDecimal` | `lib/utils/frequencies.ts:85-118` | `dec.times(52)…`, `.div(12)` | ✅ | Same factors as Float path; null/undefined → `Decimal(0)` matching `Number(x\|\|0)`. | n/a | — | none |
| 4 | Net worth = Σassets − Σliabilities | `netWorthCalculator.ts:247` | `netWorth: assets.total - liabilities.total` | ✅ | assets 1,055,000 (prop 800k + accts 50k + inv 5k + super 200k) − mortgage 500k = **555,000**. Matches. | net-worth definition | — | none |
| 5 | Total assets sum | `netWorthCalculator.ts:117-152` | property + account + (units×price) + super(non-SMSF) + personalAssets | ✅ | inv 100 units × `currentPrice 50` = 5,000 (falls back to `averagePrice` when no live price, :128). | n/a | — | none |
| 6 | Property equity = value − loan balance | `netWorthCalculator.ts:236` | `propertyEquity = assets.properties - liabilities.mortgages` | ✅ | 800,000 − 500,000 = **300,000**. `Loan.principal` is schema-documented "Current balance" (`schema.prisma:1623`), so it IS outstanding balance, not face amount. | equity definition | — | none |
| 7 | LVR = loan / value | `lib/utils/calculations.ts:9-12` | `(loanBalance / propertyValue) * 100`; 0 when value=0 | ✅ | 500,000/800,000×100 = **62.50%**. Div-zero guarded. | LVR definition | — | none |
| 8 | Rental yield = annual rent / value | `lib/utils/calculations.ts:30-33` | `(annualRent / propertyValue) * 100` | ✅ | 39,000/800,000×100 = **4.875%** (gross yield). Div-zero guarded. | gross rental yield | — | none |
| 9 | OFFSET handling in net worth (no double-count) | `netWorthCalculator.ts:122-125` (assets incl. all accounts) + `:239-241` (liquidAssets excludes OFFSET) | OFFSET balance counted in `assets.accounts`; loan principal at full face | ✅ | Offset 30k counted as asset; mortgage 500k counted as full liability → nets correctly (offset cash is a real asset, loan is a real liability). `liquidAssets` breakdown excludes OFFSET (presentation only). No double-count. | double-entry | — | none |
| 10 | Liabilities classification (mortgage/personal/CC) | `netWorthCalculator.ts:191-202` | `HOME`/`INVESTMENT`/`propertyId`→mortgage; `CREDIT_CARD`→cc; else personal | ⚠️ | Contract-correct but FRAGILE: a loan typed literally `'MORTGAGE'` falls through to **personalLoans** (documented :174-177). Total liabilities + net worth are UNAFFECTED (all three buckets sum into total). Only the mortgage/personal SPLIT mis-buckets, which feeds `propertyEquity` (:236). If a property loan lacks `propertyId` AND is typed `MORTGAGE`, propertyEquity is overstated. | — | P2 | enforce `HOME`/`INVESTMENT` at loan-creation; or treat `propertyId`-set as the sole mortgage signal |
| 11 | Cashflow surplus = net income − expenses − loan repayments | `cashflowOrchestrator.ts:373` | `monthlyCashflow = monthlyNetIncome - monthlyExpenses - monthlyLoanRepayments` | ✅ | NET 6,000 − exp 3,000 − loan 1,500 = **1,500**/mo. Loan repayments are subtracted SEPARATELY from expenses — verified no double-count: master maps expenses (`:1807-1811`) and loans (`:1812-1817`) from disjoint tables. | cashflow definition | — | none |
| 12 | Savings rate = surplus / net income × 100 | `cashflowOrchestrator.ts:376-377` | `(monthlyCashflow / monthlyNetIncome) * 100` | ✅ (formula) ⚠️ (basis) | 1,500/6,000×100 = **25%**. Formula correct, but computed on DECLARED income/expense — see §2 (actuals not used). | — | P1 | feed actuals (see §2) |
| 13 | Loan repayments NOT in expenses | `masterFinancialService.ts:1807-1817` | expenses from `Expense` table; loans from `Loan` table | ✅ | Disjoint sources; subtracted independently in `:373`. No double-count. | — | — | none |
| 14 | Emergency fund months = liquid cash / monthly expenses | `masterFinancialService.ts:1292` | `monthsCovered = liquidCash / monthlyExpenses` | ✅ (formula) ❌ (basis) | 20,000/3,000 = **6.667 months**. BUT `monthlyExpenses` = `monthlyExpenses.all.total` (DECLARED, `:1904`), NOT `actualAvgMonthlyOutflow`. If a user spends 5,000/mo actual but declared only 3,000, true runway is 4.0 months, shown 6.67 — **falsely optimistic by 67%**. | — | **P0** | use `actualAvgMonthlyOutflow` when `hasActualData`, else declared |
| 15 | Health score savings-rate component | `masterFinancialService.ts:1320-1323` | declared income/expense/loan | ⚠️ | Formula `savingsRate*5` capped 0-100 is arbitrary-but-consistent; basis is DECLARED (`:1909-1911`), so a user with heavy uncategorised spend scores too high. | — | P1 | feed actuals into health input |
| 16 | `keptMargin` = kept-after-essentials / gross income | `masterFinancialService.ts:1978-1983` | `(netTotal − essential.total) / grossIncome × 100` | ✅ (formula) ⚠️ (basis) | net 6,000 − essential 2,000 = 4,000; /gross 7,500 ×100 = **53.3%**. Declared basis; the `dashboard/insights` consumer DOES switch to actuals (`keptActual`), so the surfaced Money-Story value is correct; the raw quickMetric is declared. | mixed | P2 | (consumer already gates on actuals) |
| 17 | `freeCashDays` = liquidCash / (monthlyExpenses/30) | `masterFinancialService.ts:1984-1987` | declared monthlyExpenses | ⚠️ | 20,000/(3,000/30)=**200 days** declared; on 5,000 actual it's 120 days. Falsely optimistic if uncategorised spend exists. Uses 30-day month (approx, acceptable). | — | P1 | use actual avg outflow |
| 18 | Investment unrealised gain | `masterFinancialService.ts:1191-1194` | `totalValue − totalCostBase`; %=gain/costBase | ✅ | 100×50 value 5,000 − 100×40 cost 4,000 = **+1,000 (25%)**. Div-zero guarded. | n/a | — | none |
| 19 | Property monthly cashflow | `masterFinancialService.ts:1137-1138` | `monthlyRent − monthlyExpenses − monthlyLoanRepayments` | ✅ | rent 3,250 − exp 800 − repay 2,400 = **+50**/mo. Consistent with household formula. | n/a | — | none |
| 20 | `byEntity.monthlyCashflow` (per-entity) | `entityBreakdown.ts:167` | `monthlyIncome - monthlyExpenses` (**no loan repayments**) | ❌ | Household cashflow subtracts loan repayments (`:373`); per-entity does NOT. An entity with income 5,000, expenses 2,000, loan repay 2,500 shows **+3,000** but true is **+500**. Divergence: two definitions of "monthlyCashflow" across surfaces. | cashflow definition | P1 | subtract entity loan repayments (entity loans are already bucketed, `:123`) |
| 21 | Net-worth history trend | `netWorthHistory.ts:76-89` | literal stored `NetWorthSnapshot` rows; empty when <2 points | ✅ | Honest: no `Math.random` backfill; deltaPct guarded for first=0. Reads one canonical table. | — | — | none |
| 22 | Entity value breakdown | `entityValueBreakdown.ts:126-141` | reuses `calculateTotalAssets/Liabilities` per entity via `ownerEntityId` | ✅ | No re-implementation; per-entity sums reconcile to household totals (additivity). Super folded into accounts/investments (`:130`), avoiding the SMSF double-count. | — | — | none |
| 23 | SMSF super exclusion | `netWorthCalculator.ts:136-138` | `.filter(s => s.fundType !== 'SMSF')` | ✅ | SMSF member balance excluded so the fund isn't double-counted (its assets flow via the SMSF entity's owned objects). | — | — | none |

---

## 2. Surfaces still on DECLARED basis when ACTUALS exist (the rule violations)

The non-negotiable rule: **when `UnifiedTransaction` rows exist (`hasActualData === true`), the
user-visible spend/income/cashflow/savings/runway number MUST use actuals; declared records are
fallback only.** `masterFinancialService` already computes the actual fields
(`quickMetrics.actualMonthlyOutflow/actualAvgMonthlyOutflow/actualNetCashflow/...`,
`:1992-1997`) from `computeActualCashflow()` — but several headline surfaces ignore them.

**Reference-correct implementation (the pattern others should copy):**
`app/api/cashflow/summary/route.ts:95-104` —
`const monthlyOutflow = qm.hasActualData ? qm.actualAvgMonthlyOutflow : declaredOutflow;`
Falls back to declared when no txns. ✅

| Surface | file:line | Computes spend how | No-txn fallback correct? | Sev |
|---|---|---|---|---|
| **Emergency fund `monthsCovered`** | `masterFinancialService.ts:1292,1904` | `liquidCash / monthlyExpenses.all.total` (DECLARED) | ❌ N/A — never reads actuals at all; pure declared | **P0** |
| **Reports `cashflowRunway`** | `lib/reports/contextBuilder.ts:224-225,239-250` | `liquidAssets / calculateMonthlyExpenses()` where `calculateMonthlyExpenses` = `prisma.expense.findMany` + local `convertToMonthly` reduce | ❌ — never reads `UnifiedTransaction`; always declared | **P0** |
| **`/api/financial-health`** | `financial-health/route.ts:125-128,190-196` | own `reduce()` over `prisma.expense/income/loan` × `toMonthly` | ❌ — ignores transactions entirely; always declared | P1 |
| **`/api/cashflow` (lite mode)** | `cashflow/route.ts:307-309` | `income.reduce(toMonthly)` / `expenses.reduce(toMonthly)` | ❌ — lite mode always declared (full mode does use txns via `generateForecast`) | P1 |
| **`/api/cashflow/intelligence` forecast + health** | `cashflow/intelligence/route.ts:593,599-617,672` | `calculateMonthlyExpenses(data.expenses)` (own declared reduce) feeds forecast + health score | ❌ — forecast 30/90-day, break-even, health score all declared. (Waterfall + budget-vs-actual DO use actuals, `:656-666` ✅) | P1 |
| **`/api/dashboard/insights` category + emergency-fund + savingsRate** | `dashboard/insights/route.ts:195,204-225,237-263,269` | own `prisma.expense.findMany` + `toMonthly` for category breakdown & moneyBleeding; emergency-fund + savingsRate read declared off master | ⚠️ partial — Money-Story Kept/surplus correctly gate on `hasActualData` (`:375,384-386` ✅), but spend-by-category, savingsRate and emergency-fund are declared | P1 |
| **`emergencyFund`-derived `healthScore`** | `masterFinancialService.ts:1908-1915` | declared monthlyExpenses → monthsCovered → emergency-fund score | ❌ — inherits the §2 P0 declared runway | P1 |

**Declared-by-design (acceptable, NOT violations):**
- `app/api/portfolio/snapshot/route.ts:646-656` — GRDCS relational SnapshotV2, a deliberate
  second SSOT (CLAUDE.md §12.2); answers "portfolio as a graph", not "what did I spend".
- `app/api/budget-analysis/generate/route.ts:121-128` — builds the budget PLAN; declared is the
  plan side of plan-vs-actual.
- `app/api/calculate/cashflow/route.ts` — pure declared calculator endpoint by purpose.

---

## 3. SSOT violations (§6.1 / §12.2 / §12.3)

Routes doing their own `reduce()` over `prisma.expense/income/loan/account` instead of
`getMasterFinancialSnapshot()`:

| Route | file:line | What it re-aggregates | Note |
|---|---|---|---|
| `/api/financial-health` | `:125-128,190-196,559-561,617-623` | expenses/income/loans × `toMonthly` | No call to master; full re-implementation |
| `lib/reports/contextBuilder.ts` | `:239-252` | expenses × **local `convertToMonthly`** (duplicates `lib/utils/frequencies.toMonthly`) | Two violations: own reduce + duplicated frequency converter |
| `/api/cashflow` (lite) | `:307-309` | income/expenses × `toMonthly` | |
| `/api/cashflow/intelligence` | `:125-130,593` | `calculateMonthlyExpenses` local reduce feeds forecast/health | |
| `/api/dashboard/insights` | `:182,204-225,237-263` | category breakdown + moneyBleeding own `prisma.expense` reduce | Mixes master + own reduce in one route |
| `/api/portfolio/snapshot` | `:646-656` | expenses/income/loans × `toAnnual` | Sanctioned separate SSOT (§12.2) — flagged for completeness only |
| `/api/budget-analysis/generate` | `:121-128` | expenses/loans × `toMonthly` | Sanctioned (plan construction) |

**Concept computed two different ways (divergence):**
- **"monthlyCashflow"** — household = income − expenses − loan repayments
  (`cashflowOrchestrator.ts:373`); per-entity = income − expenses, **loan repayments omitted**
  (`entityBreakdown.ts:167`). Same field name, two definitions (finding #20, P1).
- **frequency→monthly** — canonical `toMonthly` (`frequencies.ts:30`) vs local `convertToMonthly`
  in `lib/reports/contextBuilder.ts:252`. Verify the local copy uses calendar-correct factors
  (×52/12), not ×4.33 hard-coded — ⚠️ not fully read; flag for the duplicate-removal PR.

---

## 4. Ranked P0 list (wrong numbers a user sees)

1. **Emergency-fund months of cover is computed on DECLARED expenses, not actual spend.**
   `masterFinancialService.ts:1292` + `:1904`. Worked example: liquid cash $20,000, declared
   essentials $3,000/mo but **actual** average outflow $5,000/mo (uncategorised spend dropped by
   the declared path). Shown: **6.67 months**. Correct: **4.0 months**. Overstated by 67% — the
   single most safety-relevant number in the app is falsely reassuring. Same root error cascades
   into `healthScore.emergencyFund` (`:1908-1915`).
   *Fix:* `monthsCovered = liquidCash / (hasActualData ? actualAvgMonthlyOutflow : declaredMonthlyExpenses)`.

2. **Reports `cashflowRunway` is computed on DECLARED expenses, not actual spend.**
   `lib/reports/contextBuilder.ts:224-225` (`liquidAssets / calculateMonthlyExpenses()`),
   `:239-250` (own `prisma.expense` reduce, never touches `UnifiedTransaction`). Worked example:
   liquid $20,000, declared $3,000 → runway **7 months** (rounded); actual $5,000 → **4 months**.
   The PDF/report a user hands to an adviser shows the optimistic declared figure.
   *Fix:* read `getMasterFinancialSnapshot().quickMetrics.actualAvgMonthlyOutflow` with declared
   fallback; delete the local `calculateMonthlyExpenses` + `convertToMonthly`.

> Both P0s are the SAME class of bug already fixed for the cashflow waterfall / Money-Story in
> Phase 1: the declared path silently drops uncategorised/unlinked OUT transactions, making
> runway and months-of-cover falsely optimistic. The fix is identical — gate on `hasActualData`
> and read `actualAvgMonthlyOutflow`, exactly as `cashflow/summary/route.ts:95-104` already does.

---

## 5. Verification evidence

- Frequency, net-worth, cashflow, emergency-fund worked examples re-implemented and run in Node —
  all outputs matched the hand-computed expected values (see verdict table).
- `npx vitest run tests/calculations/actualCashflow.test.ts tests/calculations/assetValuation.test.ts`
  → **24 passed** (confirms `computeActualCashflow` excludes transfers, includes Uncategorised
  OUT, 3-month trailing average divisor = 3; confirms `loanBalance`/`holdingMarketValue` match the
  canonical net-worth engine).
- `Loan.principal` confirmed as "Current balance" at `prisma/schema.prisma:1623` (validates the
  equity/LVR/net-worth basis).

**Not independently verifiable here (⚠️):** the runtime distribution of `Loan.type` values
(finding #10) — whether any production loans are typed `'MORTGAGE'` without `propertyId` — requires
DB inspection, which this read-only audit did not perform.

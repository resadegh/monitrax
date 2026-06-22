# Audit — Debt Reduction, CFO What-Ifs & Projections (numeric correctness)

> **Type:** READ-ONLY correctness audit. No app code changed.
> **Date:** 2026-06-22
> **Scope:** Debt Freedom / debt-reduction planner, CFO what-if scenarios, projections/forecasts (net-worth, money-story, runway, 10-year).
> **Method:** formula-by-formula, file:line cited, ≥2 worked examples per engine, edge cases, SSOT + actuals-vs-declared checks.

---

## 0. The load-bearing fact: the rate-unit convention

`Loan.interestRateAnnual` is stored as a **DECIMAL** (`0.0625` for 6.25%). This is the canonical truth, proven three ways:

- `prisma/schema.prisma:1624` — `interestRateAnnual Float // e.g., 0.0625 for 6.25%`
- `components/loans/LoanFormDialog.tsx:71-72, 409, 413` — the form displays `value * 100` and saves `Number(e.target.value) / 100`, and the JSDoc says *"`interestRateAnnual` is the **decimal**"*.
- `app/api/loans/route.ts:267` — stores `parseFloat(interestRateAnnual)` straight through (no scaling), and the import-mapping at `LoanFormDialog.tsx:205` normalises `rate > 1 ? rate/100 : rate` (i.e. > 1 means a percent was typed → divide).

**Every engine MUST therefore treat the field as a decimal** (`rate/12` for monthly interest, `rate*12` for annual). Engines that divide by 100 again are wrong by **100×**. This single inconsistency is the root cause of the P0/P1 findings below.

Engines that get it RIGHT (decimal): `debtPlanner.ts`, `payDownLoan.ts`, `redirectToOffset.ts`, `refinanceLoan.ts`, `salarySacrificeToSuper.ts`, `loanDecisionSupport.calculatePayoffMonths`, `app/api/ai/debt-analysis/route.ts:480`, `app/api/financial-health/route.ts:145`, `app/api/dashboard/insights` (via master).

Engines that get it WRONG (÷100 on an already-decimal value): `loanAggregator.ts` (canonical SSOT!), `loanDecisionSupport.ts:218`, `app/api/cashflow/intelligence/route.ts:439`.

---

## 1. Findings table

| Engine / formula | file:line | Implemented | Correct? | Worked-example evidence | Severity | Fix |
|---|---|---|---|---|---|---|
| **loanAggregator — monthly/total interest** | `lib/calculations/loanAggregator.ts:95-97` (Float) & `:234-236` (Decimal) | `interestRateMonthly = interestRateAnnual / 100 / 12` | ❌ | Input is decimal `0.06`. Code: `100000 × 0.06/100/12 = $5.00/mo`. Correct: `100000 × 0.06/12 = $500.00/mo`. **100× understated.** | **P0** | Remove `/100` (use `/12` only). This is the canonical SSOT engine — every consumer of `debtSummary.totalInterest` inherits the error. |
| **loanAggregator — weightedInterestRate** | `lib/calculations/loanAggregator.ts:102, 112` (`:241, 254` Decimal) | `weightedRateSum += principal × interestRateAnnual; rate = sum/totalPrincipal` | ⚠️ | Returns the principal-weighted **decimal** (e.g. `0.06503`). Internally consistent (no /100 here), BUT it is a decimal, and a downstream consumer assumes it's a percent (see next row). The field's unit is undocumented → guaranteed misuse. | **P1** | Document the unit in the interface; or standardise the field to percent and fix the divide. Today it silently mismatches its own `totalInterest` sibling's broken /100. |
| **loanDecisionSupport — weightedAverageRate** | `lib/cfo/decisionSupport/loanDecisionSupport.ts:218` | `weightedAverageRate: aggregation.weightedInterestRate / 100 // "Convert back to decimal"` | ❌ | `weightedInterestRate` is already `0.06503`. `/100 → 0.0006503` (0.065%). **100× understated** rate shown in CFO loan decision support. The comment proves the author wrongly believed the field was a percent. | **P0** | Remove `/100`. (Field is already a decimal.) |
| **cashflow/intelligence — deductible inv-loan interest** | `app/api/cashflow/intelligence/route.ts:439` | `annualInterest = principal × (interestRateAnnual / 100)` | ❌ | $500k inv loan @ `0.06`: code = `500000 × 0.06/100 = $300`. Correct = `$30,000`. **100× understated deduction** → overstated taxable income → overstated estimated tax shown to user. | **P0** | Remove `/100`: `principal × interestRateAnnual`. |
| **debtPlanner — monthly interest** | `lib/planning/debtPlanner.ts:106-110` | `effectivePrincipal × (annualRate / 12)`, offset-aware | ✅ | $100k @ 0.06, $1,000/mo → first-month interest `$500`, principal `$500`. Full sim: **139 months**, total interest **$38,975.78** (verified by independent node run). Matches standard amortisation. | — | None. |
| **debtPlanner — minRepayment (PI amortisation)** | `lib/planning/debtPlanner.ts:143-151` | `M = P·r(1+r)^n / ((1+r)^n − 1)`, `r = annualRate/12` | ✅ | Standard amortisation formula, decimal rate. Correct. Edge: `annualRate<=0 → returns principal` (pay-off-now) — acceptable guard. | — | None. |
| **debtPlanner — avalanche ordering** | `lib/planning/debtPlanner.ts:511-515` | `reduce → highest interestRateAnnual` | ✅ | Highest-rate-first. Correct. | — | None. |
| **debtPlanner — snowball ordering** | `lib/planning/debtPlanner.ts:517-521` | `reduce → smallest currentPrincipal` | ✅ | Smallest-balance-first, recomputed each month on **current** principal. Correct. | — | None. |
| **debtPlanner — rollover (freed payment)** | `lib/planning/debtPlanner.ts:388-390, 426-428` | On payoff, `availableSurplus += minRepaymentMonthly` if `rolloverRepayments` | ✅ | Freed-up minimums roll into surplus → snowball/avalanche "debt snowball" effect modelled correctly. | — | None. |
| **debtPlanner — offset reduces interest base** | `lib/planning/debtPlanner.ts:106-110` | `Math.max(0, principal − offsetBalance) × r/12` | ✅ | Offset correctly reduces the interest-bearing base; never negative. | — | None — but offset is **held static** (`projectOffsetBalance` is a no-op, `:214-222`). Documented limitation, not a bug. |
| **debtPlanner — negative amortisation guard** | `lib/planning/debtPlanner.ts:312-315, 376-378` | IO loan + no surplus → `isNonPayoffable`; P&I principalPortion only applied if `>0` | ✅ | If repayment < interest, principal is not reduced (no false payoff). IO-with-no-surplus correctly returns `null` payoff (not a fake "debt-free" date). Good. | — | None. |
| **payDownLoan (what-if) — interest saved + months reduced** | `lib/cfo/scenarios/payDownLoan.ts:118-138` (Float) / `:147-176` (Decimal) | `walkAmortisation`: `interest = calculateInterestForPeriod(P, rate, 12)`; `principalPayment = max(0, repay − interest) + extra` | ✅ | $400k @ 0.055, min $2,500/mo, +$500: baseline 290 mo / $322,609 int; accel 207 mo / $219,610 int → **saved $102,999, 83 months sooner** (verified). Correct decimal handling. | — | None. Note `monthlyRepayment` = **minimum** repayment from run route (`:91`) — correct baseline. |
| **redirectToOffset (what-if)** | `lib/cfo/scenarios/redirectToOffset.ts:39-50` | `interest = effectivePrincipal × rate/12` before vs after offset top-up | ✅ | Decimal rate, offset reduces base, monthly→annual ×12. Already-fully-offset guard present (`:71`). Correct. | — | None. |
| **refinanceLoan (what-if)** | `lib/cfo/scenarios/refinanceLoan.ts:42, 163-165` | `calculatePIRepayment(P, newRate, months)`; `newRate` decimal | ✅ | Treats both old/new rate as decimal consistently; `*100` only for display. Correct. | — | None. |
| **salarySacrificeToSuper (what-if)** | `lib/cfo/scenarios/salarySacrificeToSuper.ts` | SG + sacrifice + Div 293 + concessional-cap guard + Div 296 regime gate | ✅ | Take-home delta = `−sacrifice + marginal-tax-saved`; contributions tax/Div293 reduce super not cashflow (correct). Cap hard-stop and FW-2 reform gate present. Sound. | — | None. TSB sums all super incl. SMSF (`sumSuperBalance`, correct per ATO). |
| **calculatePayoffMonths (decision support)** | `lib/cfo/decisionSupport/loanDecisionSupport.ts` | `n = −log(1 − P·r/M)/log(1+r)`, `r = annualRate/12` (decimal) | ✅ | Closed-form payoff. Uses decimal rate (consistent with schema). `payment ≤ interest → 999` guard. Correct — and notably contradicts the `/100` bug 200 lines below it in the **same file**. | — | None (but see file-internal inconsistency, P1 row above). |
| **calculateTotalInterest (decision support)** | `lib/cfo/decisionSupport/loanDecisionSupport.ts` | `totalPayments − principal` | ✅ | Correct provided `months` is correct (it is). `annualRate` param unused — harmless. | — | None. |
| **tenYearProjection** | `lib/cfo/scenarios/tenYearProjection.ts:43-119` | Per-year compound: assets ×1.04, super ×1.06 + contrib, cashflow delta wage-indexed ×1.025 | ✅ | FV = PV(1+r)^n applied per-year with annual compounding consistently. Real-terms, assumptions surfaced, AFSL-honest ("projection not forecast"). Math sound. | — | None. Conservative defaults are reasonable. |
| **netWorthHistory (trend)** | `lib/calculations/netWorthHistory.ts` | Reads stored `NetWorthSnapshot` rows; `<2 pts → empty` | ✅ | No fabrication (replaced old `Math.random` backfill). `deltaPct` divides by `abs(first)`, guarded for `first===0`. Honest. | — | None. |
| **moneyStoryTrend** | `lib/calculations/moneyStoryTrend.ts` | Sums **actual** `Transaction` IN/OUT per month | ✅ | Uses real transactions (not declared). `<2 months → empty`. `incomeDeltaPct` guarded for `earnedFirst===0`. Honest. | — | None. **This is the correct data source** the runway figures below should also use. |
| **Reports cashflowRunway** | `lib/reports/contextBuilder.ts:224-225, 239-249` | `liquidAssets / monthlyExpenses`; `monthlyExpenses` = sum of declared `Expense` rows; `0 → runway 999` | ❌/⚠️ | Built on **declared expenses**, not actual transactions → understates burn → **overstates runway**. Worse: zero declared expenses → reports "999 months" of runway. Also bypasses canonical `getMasterFinancialSnapshot` (SSOT violation §6.1/§12.3). | **P1** | Source `monthlyExpenses` from master snapshot / actual-transaction burn; replace `999` sentinel with an honest "not enough data" state. |
| **Master / insights runway ("days of life", emergency fund months)** | `lib/services/masterFinancialService.ts:567, 803` → `emergencyFund.monthsCovered`; surfaced `app/api/dashboard/insights/route.ts` | `monthlyExpenses` aggregated from declared `Expense` rows via `expenseAggregator` | ⚠️ | The user-facing "N days of life" + "N months covered" are computed on **declared** spend. Phase 43.4 maturity-gate (`expenseDataMaturity.ts`) mitigates the *worst* case (hides day-count until ≥90d txns or ≥3 classified expenses) but the **number itself still uses declared spend even when actuals exist** and are higher. | **P1** | Where actual-transaction burn is available and exceeds declared, use it (or reconcile) so runway isn't optimistic. |
| **decimal-calculations.ts fixtures** | `lib/calc-audit/engines/decimal-calculations.ts:73, 80` | `interestRateAnnual: 6.25 / 6.85` (percent) in shadow-test fixtures | ⚠️ | Test fixtures feed **percent** into `loanAggregator` (which then /100 → coincidentally "right" in the test). This is why the loanAggregator /100 bug was never caught — the shadow test masks it by using the wrong unit too. Not user-facing, but it actively hides the P0. | **P2** | Change fixtures to decimal (`0.0625`) so the shadow test exposes the /100 bug. |

---

## 2. Ranked P0 list (wrong numbers a user sees)

### P0-1 — Canonical `loanAggregator` understates loan interest by 100×
`lib/calculations/loanAggregator.ts:95` (Float) and `:234` (Decimal): `interestRateAnnual / 100 / 12` applied to a value that is **already a decimal**.
- **Wrong:** $100k @ 6% → `$5.00/mo` interest, `$60/yr`.
- **Correct:** `$500/mo`, `$6,000/yr`.
- **Blast radius:** this is the SSOT debt engine. Its `debtSummary.totalInterest` and `weightedInterestRate` flow into `masterFinancialService` → CFO AI advisor (`lib/cfo/aiAdvisor.ts:456` surfaces `weightedAverageRate`) and any tile/report reading `debt.summary.totalInterest`. Every "your loans cost you $X interest" figure derived from the aggregator is 100× too small.

### P0-2 — CFO loan decision-support shows weighted rate 100× too low
`lib/cfo/decisionSupport/loanDecisionSupport.ts:218`: `weightedInterestRate / 100` on an already-decimal value → e.g. a real 6.50% blended rate is reported as **0.065%**. Directly drives refinance/extra-repayment advice and rate alerts — i.e. the engine will think every loan is absurdly cheap and never flag a high rate. (Comment "Convert back to decimal" documents the wrong mental model.)

### P0-3 — Cashflow-intelligence understates deductible investment-loan interest by 100×
`app/api/cashflow/intelligence/route.ts:439`: `principal × (interestRateAnnual / 100)`.
- $500k investment loan @ 6% → deduction computed as **$300** instead of **$30,000**.
- Consequence: deductible expenses understated → taxable income overstated → **estimated tax shown to the user is too high**, and any "investment property is costing/saving you $X after tax" narrative is wrong.

> All three P0s are the same root cause: treating the decimal `interestRateAnnual` as if it were a percent. The fix is identical (drop the `/100`), but each site must be fixed and the shadow-test fixtures (P2) corrected so the regression test actually catches it.

---

## 3. False-optimism risks (financial-adviser lens)

1. **Runway / "days of life" / "months covered" built on declared expenses** (`contextBuilder.ts`, master `expenseAggregator`). A user who hasn't entered all expenses sees a longer runway and more emergency-fund coverage than reality. The honest source already exists — `moneyStoryTrend.ts` sums *actual* transactions — but the runway surfaces don't use it. Phase 43.4's maturity gate is a partial mitigation (suppresses the claim when data is thin) but does not correct the number when partial-but-stale declared data exists. **This is the "actuals-vs-declared" problem manifesting in a user-facing freedom metric.**
2. **Reports `999` runway sentinel** (`contextBuilder.ts:225`) — zero declared expenses renders as effectively-infinite runway and inflates the health score (`:296-298`). A brand-new user with no expenses entered would be told they have a near-perfect cashflow position.
3. The 100× interest understatement (P0-1/2/3) is itself false-optimism: debt looks far cheaper than it is, which would suppress "pay this down" recommendations and understate the value of the very debt-reduction levers the app sells.

> **Not false-optimism (correctly honest):** `tenYearProjection`, `netWorthHistory`, `moneyStoryTrend`, and all five CFO what-if scenarios are AFSL-disciplined, decimal-correct, and surface their assumptions. The debt **planner** (`debtPlanner.ts`) is fully correct and is the strongest engine in scope — its payoff dates, interest-saved, and avalanche/snowball ordering all check out against independent amortisation.

---

## 4. SSOT / architecture notes

- `loanAggregator.ts` is the canonical debt SSOT (§6.2) yet carries the P0 unit bug — fixing it fixes the most consumers at once.
- `lib/reports/contextBuilder.ts` re-implements net worth, liabilities, **and monthly-expense aggregation** locally instead of calling `getMasterFinancialSnapshot()` — an §6.1/§12.3 SSOT violation that is also the vector for the declared-expense runway error. Migrating it to master both fixes the SSOT breach and routes it through the same (eventually corrected) expense source.
- The same field (`interestRateAnnual`) is interpreted as **decimal** in 8+ places and **percent** in 3 places, including two different functions inside the *same file* (`loanDecisionSupport.ts`). There is no typed unit guard. A `type AnnualRateDecimal = number` brand or a single documented convention check would prevent recurrence.

---

*Generated by read-only audit 2026-06-22. No application code, docs outside `docs/audit/`, or git worktrees were modified.*

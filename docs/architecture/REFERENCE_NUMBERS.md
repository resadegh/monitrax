# REFERENCE NUMBERS — the register of canonical quantities (MON-131)

> One row per canonical financial quantity: **FACT or DERIVED**, the canonical producer, the
> exact semantic, and the consumer cluster. Published by Tranche 0
> (`REFERENCE_NUMBERS_DESIGN.md` §4); rows marked **Phase A** get their final `canonicalHome`
> from a Reza-approved Quantity Contract — never from an agent's guess. This register is the
> index of DEFINITIONS (semantic · basis · window · inclusions), not just function names:
> "monthly spending" is four distinct quantities (§3.1 of the design record).
>
> **Machine guards:** `npm run census:producers:check` (per-quantity producer-count ratchet,
> seed `.audit/producer-census.json`) · `npm run lint:source-lock` (now scanning `lib/`,
> debt `.audit/source-lock-exceptions.json`, ratchet-down-only). The count going down is the
> deliverable; **Definition of done: 23 quantities, 23 canonical producers (+ Decimal twins).**
>
> **Phase A0 complete census (2026-07-29, D16 — nothing is out of scope):** the ratchet now
> measures **40 quantities · 1,307 formula-shape sites**, plus an **UNATTRIBUTED sweep bucket of
> 424** money-arithmetic functions matching no signature (each maps to a named quantity or becomes
> a new one — `docs/architecture/contracts/mon136-unattributed-sweep.md`). The previously-unmeasured
> list is structurally EMPTY: all 11 formerly-unmeasured MON-131 quantities carry signatures, and
> the 16 blind-spot families are censused as MON-136 candidates
> (`docs/architecture/contracts/mon136-register.md`). Split per D16: **MON-131 = the original 23,
> fixed first; MON-136 = everything else, immediately after, same machinery.** Full-depth Quantity
> Contracts live in `docs/architecture/contracts/`; the decision artefact is
> `docs/architecture/NUMBER_INVENTORY.md`.

## FACTS — asserted by a user or a document; stored ONCE, never derived

| Fact | Stored at | Guarded by |
|---|---|---|
| Income source (amount + frequency + type + owner) | `Income` row | intake dedup (`classifyIntake` source-signature, CALC_SSOT_WALL Mechanism A) |
| Expense (amount + frequency + `isRecurring` + scope) | `Expense` row | intake dedup |
| Loan principal / rate / `minRepayment` / term | `Loan` row | intake dedup. **`Loan` has no `isRecurring` — never apply the one-off gate to loans** |
| Property value / acquisition data | `Property` row | intake dedup |
| Account / investment balances | `Account` / `Investment` rows | intake dedup |
| Transactions (dated money movements) | `UnifiedTransaction` | import dedup |

**Never store a derived value** (design record §3.2 — the MON-080 class). Sole permitted
exception: an immutable point-in-time audit snapshot written once and never read back as the
live value (`netWorthHistory` pattern).

## DERIVED — computed from facts; ONE producer, never stored

**Producer counts do not live here — and deliberately so (2026-08-03).** This register carried a
`Census` column of hand-recorded three-agent-pass figures taken at `f13368ef`. That made it a **second
instrument** measuring the same thing as the ratchet, and the two had drifted into contradicting each
other on the same quantity names — `medicareLevy` 4 vs 20, `cashflow` 27 vs 57, `loanCost` 24 vs 31,
`depreciation` 22 vs 15, `superCap` 16 vs 10. Off by up to 5× **in both directions**, which is what a
second source always eventually does.

Neither column was lying: they were **different instruments** (a one-off manual pass vs a pattern-based
scan over a wider set of roots). That is exactly why one had to go — §12.2.1 does not say "keep the
accurate one", it says **one datum, one source**. The column is gone; the ratchet is the only instrument.

- **The count for any quantity:** `.audit/producer-census.json` (the ratchet, in `vercel-build`)
- **Rendered for humans:** [`REFERENCE_NUMBERS_SCOREBOARD.md`](REFERENCE_NUMBERS_SCOREBOARD.md) —
  generated, seed vs now, with the measurement-correction caveat on its face

This register answers *"what is the quantity and which producer survives?"* It does not answer
*"how many producers are there today?"* — that question has one instrument now.
Status: ✅ single-sourced · 🔴 multiple (tranche assigned) · 🅰 semantic fork → Phase A contract.

| Quantity | Canonical producer (the survivor) | Exact semantic | Consumer cluster | Status / tranche |
|---|---|---|---|---|
| **Medicare levy** | `lib/tax-engine/core/medicareLevyCalculator.ts:calculateMedicareLevy` (+Decimal twin) | levy on taxable income per `TAX_YEAR_CONFIGS` rate/thresholds | tax position, salary processor | ✅ **the proof the architecture works** |
| `monthlyRecurringRunRate` (expense) | `lib/utils/frequencies.ts:monthlyRunRate`/`annualRunRate` | declared recurring rows only; one-off gated (`isRecurring===false` → 0) | budget, expenses page, master snapshot | 🔴 T3 (MON-129) |
| `monthlyCommitted` | recurring run-rate + canonical loan cost | recurring + `resolveLoanMonthlyCost` totals | budget generator, safety net | 🔴 T3 |
| `trailing12MonthActualSpend` | `lib/calculations/actualCashflow.ts` | actual transactions incl. one-offs, 12-mo window, transfers excluded | cashflow page, CFO | 🔴 T3 |
| `currentMonthActualSpend` | `lib/calculations/actualCashflow.ts` | this calendar month's transactions | dashboard pulse | 🔴 T3 |
| Income run-rate (gross) | `lib/calculations/incomeAggregator.ts` **after T1 re-founds it on `monthlyRunRate`** | declared recurring income, one-off gated, pre-tax | income page, tax inputs, CFO | 🔴 T1 (MON-128) |
| Net income | 🅰 Phase A — **D9**: after-tax across ALL sources, or the field is renamed | net may NEVER exceed gross (`netTotal ≤ grossTotal` invariant) | quickMetrics.monthlyIncome, budget, savings rate | 🔴 T1 (MON-128) |
| PAYG withholding | `lib/tax-engine` (from `TAX_YEAR_CONFIGS` — never `annual × 0.30`) | per-FY withholding schedule on salary | income page, tax position, cashflow | 🔴 T1/T4 |
| Income tax | `lib/tax-engine/position/taxPositionCalculator.ts` (+Decimal twin) | per-FY brackets from `TAX_YEAR_CONFIGS` | tax page, CFO tile, entity tax | 🔴 T4 |
| Taxable income | `lib/tax-engine/position/*` | assessable − deductions per ITAA | tax position | 🔴 T4 |
| Deductions | `lib/tax-engine/position/*` | per-FY deductible aggregate | tax position | 🔴 T4 |
| Super cap | `TAX_YEAR_CONFIGS` (D12 — never a hardcoded `30000`/`27500`) | per-FY concessional/non-concessional caps | super page, what-if levers, wealthCheck | 🔴 T4 |
| Land tax | 🅰 Phase A (state-based schedule) | per-state schedule on land value | property tax position | 🔴 T4 |
| Negative gearing | 🅰 Phase A (post-reform regime-aware, §12.14) | rental loss offset per regime | property tax, CFO | 🔴 T4 |
| Depreciation | 🅰 Phase A — **D11**: ONE producer, rate-unit contract IN THE TYPE | division 40/43 schedule; the `rate` vs `rate/100` 100× trap (MON-026 class) | property detail, reports, tax | 🔴 T4 |
| Loan cost | `lib/services/loanCosts.ts:resolveLoanMonthlyCost` (+`resolveLoanCostsForUser`) | actuals-first: linked repayments → declared → interest floor; IO loans never $0 | debt planner, cashflow, CFO, risk radar, reports, Activity | 🔴 T2 (MON-130) |
| Cashflow | 🅰 Phase A — **D8**: full repayment subtracted, principal labelled "wealth transfer, not spending" | income − expenses − full loan repayment, actuals-first | home headline (−$6,073/mo), cashflow page, CFO | 🔴 T6 |
| Savings rate | collapses once income + cashflow single-sourced — re-census before touching | net surplus ÷ net income × 100 | dashboard, CFO, health | 🔴 T6 |
| Forecast flows | 🅰 Phase A (`lib/cashflow/**`, `forecastEngine`) | projected in/out from declared + actuals | forecast surfaces | 🔴 T6 |
| Property cashflow/yield | `lib/calculations/propertyCashflow.ts:computePropertyCashflow` | per-property actuals-first income/cost/yield | property pages, portfolio | 🔴 T5 |
| Property equity | 🅰 Phase A — **D10**: includes RENTAL properties (`properties/page.tsx:494` excluding them is a bug) | value − attached loan balances | property pages, net worth | 🔴 T5 |
| Assets / liabilities | `lib/calculations/netWorthCalculator.ts` (+Decimal twins) | classed asset/liability totals | balances, net worth, gearing (`portfolioEngine.ts:440` omits personal loans — bug) | 🔴 T5 |
| Net worth | `lib/calculations/netWorthCalculator.ts:calculateNetWorth` | Σassets − Σliabilities | home tile, trend, reports | 🔴 T5 |
| Liquid cash | 🅰 Phase A — **D5**: cash equivalents ONLY (AASB 107); shares/ETFs a separate labelled line; SMSF excluded from both. `metricAggregation.ts:129` "liquid incl. shares" is the OTHER named quantity — rename, don't delete | cash + at-call balances | safety net, runway, CFO buffer | 🔴 T5 |
| Emergency-fund months | 🅰 Phase A — **D3+D4** (MON-132): survival runway = liquid ÷ (essential incl. loan repayments − salary-independent income); the page must say *"if you lose your salary income, how long you can survive"* | ~72 months on census data, vs 11.6 shown | safety net, health, CFO | 🔴 T6 (MON-132) |
| Health score | 🅰 Phase A — **D13**: the four engines are FOUR QUESTIONS (`aggregateEngine`, `masterFinancialService:1434`, `healthScoreAggregator`, `safetyScore`) — name separately, never reconcile to one number | why Home reads 54 and Safety Net 63 | home, safety net, CFO | 🔴 T6 |
| Budget remainder | 🅰 Phase A (MON-127): `remainder = monthlyNetIncome − committed`, three allocation modes; ABS benchmark is a REFERENCE, never the budget | labelled by what actually produced it | budget page | 🔴 T7 |

## The rules this register binds (design record §7)

1. Never fix a number — fix the producer.
2. Do not add a producer — delete producers. (`census:producers:check` enforces.)
3. Float and Decimal twins migrate together, always.
4. Every tranche PR re-runs the census and states *"producer count for X: was N, now M"*, M ≤ N.
5. No file remains on the source-lock exceptions list while it powers a user-facing money
   feature.

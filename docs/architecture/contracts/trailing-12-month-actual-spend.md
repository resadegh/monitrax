# trailing12MonthActualSpend

> MON-131 Phase A Quantity Contract (READ-ONLY census artefact, 2026-07-29, HEAD `2f9f2e16`).
> Design record §3.1 type specimen: **$25,973/mo — "actuals incl. one-offs"**. Tranche 3 named
> variant. ⚠️ This contract reports a **naming discrepancy** — read canonicalHome first.

## classification

**DERIVED** — computed from `UnifiedTransaction` FACT rows. Never stored.

## semantic

The honest finding: **no producer computes a literal "Σ OUT over the trailing 12 months ÷ 12".**
The name covers what is actually TWO distinct implemented quantities:

- **This contract (the true 12-month-window quantity):** average monthly actual OUT over the
  **populated COMPLETE calendar months inside a 12-month window** (window includes the
  in-progress current month, which is excluded from the average), ×12 → `annualOutgoings`,
  ÷12 → the monthly figure.
  - **Basis:** ACTUAL `UnifiedTransaction` rows. **Window:** 12 calendar months ending now;
    average over complete populated months only (data-driven divisor).
  - **Inclusions:** every non-transfer OUT row — one-offs INCLUDED, uncategorised INCLUDED
    (§19.1). **Exclusions:** `isTransfer: false` filtered at the query (moneyStoryTrend.ts:108);
    the in-progress current month; months with zero transactions (missing data, not zero spend).
  - **Units:** AUD/month (and AUD/year as `annualOutgoings`). OUT magnitude via
    `Math.abs(t.amount)` (:136), direction-based not sign-based.
- **The trailing-3-month sibling** (`actualCashflow.avgMonthlyOutflow`) is a
  **DIFFERENT-QUANTITY** with its own contract: `trailing-3-month-actual-spend-average.md`.

**Where $25,973 actually comes from (verified, not guessed):**
`docs/changelog/CHANGELOG_2026_07_19.md:10` shows the emergency-fund worked example
`301,808 ÷ 25,973 = 11.62 months` using `avgMonthlyOutflow` — the **trailing-3** engine
(masterFinancialService.ts:2035-2037). So the design record's "$25,973 =
trailing12MonthActualSpend" figure traces to the trailing-**3** producer. The two coincide
numerically whenever ≤3 populated complete months exist (both then average the same populated
months). The register's canonicalHome for this row ("lib/calculations/actualCashflow.ts") is
therefore **imprecise for a 12-month semantic** — actualCashflow.ts contains no 12-month window.

## canonicalHome

For the true 12-month semantic: `lib/calculations/moneyStoryTrend.ts:88` `getMoneyStoryTrend()`
— outgoings average at `:224-227` (`avgMonthlyOutgoings`, populated complete months), annualised
at `:236` (`annualOutgoings`), fed to the savings-rate resolver via
`lib/calculations/canonicalCashflow.ts:157` `getCanonicalSavingsRate` (basis `'actual-ttm'`).
All anchors verified at HEAD.
- **Decimal twin: NOT ESTABLISHED.**
- **Architecture note:** unlike `computeActualCashflow`, `getMoneyStoryTrend` is NOT pure — it
  fetches Prisma itself (:104). A T3+ migration that wants one engine must reconcile this with
  the pure-engine rule (§6.4).

## callSites

| Site | Tag | Arithmetic in words |
|---|---|---|
| `lib/calculations/moneyStoryTrend.ts:224-243` | **CANONICAL (this quantity)** | data-driven populated-complete-month average ×12 |
| `lib/calculations/canonicalCashflow.ts:157-171` `getCanonicalSavingsRate` | CONSUMER | `savingsRateTrailing` passthrough when trailing months exist, declared fallback otherwise |
| `lib/calculations/actualCashflow.ts:176-190` | **DIFFERENT-QUANTITY** | trailing-3-full-month average — own contract |
| `lib/tie/analytics.ts:95` `calculateSpendingSummary` | **DIFFERENT-QUANTITY** | caller-supplied-window spend summary (`/api/unified-transactions/analytics:86`); sums signed `tx.amount` (:113), NOT `Math.abs` — a sign-convention divergence from the canonical engines worth its own census look |
| `lib/tie/analytics.ts:378` `forecastMonthlySpending` | **DIFFERENT-QUANTITY** | forward projection, not a trailing actual |
| `lib/services/propertyActuals.ts:129` / `lib/services/loanCosts.ts:16,42` (`propertyActualsWindowStart`) | **DIFFERENT-QUANTITY** | trailing-12-month window over LINKED rows for per-property/per-loan actuals — same window length, different scope (linked-entity, not household) |
| `app/api/dashboard/insights/route.ts` (composes master + Money Story) | CONSUMER | KPI tiles read `annualOutgoings` / `avgMonthlyNet` / `savingsRateTrailing` |

NOT EXAMINED: full consumer sweep of `MoneyStoryTrendResult` fields across `components/`
(ribbon, KPI sparkline components), and the `moneyStoryMargin` census family (6 sites).

## invariants

1. `annualOutgoings === round(avgMonthlyOutgoings) × 12` up to the engine's own rounding
   (`round(avg × 12)`, :236) and `avgMonthlyNet === round(annualNet / 12)` (:238).
2. `annualNet === annualIncome − annualOutgoings` (:237).
3. The in-progress current month NEVER enters the average (`slice(0, -1)`, :202-204).
4. A month with zero transactions is excluded from sum AND divisor (:218-227).
5. Transfers never counted (query filter :108).
6. **NOT an invariant:** trailing-12 average === trailing-3 average. They coincide only under
   sparse history (≤3 populated complete months); asserting equality would freeze a coincidence
   of the census data into a false law.
7. **NOT an invariant:** recurring run-rate ≤ this quantity (see the run-rate contract §invariants
   — different bases, neither bounds the other).

## independentExpectation

Arithmetic identity over `UnifiedTransaction`: bucket non-transfer OUT magnitudes by calendar
month, drop the current month, average the populated buckets, ×12. Hand-checkable from a raw
transaction export; no legislation.

## surfaces

- Home `/dashboard` → KPI tiles "Annual outgoings" / "Cash Flow" (trailing basis, Phase 57) +
  their sparkline delta pills
- Home `/dashboard` → Money Story ribbon (per-month spent series) + kept-margin subtext
- Home KPI + CFO monthly-progress card → savings rate, basis `'actual-ttm'` (MON-029)

## expectedMoves

- **NO movement from Tranche 3** — this quantity is transaction-based; the declared one-off gate
  cannot touch it (one-offs are real spend on their dates here, by design). Strongest prediction:
  any T3-era movement in `annualOutgoings` / `savingsRateTrailing` / the KPI tiles is a defect.
- **MON-135 does NOT block this contract** — `isRecurring` never enters the computation.

## decisionsRequired

- **D-C (naming, product):** the register row `trailing12MonthActualSpend` must be split or
  re-anchored: (a) rename this quantity `trailing12MonthActualSpendAverage` with canonical home
  `moneyStoryTrend.ts`, and (b) name the trailing-3 quantity separately (sibling contract). The
  current register row points a 12-month name at a 3-month engine — exactly the "callers grab
  whichever they find" hazard §3.1 exists to kill.
- **D-D (product):** should ANY surface show a strict Σ-12-months÷12 (fixed divisor) rather than
  the populated-months average? Currently none does; if Reza's mental model of "$25,973" is a
  fixed-divisor figure, no producer implements it (NONE FOUND for that third semantic).

## coverageBoundary

Examined: moneyStoryTrend end-to-end, canonicalCashflow savings-rate resolver, actualCashflow
window logic, tie/analytics summary+forecast signatures, propertyActuals/loanCosts window notes,
CHANGELOG_2026_07_19 worked example. NOT examined: component-level consumers of the trend result;
`moneyStoryMargin` census family; dashboard insights route line-by-line. Verifies the two-producer
split and the $25,973 traceback; does NOT verify every renderer of the KPI tiles.

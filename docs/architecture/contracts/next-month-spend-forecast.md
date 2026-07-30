# nextMonthSpendForecast — TIE predicted next-month spending

> MON-131 Phase A Quantity Contract. Census key: `forecastFlows` (split 4 of 4).
> READ-ONLY audit at HEAD `2f9f2e16`, 2026-07-29.

## classification

**DERIVED** (D1). Heuristic prediction from actual `UnifiedTransaction` history; never stored.

## semantic

- **Definition:** weighted average of the last ≤6 calendar months' OUT spend (linear weights,
  newest = N … oldest = 1), plus a trend adjustment `baseline × trendChangePercent ÷ 100 ÷ 12`;
  category breakdown = last-3-months per-category average.
- **Window:** `historicalMonths` param, default 6; `< 2` months of data → `predictedSpend: 0`,
  `confidence: 0`, factor "Insufficient data for prediction" (honest refuse-to-compute — the D15
  pattern, already correct).
- **Basis:** actual transactions, direction OUT (`analytics.ts:416`), category level 1,
  uncategorised bucketed as `'Uncategorised'` (§19.1-conformant).
- **Units:** AUD per month.

## canonicalHome

`lib/tie/analytics.ts:378` — `forecastMonthlySpending(transactions, historicalMonths)`.
**Decimal twin: NOT ESTABLISHED.**

## callSites

| Site | Tag |
|---|---|
| `lib/tie/analytics.ts:378` | **CANONICAL — single producer (CLEAN)** |
| `app/api/unified-transactions/analytics/route.ts:89` | CONSUMER |
| `lib/tie/analytics.ts:279` `detectCategoryDrift` (census neighbour) | DIFFERENT-QUANTITY (category drift %, budgetVariance-adjacent — not examined in depth) |

No second producer of "predicted next-month spend" found (grep `predictedSpend|forecastMonthly`).
Note the semantic distinction from `trailing12MonthActualSpend` (T3) and from the CFE's patterned
daily spend (`daily-cash-balance-forecast.md`) — three different windows/purposes, three names;
they are NOT duplicates of each other.

## invariants

1. `< 2` months history → `predictedSpend == 0 && confidence == 0` (never an invented number).
2. Weighted average bounds: `min(monthlySpends) ≤ baseline ≤ max(monthlySpends)`.
3. Transfers/IN excluded — **CORRECTED (adversarial review 2026-07-29), the contract had it
   inverted**: the HEADLINE leg is clean — `calculateMonthlyTotals` (`analytics.ts:168-174`)
   filters `!tx.isTransfer` and buckets only `direction === 'OUT'` into `spend` (the flagged
   unknown resolves PASS). The **BREAKDOWN leg leaks transfers**: the `:413-417` filter checks
   only `direction === 'OUT'` with NO `isTransfer` exclusion, so an internal transfer OUT enters
   the per-category breakdown while being excluded from the headline — Σ breakdown basis ≠
   headline basis. Latent inconsistency; becomes user-visible only if the breakdown is ever
   rendered.

## independentExpectation

**NONE FOUND for the prediction** (heuristic policy) — UNVERIFIABLE in the ledger. The weighting
arithmetic itself is a checkable identity (invariant 2 + hand-computable weights).

## surfaces

| Route | Label |
|---|---|
| ~~`/dashboard/activity` … forecast block of the analytics payload~~ | **CORRECTED (adversarial review 2026-07-29): NONE FOUND.** The sole fetcher (`activity/page.tsx:624`) consumes ONLY `data.summary.transactionCount` (`:634-641`) — the `forecast` field is computed by the route and discarded; no other fetcher of `/api/unified-transactions/analytics` exists in `app/`+`components/`+`hooks/`+`mobile-app/`. Worse: that fetch passes `from=<start of current month>`, so the route feeds the forecaster ≤ 1 partial month of history → the returned forecast is virtually always the `0 / 0` refuse-to-compute state anyway. The quantity is route-live but render-dead at HEAD |

## expectedMoves

**NO movement predicted** — single producer, single consumer, no migration needed. Only moves if
the FACT layer changes (transaction imports/categorisation — MON-135 does not reach it: it gates on
`direction`, not `isRecurring`).

## decisionsRequired

None. (If Reza ever wants the Activity forecast and the /cashflow forecast to agree, that is a
product decision to consolidate onto one of the named forecast quantities — record then.)

## wrong-inputs

Actual-transaction basis — trustworthy independent of MON-001 (which corrupts declared rows, not
transactions). Exposure: category quality (`categoryLevel1` from AI categorisation) affects only the
breakdown, not the headline.

## coverageBoundary

READ: `analytics.ts:360-430`, consumer grep, `activity/page.tsx:624` fetch line. NOT READ:
`calculateMonthlyTotals` + `analyseTrend` internals (whether transfers are excluded from monthly
totals is UNVERIFIED — flag for the adversarial pass), the activity page's render mapping of the
forecast field. Anchors verified at HEAD `2f9f2e16`; no drift.

## Adversarial review (§7) — 2026-07-29

Production code identical between cited audit HEAD `2f9f2e16` and review HEAD `696ec349`.

- Claims checked: 14 (anchors 6 · arithmetic 5 · negative-claims 3)
  - Anchors exact: `forecastMonthlySpending:378`, `<2 months → 0/0` + "Insufficient data"
    (`:385-392`), linear weights newest=N (`:398-403`), trend adjustment
    `baseline × changePercent/100/12` (`:409`), breakdown = last-3-months per-category average
    (`:413-431`), OUT filter `:416`, `detectCategoryDrift:279`, route consumer
    `analytics/route.ts:89`, page fetch `activity/page.tsx:624`.
  - Negative claims held: no second producer of predicted next-month spend (independent grep of
    `predictedSpend|forecastMonthly` across lib/app/components) — single-producer claim SURVIVES.
    Invariant 2 (weighted-mean bounds on the baseline) is mathematically sound as stated.
- REFUTED / CORRECTED:
  1. **Surface claim REFUTED.** "/dashboard/activity … forecast block" → the only fetcher reads
     ONLY `summary.transactionCount` and discards `forecast`; AND its `from=startOfMonth` param
     truncates history so the forecaster returns the 0/0 refuse-to-compute state for that caller
     regardless. Surfaces: NONE FOUND. Fixed inline. (This flips expectedMoves' framing: nothing
     rendered can move; the quantity joins the CFE in the "producer without a surface" class,
     though here the producing ROUTE is live and cheap.)
  2. **Invariant 3 INVERTED and resolved.** The contract trusted the breakdown leg and flagged the
     headline leg as unverified — source shows the opposite: `calculateMonthlyTotals`
     (`:168-174`) DOES exclude transfers (headline clean, flagged unknown resolves PASS), while
     the breakdown filter (`:413-417`) does NOT exclude transfers (transfer OUT leaks into
     per-category predictions). Fixed inline.
- Could not verify: `analyseTrend` internals (whether the trend leg also excludes transfers — it
  operates on the same `calculateMonthlyTotals`-style pipeline but was not read line-by-line;
  narrow residual).
- Verdict impact: **YES — moderate.** Canonical home, single-producer status and the semantic all
  survive; but the quantity's only claimed surface does not exist (NONE FOUND), and invariant 3
  as written was wrong (headline clean / breakdown leaks — the inverse of the contract's guess).
  Phase B: no migration needed, but the discard-and-recompute pattern (route computes a forecast
  nobody renders, off a window that guarantees 0/0) is a dead-weight candidate for D-F3-style
  disposition.

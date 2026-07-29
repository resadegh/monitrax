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
3. Transfers/IN excluded — only `direction === 'OUT'` enters (breakdown verified at `:416`;
   whether the monthly totals leg also excludes transfers depends on `calculateMonthlyTotals`,
   not read — see coverageBoundary).

## independentExpectation

**NONE FOUND for the prediction** (heuristic policy) — UNVERIFIABLE in the ledger. The weighting
arithmetic itself is a checkable identity (invariant 2 + hand-computable weights).

## surfaces

| Route | Label |
|---|---|
| `/dashboard/activity` (fetches `/api/unified-transactions/analytics`) | forecast block of the analytics payload (exact rendered label not traced — page fetch verified at `activity/page.tsx:624`) |

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

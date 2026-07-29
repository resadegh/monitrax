# currentMonthActualSpend

> MON-131 Phase A Quantity Contract (READ-ONLY census artefact, 2026-07-29, HEAD `2f9f2e16`).
> Type specimen value at census: **$170** (design record §3.1 — "this month's transactions").
> Tranche 3 named variant.

## classification

**DERIVED** — computed from `UnifiedTransaction` FACT rows. Never stored.

## semantic

- **Basis:** ACTUAL transactions only. **Window:** the current calendar month (in progress),
  bucketed by local-time `monthKey` (actualCashflow.ts:94-96).
- **Inclusions:** every non-transfer OUT row in the current month; **uncategorised INCLUDED**
  and bucketed under the literal label `'Uncategorised'` (dropping it is the exact bug the engine
  fixes — file header :29-31); one-offs INCLUDED (real money out on its date).
- **Exclusions:** `isTransfer === true` rows (:111); IN rows (counted in the inflow sibling).
- **Units:** AUD for the month-to-date (not a rate). Magnitude via `Math.abs(amount)`;
  OUT/IN decided by `direction`, never by sign (:149-151).
- **Companion outputs of the same producer, same contract:** `currentMonthInflow`,
  `currentMonthNet = inflow − outflow`, `outflowByCategory` (additive breakdown of this quantity).

## canonicalHome

`lib/calculations/actualCashflow.ts:104` `computeActualCashflow()` → `currentMonthOutflow`
(accumulated :153-158). PURE (injectable `now`). Verified at HEAD.
- Exposed on the master snapshot: `lib/services/masterFinancialService.ts:1985` (the one call)
  → `quickMetrics.actualMonthlyOutflow` `:2131`, `actualOutflowByCategory` `:2135`,
  `hasActualData` `:2136`. Input fetch: 4-month window at `:800-804` (current + 3 trailing full
  months) — sufficient for this quantity's 1-month window.
- Actuals-vs-declared resolution: `lib/calculations/canonicalCashflow.ts:78`
  `resolveCanonicalCashflow` / `:114` `getCanonicalMonthlyCashflow` — actuals win when
  `hasActualData`, declared fallback otherwise (§19.1). All verified at HEAD.
- **Decimal twin: NOT ESTABLISHED.**

## callSites

| Site | Tag | Arithmetic in words |
|---|---|---|
| `lib/calculations/actualCashflow.ts:104` | **CANONICAL** | Σ abs(amount) over non-transfer OUT, current month |
| `lib/services/masterFinancialService.ts:1985,2131-2136` | CONSUMER | straight passthrough, "no arithmetic here" (comment :2128-2130) |
| `lib/calculations/canonicalCashflow.ts:114-133` | CONSUMER (resolver) | outflow = this quantity when basis 'actual' |
| `app/api/dashboard/insights/route.ts:465,474` | CONSUMER | kept = income − actualMonthlyOutflow; net passthrough |
| `app/api/cashflow/intelligence/route.ts:675-684` | CONSUMER | waterfall from `actualOutflowByCategory`, totals re-summed from the SAME breakdown (:225) |
| `lib/tie/analytics.ts:95` `calculateSpendingSummary` | **DIFFERENT-QUANTITY** | arbitrary caller-window spend (`/api/unified-transactions/analytics:86`); sums **signed** `tx.amount` (:113) where the canonical engine uses `Math.abs` — a divergent convention, flagged in the trailing-12 contract too |
| `lib/calculations/moneyStoryTrend.ts:131-137` | **DIFFERENT-QUANTITY** | per-month OUT buckets over a 12-month window (its current-month bucket is the same set of rows but is excluded from its own averages) |

NOT EXAMINED: the `cashflow` census family (59 sites) beyond the routes above; component-level
renderers of the /cashflow hero and Home pulse.

## invariants

1. `Σ outflowByCategory === currentMonthOutflow` — mutation-proven, already a permanent test
   (`tests/regression/invariants/trustEngine.invariants.test.ts:139`, per graph edge evidence).
2. `currentMonthNet === currentMonthInflow − currentMonthOutflow` (statement tie-out,
   `trustEngine.reconciliation.test.ts:127` per graph).
3. Transfers never enter any total; uncategorised OUT is never dropped.
4. Zero rows in window → all-zero result with `hasActualData: false` (:113-123) — surfaces must
   then fall back to declared and LABEL the basis (canonicalCashflow `basis` field).
5. **NOT an invariant:** `currentMonthActualSpend ≤ trailing averages` — early in a month it is
   near-zero; after a one-off it can exceed any average. It bounds nothing.

## independentExpectation

Arithmetic identity over `UnifiedTransaction`: filter current calendar month, non-transfer, OUT;
sum magnitudes. Hand-checkable from the transactions screen for the month; no legislation.

## surfaces

- `/cashflow` → hero in/out/net + waterfall (via `/api/cashflow/intelligence`)
- Home `/dashboard` → daily-pulse / insight lines reading `actualNetCashflow` and kept-this-month
  (via `/api/dashboard/insights`)
- Any surface calling `getCanonicalMonthlyCashflow` with basis `'actual'`

## expectedMoves

- **NO movement from Tranche 3** — transaction-based; the declared one-off gate cannot touch it.
  Any T3-era movement in `actualMonthlyOutflow` / the waterfall is a defect.
- **MON-135 does NOT block this contract** — `isRecurring` never enters the computation.

## decisionsRequired

- **D-E (hygiene, likely Matrix-level not Reza-level):** `lib/tie/analytics.ts` sums signed
  amounts while the canonical engines sum magnitudes with direction. If any source stores OUT
  as negative, `/api/unified-transactions/analytics` totals diverge from every other actuals
  surface. Needs a census verdict of its own (it may be a real bug, not a definition) — raised
  here because it was found here; NOT chosen.

## coverageBoundary

Examined: actualCashflow.ts fully; masterFinancialService fetch + exposure lines;
canonicalCashflow fully; the two API routes' usage lines; tie/analytics summary function.
NOT examined: 59-site `cashflow` census family sweep; UI components; the inflow sibling's
consumers. Verifies the producer, the resolver, and the named consumers; does NOT verify that
no page re-reduces current-month transactions inline somewhere unexamined.

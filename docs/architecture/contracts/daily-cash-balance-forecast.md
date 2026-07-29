# dailyCashBalanceForecast — CFE 90-day daily simulation

> MON-131 Phase A Quantity Contract. Census key: `forecastFlows` (split 2 of 4).
> READ-ONLY audit at HEAD `2f9f2e16`, 2026-07-29.

## classification

**DERIVED** (D1). Simulated from recurring payments, income streams, loan schedules, account
balances and historical transaction patterns; never stored.

## semantic

- **Definition:** a day-by-day predicted balance per account and globally:
  `predictedBalance[d] = predictedBalance[d−1] + scheduledIncome[d] − scheduledOutflows[d] −
  patternedDailySpend[d]`, with confidence bands.
- **Horizon:** `config.forecastDays`, default **90 days** (`forecasting.ts:30`).
- **Assumptions:** recurring payments recur on schedule (`generateRecurringTimeline:305`); income
  streams recur (`generateIncomeTimeline:344`); loan repayments per schedule
  (`generateLoanTimeline:412`); non-scheduled spend follows historical weekday averages
  (`calculateSpendingPatterns:128`); confidence decays `0.002/day` from `0.95` base, weighted by
  volatility (`:31-33`).
- **Units:** AUD per day; plus derived `shortfallAnalysis`, `volatilityIndex`, `summary`.
- **Relationship to `projectedBalanceLinear`:** a genuinely DIFFERENT quantity answering the same
  user question ("where will my balance be?") by simulation instead of linear roll-forward. The two
  can disagree on the same horizon. Today they cannot collide on screen because **no UI surface
  renders this one** (below).

## canonicalHome

`lib/cashflow/forecasting.ts:42` — `generateForecast(input: CFEInput): Promise<CFEOutput>`
(despite the `async`, it performs no I/O — inputs assembled by `buildCFEInput`).
**Decimal twin: NOT ESTABLISHED** (none exists anywhere in `lib/cashflow/`).

Input assembler: `lib/cashflow/buildCFEInput.ts:37` (CONSUMER-side service).

## callSites

| Site | Tag | Notes |
|---|---|---|
| `lib/cashflow/forecasting.ts:42` + internal units (`generateRecurringTimeline:305`, `generateIncomeTimeline:344`, `generateLoanTimeline:412`, `generateAccountForecast:447`, `calculateDayConfidence:554`, `generateGlobalForecast:564`, `calculateVolatilityIndex:718`) | **CANONICAL (one producer cluster, one file)** | the census counts 7 sites here; they are internal decomposition of one producer, not 7 producers |
| `app/api/cashflow/route.ts:252` | CONSUMER | `type=forecast|full` modes serialize `CFEOutput` |
| `lib/cashflow/stressTesting.ts:136,144,176,178` (`runStressTests:128`, `calculateSurvivalTime:350`) | CONSUMER + **DIFFERENT-QUANTITY** | re-runs the engine under stressed inputs; `survivalTime` (days until stressed balance < 0) is its own small named quantity built on this one |
| `lib/cashflow/insightGenerator.ts:36,75` | CONSUMER | narrates `CFEOutput` into insights |
| `lib/cashflow/optimisation.ts` (`optimiseLoanRepayments:454`, `optimisePaymentSchedules:389`, `generateFundMovements:319`, `calculateSummary:754`) | DIFFERENT-QUANTITY (adjacent, same stack) | COE optimisation savings/movements — separate quantities served by the same dead route; not examined in depth |
| `app/api/cashflow/stress-test/route.ts:53` | CONSUMER | stress route |

## THE LOAD-BEARING FINDING — no surface renders this engine

Grep of `app/` + `components/` found **no fetcher of `/api/cashflow` or `/api/cashflow/stress-test`**.
The `/cashflow` page fetches `/api/cashflow/intelligence` + `/api/cashflow/summary` (which use
`projectBalanceForward` and their own summaries — NOT the CFE). `/dashboard/plan` fetches
`/api/cashflow/intelligence`. So the entire CFE + COE + stress-testing + insightGenerator stack
(~2,000+ lines, Phase 14) appears **UNREACHABLE from the UI** at HEAD.

Inverse of "a projection without an engine is a lie": an engine without a surface is dead weight —
and a latent second producer of the balance-forecast concept waiting to disagree with
`projectedBalanceLinear` the day someone wires it.

## invariants

(become tests only if the engine is kept)
1. Per-day identity: `predictedBalance[d] − predictedBalance[d−1] == predictedIncome[d] −
   predictedExpenses[d]` on the global forecast.
2. Confidence monotonically non-increasing in `d`; `lowerBound ≤ predictedBalance ≤ upperBound`.
3. Global forecast == Σ account forecasts per day.
4. Stress: `survivalTime(stressed) ≤ survivalTime(baseline)` for any adverse scenario.

## independentExpectation

**NONE FOUND for the prediction itself** — the day-level forecast is a heuristic policy (weekday
spending averages, schedule assumptions). Honestly UNVERIFIABLE in the Number Ledger beyond the
internal identities above. Do not invent a test that "verifies" the prediction against reality.

## surfaces

**NONE FOUND.** (`route → label`: `/api/cashflow` → no caller; `/api/cashflow/stress-test` → no
caller.) A missed fetcher (mobile client, dynamic URL construction) cannot be fully excluded — the
claim is "no fetch site found in `app/` + `components/` at HEAD", not proof of unreachability at
runtime.

## expectedMoves

**NO rendered number moves** whatever Phase B does with this stack (delete, park, or wire) — nothing
renders it today. That is this contract's strongest, most falsifiable prediction: if the golden
baseline diff shows movement attributable to CFE removal, a hidden consumer existed and the
deletion must be reverted and re-traced.

## decisionsRequired

- **D-F3 — fate of the CFE/COE stack.** Options: (a) delete route + engines as dead code (§12.1) —
  largest single producer-count reduction available in the forecast family; (b) park with
  `@deprecated` pending a product decision to build the daily-forecast surface; (c) wire it to a
  surface — in which case it MUST be reconciled against `projectedBalanceLinear` first (two
  balance-forecast producers on screen would be a §12.2.1 violation the day it ships). Product
  decision — belongs to Reza; do not choose.

## wrong-inputs

`buildCFEInput` reads declared `Income`/`Loan`/`RecurringPayment` rows — MON-001-exposed on rent
streams, MON-135-exposed wherever `isRecurring` gates entry (not traced further given the stack is
unreachable; re-audit inputs BEFORE any decision to wire it).

## coverageBoundary

READ: `forecasting.ts:1-130` (+unit signatures), `stressTesting.ts` (imports/call lines),
`buildCFEInput.ts` (header), `app/api/cashflow/route.ts:230-310`, fetch-site greps across
`app/`+`components/`. NOT READ: `forecasting.ts:130-750` internals line-by-line,
`optimisation.ts` (4 census units — counted, not examined), `insightGenerator.ts` beyond imports,
`lib/cashflow/types.ts`, `geminiSummary.ts` (3 census units — presentation-layer, not examined in
depth). Anchors verified at HEAD `2f9f2e16`; no drift found.

# multiYearWealthProjection — long-horizon net-worth / retirement projection

> MON-131 Phase A Quantity Contract. Census key: `forecastFlows` (split 3 of 4) — plus overlap with
> the MON-136 keys `superProjection`, `freedomHorizon`, `investmentReturns`.
> READ-ONLY audit at HEAD `2f9f2e16`, 2026-07-29.
> **Verdict: MULTIPLE + UNNAMED.** Three unreconciled baseline producers + one legitimately
> different scenario-delta producer + one dead generic primitive. No canonical home exists.

## classification

**DERIVED** (D1) — and almost entirely **policy assumption**, not data: every producer compounds
today's position by hardcoded growth constants. Never stored (correct).

## semantic (per producer — they do NOT share one; that is the finding)

| # | Producer | Horizon | Assumptions (hardcoded) | Question answered |
|---|---|---|---|---|
| P1 | `lib/strategy/forecasting/forecastEngine.ts:101` `generateForecast` | to life expectancy (default 90) | property 5%, stocks 8%, inflation 3%, salary 4%, ±30% scenario; 4% withdrawal rule; 70% replacement = "comfortable" (`:137-141`) | "can I retire?" — yearly netWorth/assets/liabilities/cashflow path |
| P2 | `lib/health/metricAggregation.ts:483` `calculateForecastMetrics` | 5/10/20 yr | growth 5%, inflation 2.5%; `netWorth × 1.05^y + annualSavings × y` (**savings NOT compounded — internally inconsistent**); runway = netWorth20yr ÷ annualExpenses; 4% rule | health LONG_TERM_OUTLOOK score inputs |
| P3 | `lib/strategy/analyzers/timeHorizonAnalyzer.ts:40` `analyzeRetirementRunway` | to retirement age | growth **7%**; required NW = 25× annual expenses; loop `(NW + savings) × 1.07` | "on track for retirement?" finding |
| P4 | `lib/cfo/scenarios/tenYearProjection.ts:43` `tenYearProjection` (Decimal) | 10 yr | real terms: assets 4%, super 6%, wage-index 2.5% (ASIC MoneySmart-aligned); prints its `assumptions[]` honestly | "what does THIS what-if lever change over 10 years?" — a DELTA trajectory |
| P5 | `lib/utils/timeSeries.ts:249` `generateProjection` (+ `projectValue:235`, `generateScenarios:287`) | arbitrary | caller-supplied growth − inflation | generic compound primitive — **no non-test consumer found: dead code candidate** |

P1/P2/P3 are three producers of the same **unnamed** quantity ("projected future net worth /
retirement adequacy") with contradictory assumptions (8% vs 5% vs 7% growth; 4%-rule vs 25×-rule —
arithmetically the same rule expressed twice, but computed on different projected bases). P4 is a
**DIFFERENT-QUANTITY** (scenario delta, real terms, explicit assumptions) and survives with its own
name. Units: AUD (P4 in today's dollars — real; P1/P2 nominal-ish, never stated — part of the
unnamed problem).

## canonicalHome

**NOT ESTABLISHED.** No producer qualifies as-is:
- P1 is the most complete but **fabricates inputs** when data is missing
  (`extractCurrentState:198-213`: age 35, income $100k, expenses $60k invented silently; and
  `cashValue = monthlySurplus × 12` at `:217` — an annual flow mislabelled as a cash asset — a
  wrong-model input even when data exists; `currentAge = retirementAge − timeHorizon` at `:224`).
  MON-134-class fabrication ("no invention") — must be fixed before it could be canonical.
- P4's assumption discipline (constants named, surfaced in output, ASIC-anchored) is the pattern the
  survivor should adopt, whatever engine is chosen.
- Decimal twin: only P4 is Decimal; P1/P2/P3 are Float with no twins.

## callSites

| Site | Tag |
|---|---|
| `forecastEngine.ts:101` (+`generateAllScenarios:317`) | UNNAMED-PRODUCER P1 |
| `app/api/strategy/forecast/route.ts:63,111` | CONSUMER of P1 |
| `components/strategy/ForecastChart.tsx:93-124` (`fetchForecasts`, `chartData`; `getMetricLabel:175` label helper) | CONSUMER of P1 (3 census units, presentation) |
| `metricAggregation.ts:483` | UNNAMED-PRODUCER P2 (feeds health categories; `aggregateEngine.ts:38 calculateModifiers` is a downstream score-modifier CONSUMER, census false-positive as a flow producer) |
| `timeHorizonAnalyzer.ts:40` | UNNAMED-PRODUCER P3 |
| `tenYearProjection.ts:43` (+`projectScenarioForward:144`) | DIFFERENT-QUANTITY P4 (canonical for the scenario-delta quantity) |
| `app/dashboard/cfo/what-if/[lever]/page.tsx:456,471` (`buildRequest:326`, `GenericLeverProjection:1665`) | CONSUMER of P4 |
| `lib/cfo/scenarios/addInvestment.ts:20,124` (Float + Decimal pair) | DIFFERENT-QUANTITY (what-if scenario year-1 engine, scenario family — not examined in depth) |
| `timeSeries.ts:235/249/287` | DUPLICATE-primitive, DEAD (no importer outside its own file/tests — grep verified) |
| `lib/wealthCheck/calculator.ts:98` + `lib/wealthCheck/lever.ts:54` | DIFFERENT-QUANTITY — the `freedomHorizon` census key (public wealth-check funnel: ATO/APRA-anchored super projection to 67). Separate MON-136 contract; noted because it is a FOURTH retirement-projection semantic in the app |

## invariants

1. Per projected year (P1 shape): `netWorth_y == totalAssets_y − totalLiabilities_y` and
   `surplus_y == income_y − expenses_y` — the only machine-checkable identities.
2. P4: `trajectory[0].netWorth == baseNetWorth`; `totalDelta == finalNetWorth − baseNetWorth`;
   monotone super balance when contribution ≥ 0 and growth ≥ 0.
3. **"A projection without an engine is a lie" check:** every rendered projection traced to a real
   producer — PASS for /strategy (P1) and what-if (P4). `components/marketing/ForecastSection.tsx:1`
   (census hit) renders a hardcoded illustrative "Net Worth Projection — 30-year forecast" chart on
   the public marketing page with NO producer — decorative marketing, but it promises "project …
   month-by-month for up to 30 years", which no shipped engine does month-by-month. Flagged for the
   marketing-honesty review, not for the ledger.
4. Same-question convergence (currently FAILS by construction): P1 vs P2 vs P3 projected net worth
   for the same user diverge on assumptions alone — the A3-convergence violation this contract
   exists to surface.

## independentExpectation

**NONE FOUND — UNVERIFIABLE.** These are policy assumptions (growth rates, 4% rule, 25× rule,
replacement ratios), not derivable from legislation or arithmetic on facts. Record UNVERIFIABLE in
the Number Ledger; the honest tests are the internal identities above plus assumption-disclosure
(P4's `assumptions[]` pattern), never "the projection is correct".

## surfaces

| Route | Label |
|---|---|
| `/strategy` (app/(dashboard)/strategy/page.tsx:584) | ForecastChart — conservative/default/aggressive net-worth curves (P1) |
| `/dashboard/cfo/what-if/[lever]` | 10-year trajectory chart + assumptions panel (P4) |
| Health report (LONG_TERM_OUTLOOK category, wherever health renders) | netWorth5/10/20yr, retirementRunway, sustainableWithdrawalRate metrics (P2) — exact render routes not traced |
| Strategy findings feed | "retirement runway" shortfall findings (P3) — render route not traced |
| `/wealth-check` (public) | freedomHorizon family (separate contract) |

## expectedMoves

Written before any migration:
- Collapsing P2/P3 onto a named survivor **MOVES** health LONG_TERM_OUTLOOK sub-scores and strategy
  retirement findings (`pathPrefix: healthReport.categories[LONG_TERM_OUTLOOK]`,
  `strategy.findings[retirement*]`). Arithmetic: e.g. P2's non-compounded savings → compounded
  changes netWorth20Year by `annualSavings × ((1.05^20−1)/0.05 − 20)` ≈ +13.1 × annualSavings.
- Fixing P1's fabricated inputs moves /strategy curves for any user with missing
  age/income/snapshot fields — from invented $100k/35yr baselines to real ones or to an honest
  INSUFFICIENT_DATA state (D15 pattern).
- Deleting dead P5 (`timeSeries` projection primitives): **NO movement** (no consumers).
- P4 untouched: **NO movement** predicted for what-if trajectories in this programme.

## decisionsRequired

- **D-F4 — name and pick the baseline projection survivor.** Options: (a) P1 (strategy engine)
  re-founded on real inputs + P4-style assumption disclosure, P2/P3 become consumers; (b) declare
  P1/P2/P3 three named questions (D13 pattern: "strategy projection", "health outlook heuristic",
  "retirement-track check") and keep all three with distinct labels + ONE shared assumptions config.
  Consequence: (a) one number, health + strategy move; (b) no movement but three sets of growth
  assumptions must be visibly labelled or users see contradictory futures.
- **D-F5 — one assumptions config.** Growth/inflation/withdrawal constants are typed into four
  files (5%,8%,7%,4%,6%,2.5%,3%…). Not legislated (D12 does not bind), but the same one-home rule
  should: propose `lib/config/projectionAssumptions.ts`. Consequence of not doing it: any future
  assumption update re-introduces divergence silently.
- **D-F6 — P1 fabricated-input policy.** Invented defaults (35/$100k/$60k) violate the
  no-invention law; options: refuse-to-compute (INSUFFICIENT_DATA) vs explicit user-supplied
  assumptions. Reza's call (user-philosophy fork).

## wrong-inputs

- P1 `cashValue = monthlySurplus × 12` — category error (flow as stock) even with perfect data.
- P1/P3 read `snapshot.cashflowSummary.*` — inherit the cashflow quantity's basis (declared vs
  actuals — T6 territory); P2 reads health-input income/expenses (same exposure); MON-001 reaches
  all of them through rental income legs.

## coverageBoundary

READ: `forecastEngine.ts` (full), `tenYearProjection.ts:1-130`, `metricAggregation.ts:440-527`,
`timeHorizonAnalyzer.ts:30-80`, `timeSeries.ts:195-305` + consumer grep, `aggregateEngine.ts:30-75`,
`strategy/forecast/route.ts` (call lines), `ForecastChart.tsx:80-135`, what-if page (call lines),
`wealthCheck/calculator.ts:85-130`, `ForecastSection.tsx:1-60`. NOT READ in depth:
`addInvestment.ts` and the other 7 scenario engines, `forecastEngine.ts` docs-claimed 516-line
version (**doc drift: file is 331 lines at HEAD** — `PHASE_11_REFERENCE.md:87` stale), health
render path, strategy findings render path, `wealthCheck/lever.ts`. Prior-art anchor: the
2026-06-25 Neomatrix coverage-gap audit already flagged P1-vs-tenYearProjection as a likely SSOT
divergence (`docs/audits/NEOMATRIX_COVERAGE_GAP_AUDIT_2026_06_25.md:108`) — this contract confirms
and extends it to P2/P3. All cited anchors verified at HEAD `2f9f2e16`.

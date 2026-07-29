# multiYearWealthProjection — long-horizon net-worth / retirement projection

> MON-131 Phase A Quantity Contract. Census key: `forecastFlows` (split 3 of 4) — plus overlap with
> the MON-136 keys `superProjection`, `freedomHorizon`, `investmentReturns`.
> READ-ONLY audit at HEAD `2f9f2e16`, 2026-07-29.
> **Verdict: MULTIPLE + UNNAMED.** ~~Three~~ **FOUR** unreconciled baseline producers (adversarial
> review 2026-07-29 added P6 — an LLM-invented projections producer at
> `lib/ai/services/financialAdvisor.ts:356`, live via `POST /api/ai/advisor`, no found UI fetcher)
> + one legitimately different scenario-delta producer + one dead generic primitive. No canonical
> home exists.

## classification

**DERIVED** (D1) — and almost entirely **policy assumption**, not data: every producer compounds
today's position by hardcoded growth constants. Never stored (correct).

## semantic (per producer — they do NOT share one; that is the finding)

| # | Producer | Horizon | Assumptions (hardcoded) | Question answered |
|---|---|---|---|---|
| P1 | `lib/strategy/forecasting/forecastEngine.ts:101` `generateForecast` | to life expectancy (default 90) | property 5%, stocks 8%, inflation 3%, salary 4%, ±30% scenario; 4% withdrawal rule; 70% replacement = "comfortable" (`:137-141`) | "can I retire?" — yearly netWorth/assets/liabilities/cashflow path |
| P2 | `lib/health/metricAggregation.ts:483` `calculateForecastMetrics` | 5/10/20 yr | growth 5%; inflation 2.5% **declared but NEVER USED** (`:491` — the constant is inert; adversarial review 2026-07-29); `netWorth × 1.05^y + annualSavings × y` (**savings NOT compounded — internally inconsistent**); runway = netWorth20yr ÷ annualExpenses; 4% rule | health LONG_TERM_OUTLOOK score inputs |
| P3 | `lib/strategy/analyzers/timeHorizonAnalyzer.ts:40` `analyzeRetirementRunway` | to retirement age | growth **7%**; required NW = 25× annual expenses; loop `(NW + savings) × 1.07` | "on track for retirement?" finding |
| P4 | `lib/cfo/scenarios/tenYearProjection.ts:43` `tenYearProjection` (Decimal) | 10 yr | real terms: assets 4%, super 6%, wage-index 2.5% (ASIC MoneySmart-aligned); prints its `assumptions[]` honestly | "what does THIS what-if lever change over 10 years?" — a DELTA trajectory |
| P5 | `lib/utils/timeSeries.ts:249` `generateProjection` (+ `projectValue:235`, `generateScenarios:287`) | arbitrary | caller-supplied growth − inflation | generic compound primitive — **no non-test consumer found: dead code candidate** |
| P6 | `lib/ai/services/financialAdvisor.ts:356` `generateProjections` **(ADVERSARIAL ADDITION 2026-07-29 — the missed producer)** | caller `timeHorizon` (default 10 yr) | **LLM-INVENTED**: Gemini generates the projection numbers; assumptions live in the prompt string (`:373-374` "property growth ~5%, investments ~7-8% for moderate risk") | "project Net Worth / Investment Portfolio / Property Equity / Debt Payoff" — same baseline-projection semantic, produced by generative invention (MON-134 class). Wired: `generateAIAdvice:83` when `options.includeProjections` → `POST /api/ai/advisor` (`route.ts:41,87`, default false). No UI fetcher of `/api/ai/advisor` found (`AiAdvisorPanel` uses `/api/ai/ask` only) — live route, no found surface |

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
| `tenYearProjection.ts:43` (+`projectScenarioForward:135` — corrected from :144, adversarial review 2026-07-29) | DIFFERENT-QUANTITY P4 (canonical for the scenario-delta quantity) |
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

## Adversarial review (§7) — 2026-07-29

Production code identical between cited audit HEAD `2f9f2e16` and review HEAD `696ec349`.

- Claims checked: 34 (anchors 24 · arithmetic/constants 7 · negative-claims 3)
  - P1 verified: `generateForecast:101`, constants 5%/8%/3%/4% (`:79-82`), ±30% (`:91-92`), 4% rule
    + 70% replacement (`:137-141`), fabricated defaults 35/$100k/$60k (`:199-212` inside
    `extractCurrentState:182`), `cashValue = monthlySurplus × 12` (`:217`), income/expense $100k/$60k
    inline fallbacks (`:220-221` — fabrication is per-field, not only the no-snapshot branch),
    `currentAge = retirementAge − timeHorizon` (`:224`), `generateAllScenarios:317`. File is 330
    lines by `wc -l` (contract said 331 — trailing-newline counting; immaterial); the
    `PHASE_11_REFERENCE.md:87` "516 lines" doc-drift claim CONFIRMED.
  - P2 verified: `calculateForecastMetrics:483`, 5% growth (`:490`), non-compounded
    `+ annualSavings × y` (`:495-497`), runway `netWorth20Year / annualExpenses` (`:501`), 4% rule
    (`:504`). Numeric check: `(1.05^20 − 1)/0.05 − 20 = 13.066 ≈ 13.1` ✓.
  - P3 verified: `analyzeRetirementRunway:40`, 7% (`:68`), 25× (`:61`), loop
    `(NW + savings) × 1.07` (`:71-73`).
  - P4 verified: `tenYearProjection:43`, 4%/6%/2.5% (`:38-40`), ASIC-anchored JSDoc.
  - P5 verified dead: `projectValue:235` / `generateProjection:249` / `generateScenarios:287`; no
    importer outside the file (independent grep) ✓.
  - Consumers verified: `strategy/forecast/route.ts:63/111`, `ForecastChart.tsx:93/124/175`,
    strategy page `:584`, what-if `:456/:471`, `buildRequest:326`, `GenericLeverProjection:1665`,
    `addInvestment.ts:20/124`, `wealthCheck/calculator.ts:98` + `lever.ts:54`,
    `aggregateEngine.ts:38`. `ForecastSection.tsx` marketing promise confirmed verbatim (`:12`
    "month-by-month for up to 30 years", `:50` "30-year forecast", no producer). Prior-art anchor
    `NEOMATRIX_COVERAGE_GAP_AUDIT_2026_06_25.md` item confirmed (~:108).
- REFUTED / CORRECTED:
  1. **"Three unreconciled baseline producers" → FOUR.** The commissioned fourth-producer hunt
     found **P6**: `lib/ai/services/financialAdvisor.ts:356` `generateProjections` — Gemini
     LLM-generated multi-year Net-Worth/Investment/Property-Equity/Debt-Payoff projections with
     prompt-embedded assumptions ("property ~5%, investments ~7-8%"), invoked from
     `generateAIAdvice:83` behind `options.includeProjections`, wired to `POST /api/ai/advisor`
     (`app/api/ai/advisor/route.ts:41,87`). No UI fetcher of that route found (`AiAdvisorPanel`
     posts to `/api/ai/ask` only) — so no found surface, but a live authenticated route producer,
     and a pure MON-134-class invention (worse than P1's fabricated *inputs*: the *outputs* are
     invented). Added inline as P6; verdict header corrected. D-F4 must dispose of P6 too
     (candidate: delete, or gate behind the same survivor engine with disclosed assumptions).
  2. Anchor drift: `projectScenarioForward:144` → **:135**. Fixed inline.
  3. P2's "inflation 2.5%" is a DECLARED-BUT-UNUSED constant (`metricAggregation.ts:491` — sole
     reference). Sharpen: P2's inconsistency is growth-compounded-savings-not, with a dead inflation
     knob. Fixed inline.
- Could not verify: health render path of LONG_TERM_OUTLOOK and strategy-findings renderer (same
  boundary the contract states); `addInvestment.ts` internals (not examined, as declared); whether
  `/api/ai/scenario`'s LLM output constitutes a further projection producer (context-built, not
  examined in depth — flag for MON-136's AI family).
- Verdict impact: **YES — count strengthens the verdict.** MULTIPLE + UNNAMED stands, with four
  (not three) unreconciled baseline producers; D-F4/D-F5/D-F6 all still required, D-F4's option
  list must now include P6's disposal. No claim of the original three was overturned.

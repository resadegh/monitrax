# forecastFlows — census-key index & 70-site coverage accounting

> MON-131 Phase A. The census key `forecastFlows` (70 formula-shape sites at HEAD `2f9f2e16`) bundles
> **four genuinely different projection quantities**, each with its own contract:
>
> 1. `projected-balance-linear.md` — linear 30/90-day/month-end balance (CLEAN, one producer + a stale Decimal twin)
> 2. `daily-cash-balance-forecast.md` — CFE 90-day daily simulation (single producer cluster; **no UI surface — dead-route candidate**)
> 3. `multi-year-wealth-projection.md` — long-horizon net-worth/retirement (**MULTIPLE + UNNAMED: 4 unreconciled baseline producers** — count corrected by adversarial review 2026-07-29, adding the LLM P6 at `financialAdvisor.ts:356`; + what-if delta P4 as DIFFERENT-QUANTITY, + dead primitives)
> 4. `next-month-spend-forecast.md` — TIE next-month spend prediction (CLEAN)
>
> This index accounts for every census site under the key, per brief §7 ("coverage boundary stated
> explicitly, per file and per quantity"). Tags: contract-classified / DIFFERENT-QUANTITY (owned by
> another census key's contract) / FALSE-POSITIVE (verified) / **NOT EXAMINED** (honestly untouched —
> the adversarial pass or MON-136 owns them).

| Census site (`file:function`) | Disposition |
|---|---|
| `app/api/cashflow/intelligence/route.ts:buildForecastSummary` | contract 1 — CONSUMER |
| `app/api/cashflow/route.ts:buildCOEInput` | contract 2 — input assembler |
| `app/dashboard/cfo/what-if/[lever]/page.tsx:buildRequest` / `GenericLeverProjection` | contract 3 — P4 CONSUMERs |
| `app/dashboard/plan/page.tsx:loadAll` | contract 1 — CONSUMER (fetches intelligence route) |
| `components/marketing/ForecastSection.tsx:ForecastSection` | examined — static marketing mock, NO producer (flagged in contract 3 invariant 3) |
| `components/strategy/ForecastChart.tsx:chartData` / `fetchForecasts` / `getMetricLabel` | contract 3 — P1 CONSUMERs (presentation) |
| `lib/calc-audit/engines/decimal-cfo-actions-ai-intel.ts:projectedMonthEndBalanceFloat` | contract 1 — fixture of the STALE twin (finding) |
| `lib/calculations/canonicalCashflow.ts:getCanonicalSavingsRate` | examined — DIFFERENT-QUANTITY (`savingsRate` key; `projectBalanceForward:189` in the same file is contract 1's canonical) |
| `lib/cashflow/buildCFEInput.ts:buildCFEInput` | contract 2 — input assembler |
| `lib/cashflow/forecasting.ts` ×8 (`generateForecast`, `generateAccountForecast`, `generateGlobalForecast`, `generateIncomeTimeline`, `generateLoanTimeline`, `generateRecurringTimeline`, `calculateDayConfidence`, `calculateVolatilityIndex`) | contract 2 — ONE producer cluster (internal decomposition, not 8 producers) |
| `lib/cashflow/insightGenerator.ts:generateCashflowInsights` | contract 2 — CONSUMER |
| `lib/cashflow/stressTesting.ts` ×4 | contract 2 — CONSUMER + `survivalTime` DIFFERENT-QUANTITY |
| `lib/cashflow/optimisation.ts` ×4 | contract 2 — adjacent DIFFERENT-QUANTITY (COE savings/movements), **counted, not examined in depth** — same dead stack |
| `lib/cashflow-intelligence/healthScoreAggregator.ts` ×2 | DIFFERENT-QUANTITY (`healthScore` key) — consumed by the live intelligence route |
| `lib/cfo/intelligenceEngine.ts:calculateQuickStats` | contract 1 — CONSUMER |
| `lib/cfo/scenarios/addInvestment.ts` ×2 (Float+Decimal) | DIFFERENT-QUANTITY (what-if scenario family) — NOT EXAMINED in depth |
| `lib/depreciation/index.ts:calculatePropertyDepreciation` | DIFFERENT-QUANTITY (`depreciation` key, T4/D11) |
| `lib/health/aggregateEngine.ts:calculateModifiers` | examined — FALSE-POSITIVE for flows (score modifiers) |
| `lib/health/metricAggregation.ts:calculateForecastMetrics` | contract 3 — P2 producer |
| `lib/health/metricAggregation.ts:calculateRiskMetrics` | examined — DIFFERENT-QUANTITY (`emergencyMonths` key) |
| `lib/strategy/analyzers/timeHorizonAnalyzer.ts:analyzeRetirementRunway` | contract 3 — P3 producer |
| `lib/strategy/forecasting/forecastEngine.ts:generateForecast` | contract 3 — P1 producer |
| `lib/tie/analytics.ts:forecastMonthlySpending` | contract 4 — canonical |
| `lib/tie/analytics.ts:detectCategoryDrift` | DIFFERENT-QUANTITY (`budgetVariance`-adjacent) — NOT EXAMINED |
| `lib/utils/timeSeries.ts:generateProjection` | contract 3 — P5 DEAD primitive (no consumers) |
| `lib/utils/timeSeries.ts:aggregateByType` | examined — FALSE-POSITIVE (aggregation, no projection) |
| `lib/wealthCheck/calculator.ts:calculateWealthCheckResult` | DIFFERENT-QUANTITY (`freedomHorizon` key, MON-136) — skimmed |
| **NOT EXAMINED (21 files · 25 function-units — counts corrected by adversarial review 2026-07-29; was "17 sites")** — `app/api/ai/debt-analysis/route.ts:convertToMonthly`, `:formatPercent` · `app/api/cashflow/intelligence/route.ts:buildTaxOptimization` · `app/api/cashflow/summary/route.ts:buildSummaryInput` (partially read — income mapping only) · `app/api/portfolio/snapshot/route.ts:calculateLinkageHealth` · `app/dashboard/cfo/page.tsx:getPriorityIcon` · `app/dashboard/debt-planner/page.tsx:formatDate` · `app/dashboard/income/page.tsx:groupBySource` · `components/bookkeeping/SubscriptionsReviewCard.tsx` · `components/onboarding/wizard/steps/ReviewStep.tsx` · `components/wealth-explorer/WealthUniverseMobile.tsx:snapNearest` · `lib/ai/tax-advisor/tools/getReformImpactSummaryForUser.ts:buildNarrativeText` · `lib/bookkeeping/transferCategorisation.ts:confirmedTransferFields` · `lib/cashflow-intelligence/geminiSummary.ts` ×3 · `lib/cfo/aiAdvisor.ts:fetchLoanViews` · `lib/cfo/intelligenceEngine.ts:getActions` · `lib/investments/yield.ts:calculateAfterTaxDistribution` · `lib/planning/debtPlanner.ts:projectOffsetBalance` · `lib/reminders/reminderEngine.ts:sameDueDay`, `:toDate` · `lib/services/masterFinancialService.ts:fetchAllUserData` · `lib/testing/exporter.ts:constructor` · `lib/wealthCheck/lever.ts:selectLever` | several are near-certain regex false positives (formatters, date helpers, icon pickers — the `forecast|projection` context regex is broad), but per the never-invent rule they are recorded UNEXAMINED, not waved through |

**Tally (CORRECTED by adversarial review 2026-07-29 — the original "36 · 11 · 3 · ~23" summed to
73 ≠ 70 and did not reconcile row-wise):** 70 census sites →
**33 contract-classified** (c1: 4 — buildForecastSummary, plan loadAll, decimal shadow,
calculateQuickStats · c2: 19 — buildCOEInput, buildCFEInput, forecasting ×8, insightGenerator,
stressTesting ×4, optimisation ×4 [held under contract 2 as adjacent DIFFERENT-QUANTITY] ·
c3: 9 — buildRequest, GenericLeverProjection, ForecastChart ×3, calculateForecastMetrics,
timeHorizonAnalyzer, forecastEngine, timeSeries generateProjection · c4: 1 — forecastMonthlySpending)
· **9 assigned to other census keys' contracts** (getCanonicalSavingsRate, healthScoreAggregator ×2,
addInvestment ×2, depreciation, calculateRiskMetrics, detectCategoryDrift, wealthCheck calculator)
· **3 verified false positives** (aggregateEngine calculateModifiers, timeSeries aggregateByType,
marketing ForecastSection) · **25 function-units NOT EXAMINED** (the bulleted row: 21 files, some
bundling multiple units). 33 + 9 + 3 + 25 = 70 ✓. Counts reproduce from
`node scripts/census/producers-census.mjs --list` (re-run 2026-07-29: forecastFlows = 70,
propertyCashflowYield = 6).

## Adversarial review (§7) — 2026-07-29

Production code identical between cited audit HEAD `2f9f2e16` and review HEAD `696ec349`.

- Claims checked: 8 (census reproduction 2 · per-row dispositions spot-checked 33 · tally
  arithmetic 1 — reported as 8 claim-groups: the 70-count, the 6-count, the four tally components,
  the "(17 sites)" header, the ×8/×4/×4/×2/×2 bundle counts)
  - Census reproduces exactly: `producers-census.mjs --list` → forecastFlows **70**,
    propertyCashflowYield **6**. Every row in the index's table matches a listing line (all 70
    accounted; the ×8 forecasting / ×4 stressTesting / ×4 optimisation / ×2 healthScoreAggregator /
    ×2 addInvestment bundles match the listing exactly).
- REFUTED / CORRECTED:
  1. **Tally arithmetic REFUTED**: "36 · 11 · 3 · ~23" sums to 73 ≠ 70, and no bucket
     reconciles row-wise. Corrected inline to **33 · 9 · 3 · 25 = 70** with the per-contract
     decomposition shown (method: one unit per census listing line, bucketed by the index's own
     row tags; `optimisation ×4` held in the contract-2 bucket per its row).
  2. "NOT EXAMINED (17 sites)" header → **21 files · 25 function-units** by direct count of the
     row. Corrected inline.
- Additions from the sibling contract reviews that this index should carry (recorded here, rows
  not restructured): the four per-contract reviews added producers OUTSIDE the census's 70 —
  `portfolioEngine.ts:783-784` (property cashflow + yield), `financialAdvisor.ts:356` (P6
  LLM projections), `properties/page.tsx:1196-1216/:1407-1430` (dialog cashflow blocks),
  `lib/testing/exporter.ts:406-408` (dev-only yield/cashflow) — i.e. the census regex under-covers
  the forecast/property families; Phase A0's sweep step (§2.3) has residual work here.
- Could not verify: the 25 NOT-EXAMINED units (by definition — honestly recorded as such by the
  index; several remain near-certain regex false positives).
- Verdict impact: **YES — minor but load-bearing for coverage accounting.** The 70-site coverage
  claim itself stands (all sites accounted), but the published bucket arithmetic was wrong and the
  census is now known to under-count producers in this family. All per-site dispositions
  spot-checked survived.

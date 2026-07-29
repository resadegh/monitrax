# forecastFlows — census-key index & 70-site coverage accounting

> MON-131 Phase A. The census key `forecastFlows` (70 formula-shape sites at HEAD `2f9f2e16`) bundles
> **four genuinely different projection quantities**, each with its own contract:
>
> 1. `projected-balance-linear.md` — linear 30/90-day/month-end balance (CLEAN, one producer + a stale Decimal twin)
> 2. `daily-cash-balance-forecast.md` — CFE 90-day daily simulation (single producer cluster; **no UI surface — dead-route candidate**)
> 3. `multi-year-wealth-projection.md` — long-horizon net-worth/retirement (**MULTIPLE + UNNAMED: 3 unreconciled baseline producers**, + what-if delta P4 as DIFFERENT-QUANTITY, + dead primitives)
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
| **NOT EXAMINED (17 sites)** — `app/api/ai/debt-analysis/route.ts:convertToMonthly`, `:formatPercent` · `app/api/cashflow/intelligence/route.ts:buildTaxOptimization` · `app/api/cashflow/summary/route.ts:buildSummaryInput` (partially read — income mapping only) · `app/api/portfolio/snapshot/route.ts:calculateLinkageHealth` · `app/dashboard/cfo/page.tsx:getPriorityIcon` · `app/dashboard/debt-planner/page.tsx:formatDate` · `app/dashboard/income/page.tsx:groupBySource` · `components/bookkeeping/SubscriptionsReviewCard.tsx` · `components/onboarding/wizard/steps/ReviewStep.tsx` · `components/wealth-explorer/WealthUniverseMobile.tsx:snapNearest` · `lib/ai/tax-advisor/tools/getReformImpactSummaryForUser.ts:buildNarrativeText` · `lib/bookkeeping/transferCategorisation.ts:confirmedTransferFields` · `lib/cashflow-intelligence/geminiSummary.ts` ×3 · `lib/cfo/aiAdvisor.ts:fetchLoanViews` · `lib/cfo/intelligenceEngine.ts:getActions` · `lib/investments/yield.ts:calculateAfterTaxDistribution` · `lib/planning/debtPlanner.ts:projectOffsetBalance` · `lib/reminders/reminderEngine.ts:sameDueDay`, `:toDate` · `lib/services/masterFinancialService.ts:fetchAllUserData` · `lib/testing/exporter.ts:constructor` · `lib/wealthCheck/lever.ts:selectLever` | several are near-certain regex false positives (formatters, date helpers, icon pickers — the `forecast|projection` context regex is broad), but per the never-invent rule they are recorded UNEXAMINED, not waved through |

**Tally:** 70 census sites → 36 examined-and-classified (4 contracts) · 11 assigned to other census
keys' contracts (DIFFERENT-QUANTITY) · 3 verified false positives · ~23 function-units NOT EXAMINED
(the bulleted row — some rows bundle multiple units). Counts reproduce from
`node scripts/census/producers-census.mjs --list`.

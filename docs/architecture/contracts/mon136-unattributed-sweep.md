# MON-136 — Phase A0 Unattributed-Producer Sweep (§2.3)

**Input:** the 424 function sites in `node scripts/census/producers-census.mjs --list` → `## UNATTRIBUTED`.
**Method:** clustered by directory/file family; representative functions read in source (counts per cluster below); every cluster classified as `maps-to:<key>`, `NEW QUANTITY`, or `not-a-money-number` (false positive of the heuristic).
**Date:** 2026-07-29. Read-only sweep — no production code touched.

---

## Clusters table

| Cluster | Sites | Read | Classification | Proposed name / mapped key | Verdict |
|---|---|---|---|---|---|
| app/dashboard/properties + [id] (equity/LVR/yield/gain) | 9 | 7 | maps-to + NEW | maps-to: propertyEquity, lvrGearing, propertyCashflowYield, depreciation · NEW: unrealisedGainSincePurchase (calculateGain, computeGainPercentage) | CLEAN (delegates to canonical engines post-MON-002/011) |
| app/dashboard/investments (accounts list + [id] + super) | 17 | 9 | NEW + maps-to + FP | NEW: investmentAccountValue, unrealisedGainSincePurchase · maps-to: incomeRunRate/expenseRunRate (calculateLinkedIncome/Expenses) · FP: PolishedKpiTile/InsightCard/RecentActivityCard/ContributionsCard (render props) | **MULTIPLE** — detail page values holdings `currentValue ?? units×avgPrice`; list page `units×avgPrice` only |
| lib/investments (performance, costBase, yield, index) | 9 | 5 | maps-to + NEW | maps-to: investmentReturns (CAGR/IRR/periodic/subPeriod) · NEW: parcelCostBase (AVG/FIFO/LIFO + realised gain), dividendYieldGrossedUp, DRP projection folded into investmentReturns | CLEAN (single engines) except dividend yield (see New quantities) |
| lib/cfo (scenarios, intelligenceEngine, decisionSupport, riskRadar, scoreCalculator, actionEngine) | 16 | 7 | NEW + maps-to | NEW: loanWhatIfSavings (payDownLoan/refinanceLoan ×2 Decimal siblings), projectedMonthEndBalance, dividendYieldGrossedUp (estimate model) · maps-to: savingsRate (calculateSavingsRateDecimal), assetsLiabilitiesBreakdown (concentration), netWorth (monthlyProgress parity fixture), lvrGearing/emergencyMonths (alerts) | **MULTIPLE** — refinance savings also produced in lib/strategy with different cost model |
| lib/strategy (analyzers, scoringEngine, synthesizers, safeguards, dataCollector) | 13 | 3 | NEW + maps-to + FP | NEW: loanWhatIfSavings (calculateRefinanceOpportunity, analyzeConsolidation — 2%-of-balance costs) · maps-to: cashflow/savingsRate (cashflowAnalyzer), assetsLiabilitiesBreakdown (concentration), cgt (taxLossHarvesting) · FP: safeguard messages, preferences completeness, $-to-points scoring heuristic (scoringEngine) | **MULTIPLE** (refi model conflicts with lib/cfo) |
| lib/tax-engine (capTracker, payg, medicare, offsets, div7a, trustMin, smsf, landTax, position) | 18 | 5 | maps-to + NEW + FP | maps-to: superCap (capTracker ×5), medicareLevy, payg (×2), taxOffsetsFranking (LITO), taxableIncome (compareTaxPositions, mineViaProperty) · NEW: div7aDeemedDividend (×2), trustMinimumTopUpTax (×2), smsfComplianceExposure, superGuarantee · FP: landTax citationKey (string key) | CLEAN (each new one is a single engine) |
| lib/cgt + lib/depreciation | 10 | 7 | maps-to | cgt (all 5 costBase element/clawback/partial-disposal fns), depreciation (div40 pool, div43 life, schedule ×3) | CLEAN — signature just missed the element helpers |
| Amount-match heuristics: lib/bookkeeping (receiptMatcher, loanLedger, transferPairing, importSanity) + lib/bank (dup ×2, recurring ×3, aiLearning) + lib/recurring + lib/utils/reconciliation (findBestMatch, textSimilarity, pattern) + lib/tie/behavioural + lib/intake (streamMatch, duplicateMerge) | ~26 | 6 | NEW | transactionMatchConfidence — amount/date/vendor match scores driving link & dedup decisions | **MULTIPLE** — ≥8 independent scorers, each with local tolerances/weights (reconciliation.ts holds the ONE declared duplicate tolerance, others don't read it) |
| lib/tie/analytics + lib/cashflow/forecasting stats | 5 | 3 | NEW | spendingVolatility (coefficient of variation) + expected recurring amount | **MULTIPLE** — identical CoV implemented twice (tie/analytics:469, cashflow/forecasting:272) |
| lib/cashflow (stressTesting, insightGenerator, optimisation, incomeNormalizer, savingOpportunities) | 11 | 5 | NEW + maps-to + FP | NEW: stressResilience (requirements, resilience score, stress input) · maps-to: cashflow (insight/optimisation consume canonical outputs), frequency primitive (annualizeFromMonthly) · FP: formatCurrencyShort | CLEAN (single engine) but heuristic constants (×1.5 buffer) unverified to authority |
| Frequency-conversion re-implementations: lib/intelligence/portfolioEngine (toMonthly/toAnnual), lib/reports/contextBuilder, lib/testing/exporter, app/api/cashflow/intelligence, app/api/calculate/loan, lib/utils/frequencies + reconciliation.convertFrequency | 12 | 7 | maps-to | the frequency primitive under incomeRunRate/expenseRunRate (lib/utils/frequencies is canonical; reconciliation composes it) | **MULTIPLE/WRONG** — 5 local switch-statement re-impls bypass the canonical, none one-off-aware (Calc-SSOT Wall bypass class) |
| Document/AI amount extraction: lib/documents/intelligence (parsers, types, classifier, vision, analyzer) + lib/onboarding/mapDocumentFields.asAmount + lib/neobrain/rentalStatement | 12 | 6 | NEW + FP | NEW: documentExtractedAmount (currency parse + confidence weighting) · FP: classifier names, vision plumbing, fiscal-year strings | **MULTIPLE** — 3 currency-string→number parsers (australian.ts regex, mapDocumentFields strip-and-abs, rentalStatement AI+grounding) |
| lib/services misc (stripe ×3, dividendDistribution, masterFinancialService ×2, propertyActuals ×2, entityTaxFactsAssembler, wealthGraph, legalEntity, cdrLifecycle) | 12 | 6 | NEW + maps-to + FP | NEW: portalLeadFeeBilling, distributionSumCheck · maps-to: budgetVariance (blankBudgetVariance, propertyActuals attach), taxableIncome (buildTaxSummaryFromPosition, entityTaxFactsAssembler) · FP: summariseParcels (unit counts not $), createEntity, anonymizeCDRData | CLEAN |
| Rental gross-vs-net gap: lib/calculations/rentalReconciliation + lib/intake/detectors (rentGap, cadenceMismatch) | 3 | 2 | NEW | rentalAgentCostGap (declared gross rent − net disbursement → derived agent-cost expense) | CLEAN — one engine, detectors delegate |
| Benchmarks/estimators: lib/budget-analysis/aiPrompt + lib/wealthCheck + lib/cashflow-intelligence/leakDetector | 7 | 5 | NEW | benchmarkExpenseEstimate, wealthCheckEstimate, moneyLeakEstimate | CLEAN each; note leakDetector benchmarks vs budget-analysis benchmarks are unreconciled constant sets |
| lib/calculations rest (canonicalCashflow, cashflowOrchestrator, aggregators, safetyScore) | 6 | 2 | maps-to + NEW | maps-to: cashflow, expenseRunRate, loanCost, lvrGearing (Decimal siblings) · NEW: safetyScore | CLEAN |
| lib/calc-audit + lib/testing (shadow/parity/fixtures/exporter/loader) | 12 | 2 | maps-to | parity fixtures of catalogued quantities (netWorth, investmentReturns, healthScore, cashflow) — verification infra, not live producers | CLEAN (explicitly off live path) |
| lib/health + lib/intelligence rest + lib/bookkeeping engagement/taxPack + lib/onboarding sync | 20 | 5 | maps-to + FP | maps-to: incomeRunRate/expenseRunRate (metricAggregation sums pre-normalised monthlyAmount) · FP: streak/dailyPulse/pendingActions (counts), taxPack PDF layout, sync diff/idempotency (round2, diffList, toDateInput, isPersistedId), linkage severity | CLEAN |
| app/dashboard money pages (expenses, income, budget-analysis, activity, balances, cfo, debt-planner, household, settings, documents, entities, labs) | ~45 | 5 | maps-to + NEW + FP | maps-to: expenseRunRate/loanCost (expenses page reads monthlyRunRate + resolvedCost), incomeRunRate (income page), loanAmortisation (debt-planner renders planResult) · NEW: budgetScenarioTotal (budget-analysis calculateTotals) · FP: grouping/handlers/formatting/progress/MFA/settings | budgetScenarioTotal = **UNNAMED** (client-side composition) |
| components/dashboard + editorial + budget + ownership + insights | ~25 | 4 | NEW + maps-to + FP | NEW: debtQualityBreakdown (DebtQualityWidget classification + weighted rate) · maps-to: moneyStoryMargin (MoneyStoryBar/HeroV2 chips), moneyLeakEstimate (MoneyBleedingCard render) · FP: GlassInsightTiles (render props), zones/band-track (pixel math), EntityBreakdownWidget (reads master snapshot) | debtQualityBreakdown = **UNNAMED** (producer lives in a component) |
| components/wealth-explorer + lib/data/wealthExplorerLayout | 14 | 1 | not-a-money-number | radial layout geometry (ringAround, fanAbove, placeSatellites, scaleFor node radii), format helpers, save handlers | FP — money only scales pixels |
| components/onboarding + marketing + shell + misc UI (bank import UI, bookkeeping UI, transactions dialogs, forms, warnings, auth, conversations, admin/portal tables) | ~55 | 2 | not-a-money-number | wizard list mutations, minutes estimate, static marketing content, pagination math, CurrencyInput (input formatting), dialog handlers | FP |
| app/api non-money routes (admin analytics/security/schema-drift, settings, portal team, entities dates, expenses lastTxDate, income toPayFrequency ×2) | ~15 | 3 | not-a-money-number | user/feature counts, enum mapping (toPayFrequency), date parsing | FP |
| app/api money routes (calculate/loan, budget-analysis/generate, dashboard/charts) | 5 | 3 | maps-to | loanAmortisation (generateAmortisationSchedule), budgetVariance/loanCost (breakdown blob, basis label), chart rounding | CLEAN (amortisation route is a calculator surface) |
| lib misc singles (middleware, security/mfa/tfn, gcp, help, categories, categorisation KB, analytics, entity-graph, grdcs, setup, ai prompt builders, ai/usage) | ~18 | 1 | not-a-money-number | crypto/base32, request timing, markdown, category ids, prompt serialisation of already-canonical numbers, success-rate % | FP |

Site counts per cluster are from the census list grouping; rows sum to ≈424 (a handful of files straddle two rows — each site counted once, in the row that classifies it).

**Rollup (approximate, by cluster assignment):** NEW-quantity sites ≈ 80 · maps-to sites ≈ 95 · not-a-money-number ≈ 250.

---

## New quantities

Fields: description · producers in sweep · canonical home · FACT/DERIVED · verdict.

### investmentAccountValue
Market value of an investment account (holdings value + cash balance) as shown on account tiles and detail heroes. · 4+ producers (`accounts/[id]/page.tsx:sumHoldingsValue/portfolioValue`, `accounts/page.tsx:calculateTotalValue`, `lib/cfo/riskRadar.ts:detectConcentrationRisks`, `lib/cfo/decisionSupport`). · Canonical home: NOT ESTABLISHED. · DERIVED. · **MULTIPLE** — input feeds disagree: detail uses `currentValue ?? units×avgPrice`, list and riskRadar use `units×avgPrice` only → same account can show different values on list vs detail.

### unrealisedGainSincePurchase
Gain since purchase for an asset (property `currentValue − purchasePrice`; investment `value − costBasis`) and its %. · 4 producers (properties list+detail, investments detail; investments list derives via calculateCostBasis). · Canonical home: NOT ESTABLISHED (property); `lib/investments/costBase.ts` candidate (investment). · DERIVED. · **MULTIPLE** (inherits the investmentAccountValue feed divergence).

### parcelCostBase
Purchase-lot cost base and realised gain under AVG/FIFO/LIFO for share parcels. · 3 (`lib/investments/costBase.ts:calculateAverageCostBase/processSale`, `lib/investments/index.ts:calculateRealisedGain`). · Home: `lib/investments/costBase.ts`. · DERIVED. · CLEAN.

### dividendYieldGrossedUp
Dividend yield including franking gross-up. · 3 (`lib/investments/yield.ts:calculateGrossedUpYield` real-dividend model; `lib/cfo/decisionSupport/investmentDecisionSupport.ts:calculateDividendYieldDecimal` + Float sibling using a hard-coded 4%-franked/2%-unfranked estimate). · Home: `lib/investments/yield.ts` candidate. · DERIVED. · **MULTIPLE** — two different yield models can surface different numbers.

### loanWhatIfSavings
Interest/lifetime savings and break-even months from extra repayments or refinancing. · 6 (`lib/cfo/scenarios/payDownLoan.ts` ×2, `refinanceLoan.ts` ×2, `lib/strategy/analyzers/debtAnalyzer.ts:calculateRefinanceOpportunity/analyzeConsolidation`). · Home: NOT ESTABLISHED (two competing). · DERIVED. · **MULTIPLE** — CFO scenario assumes flat $1,500 switching costs; strategy analyzer assumes 2% of balance → different break-even/savings for the same loan.

### projectedMonthEndBalance
Liquid balance − daily burn × days remaining. · 1 (`lib/cfo/intelligenceEngine.ts:calculateProjectedMonthEndBalanceDecimal` + live sibling). · Home: `lib/cfo/intelligenceEngine.ts`. · DERIVED. · CLEAN.

### div7aDeemedDividend
Division 7A deemed dividend with distributable-surplus cap. · 2 (`lib/tax-engine/divisions/div7aLoanClassifier.ts` Float+Decimal). · Home: that file. · DERIVED. · CLEAN.

### trustMinimumTopUpTax
Phase 41E Measure 3 30% minimum-tax top-up for discretionary trusts (FW-2 gated). · 2 (`lib/tax-engine/divisions/trustMinimumTax.ts` Float+Decimal). · Home: that file. · DERIVED. · CLEAN.

### smsfComplianceExposure
SMSF triumvirate money exposure (in-house asset ratio vs 5%, LRBA, NALI). · 1 (`lib/tax-engine/divisions/smsfTriumvirateClassifier.ts`). · Home: that file. · DERIVED. · CLEAN.

### superGuarantee
SG contribution amount from salary × SG rate. · 1 (`lib/tax-engine/super/contributionCalculator.ts:calculateSuperGuarantee`). · Home: that file. · DERIVED. · CLEAN.

### transactionMatchConfidence
Amount/date/vendor match scores (0–1) that drive auto-linking, dedup and pairing of money rows. · ≥8 independent scorers (`lib/bookkeeping/receiptMatcher.ts`, `loanLedger/matchRepayments.ts`, `transferPairing.ts`; `lib/bank/duplicateDetection.ts`, `smartDuplicateDetection.ts`, `recurringExpenseDetection.ts`; `lib/recurring/expenseMatcher.ts`; `lib/utils/reconciliation.ts:findBestMatch`; `lib/tie/behavioural.ts`). · Home: NOT ESTABLISHED (reconciliation.ts declares the ONE duplicate amount tolerance but the other matchers don't read it). · DERIVED. · **MULTIPLE** — each matcher has its own tolerances/weights; a shared match-scoring primitive is the consolidation candidate.

### spendingVolatility
Coefficient of variation of spend + expected recurring amount. · 3 (`lib/tie/analytics.ts:calculateVolatility`, `lib/cashflow/forecasting.ts:calculateCoeffOfVariation` — line-for-line duplicates; `lib/tie/behavioural.ts:calculateExpectedAmount`). · Home: NOT ESTABLISHED. · DERIVED. · **MULTIPLE**.

### documentExtractedAmount
A dollar amount parsed from a document/AI response, with per-field confidence. · 3 parser families (`lib/documents/intelligence/parsers/australian.ts:parseAustralianCurrency`, `lib/onboarding/mapDocumentFields.ts:asAmount`, `lib/neobrain/rentalStatement.ts` AI+grounded) + `types.ts:calculateOverallConfidence`. · Home: NOT ESTABLISHED (documents/intelligence candidate). · FACT (extracted, never invented — rentalStatement refuses rather than guesses). · **MULTIPLE** — three parsers with different negative/CR/paren handling.

### portalLeadFeeBilling
Stripe lead-fee invoice amounts and mirrored subscription money for the professional portal. · 3 (`lib/services/stripeBillingService.ts:createLeadFeeInvoiceForRequest/mirrorSubscription/resumeSubscription`). · Home: that file. · FACT (tier config + Stripe). · CLEAN.

### rentalAgentCostGap
Declared gross rent vs net agent disbursement gap, materialised as a derived deductible agent-cost expense. · 3 (`lib/calculations/rentalReconciliation.ts:buildDerivedAgentCostExpense`, `lib/intake/detectors.ts:detectRentGap/detectCadenceMismatch`). · Home: `lib/calculations/rentalReconciliation.ts`. · DERIVED. · CLEAN.

### stressResilience
Stress-test shortfall requirements (required savings = shortfall × 1.5, required income increase) and 0–100 resilience score. · 4 sites in `lib/cashflow/stressTesting.ts`. · Home: that file. · DERIVED. · CLEAN engine, but the ×1.5 buffer is a heuristic with no cited authority → flag UNVERIFIABLE on the constant.

### moneyLeakEstimate
"$X/month leaking" recurring-merchant spend vs benchmark. · 2 (`lib/cashflow-intelligence/leakDetector.ts:calculateMonthlyAverage/detectMoneyLeaks`); rendered by `components/dashboard/InsightWidgets.tsx:MoneyBleedingCard`. · Home: leakDetector.ts. · DERIVED. · CLEAN.

### benchmarkExpenseEstimate
Household benchmark spend by composition/lifestyle (ABS/HES-style base costs × multipliers). · 1 (`lib/budget-analysis/aiPrompt.ts:calculateBenchmarkExpenses`). · Home: that file (constants should be one shared benchmark set with leakDetector's). · DERIVED (benchmark). · CLEAN.

### wealthCheckEstimate
Anonymous public estimator: net-worth percentile, benchmark savings rate, FV-of-annuity projection. · 2 (`lib/wealthCheck/calculator.ts:estimatedSavingsRate/estimatePercentile/futureValueOfAnnuity`, `lever.ts`). · Home: `lib/wealthCheck/`. · DERIVED (benchmark, explicitly not user data). · CLEAN.

### budgetScenarioTotal
Budget scenario totals (committed/discretionary/variable) for minimum/comfortable/recommended incl. user adjustments. · 1 (`app/dashboard/budget-analysis/page.tsx:calculateTotals` — client-side). · Home: NOT ESTABLISHED. · DERIVED. · **UNNAMED** (page-side composition of API blobs; move server-side or into lib/budget-analysis).

### debtQualityBreakdown
Good/OK/bad debt split with weighted average interest rate per category, plus quality score. · 2 (`components/dashboard/DebtQualityWidget.tsx:calcCategoryTotal` + classification; `GlassInsightTiles.tsx:GlassDebtQuality` renders only). · Home: NOT ESTABLISHED — the producer is a component. · DERIVED. · **UNNAMED**.

### safetyScore
My Safety Net 0–100 score (emergency fund 40 + bills 30 + no-new-debt 15 + cashflow 15) with grade. · 1 (`lib/calculations/safetyScore.ts:computeSafetyScore`). · Home: that file. · DERIVED. · CLEAN (no-new-debt 15 is a declared placeholder).

### distributionSumCheck
Per-shareholder dividend payments vs declared distribution total (tolerance-gated warning). · 1 (`lib/services/dividendDistributionService.ts:paymentSumWarning`). · Home: that file. · FACT. · CLEAN.

---

## False-positive patterns (to tighten the census heuristic)

1. **Presentational render-props components** — functions receiving already-computed money and only formatting/laying out (`PolishedKpiTile`, `GlassInsightTiles`, `InsightCard`, heroes, tiles' `typeMeta`). Signal: component takes `data`/props, no reduce over raw rows.
2. **Layout geometry scaled by value** — wealth-explorer radial layout (`ringAround`, `fanAbove`, `scaleFor`) uses $ only to size pixels. Signal: output units are px/angle.
3. **Formatting/parsing helpers** — `formatCurrency*`, `formatCompactCurrency`, `ROUND1`, `round2`, `CurrencyInput`. Arithmetic is presentation rounding.
4. **Counts and percentages of non-money things** — admin analytics user/feature counts, `successRatePct`, dailyPulse completion %, streaks, pagination `(page-1)*pageSize`, progress bars, `estimateMinutes`.
5. **Date arithmetic near money identifiers** — `daysBetween`, `lastTxDate`, `generateFiscalYears`, `calculateDaysUntilEOFY` (the EOFY one is a date, not a dollar).
6. **Enum/id/string mapping** — `toPayFrequency` (enum rename, no conversion), `citationKey`, `parseUnifiedCategoryId`, `scopeKeyOf`.
7. **Crypto/infra byte math** — base32 encode/decode, TFN encryption, request-duration logging.
8. **Text-similarity internals** — `levenshteinDistance` (4 copies) matched because of matrix arithmetic; the *money* part is the surrounding amount-tolerance (captured as transactionMatchConfidence), not the string distance.
9. **CRUD/UI handlers** — `handleDelete`, `removeAsset`, `save`, `toggle*` — list mutation around money objects, no money arithmetic.
10. **Prompt serialisation** — AI prompt builders embedding canonical numbers into text (`buildFinancialContextPrompt`, `buildPrompt`) — consumers, not producers.

---

## Coverage boundary (exact)

- **Clusters fully read (every site in cluster opened):** lib/cgt (5/5), lib/depreciation (5/5 — schedule fns share one file read), lib/investments money fns (5 of 9; other 4 are same-file siblings of read fns), cfo scenarios (4/4 via 2 files), tax-engine new-quantity fns (5 files covering 8 sites), rentalReconciliation+intake detectors (3/3), stressTesting (2 of 4 read, same file), wealthCheck (2/2), safetyScore (1/1), frequency re-impl family (7 of 12 opened; utils/frequencies + testing/exporter accepted by name — same switch shape).
- **Clusters sampled:** app/dashboard/properties (7 of 9), app/dashboard/investments (9 of 17), lib/cfo (7 of 16), lib/strategy (3 of 13), lib/tax-engine (5 of 18), match-heuristics family (6 of ~26), documents/extraction (6 of 12), lib/services misc (6 of 12), lib/cashflow (5 of 11), dashboard money pages (5 of ~45), components/dashboard (4 of ~25), lib/health/intelligence/bookkeeping-engagement/onboarding (5 of ~20), app/api money routes (3 of 5).
- **Clusters only name-classified (not opened — the coverage boundary):** components/onboarding (13), components/marketing (6 of 7 — Hero read), components/wealth-explorer + wealthExplorerLayout (13 of 14 — summariseParcels-adjacent read), misc UI components (~55: bank/bookkeeping/transactions/forms/warnings/auth/conversations/admin/portal tables), app/api non-money routes (~15, 3 spot-read), lib misc singles (~18: middleware/security/gcp/help/categories/categorisation/analytics/entity-graph/grdcs/setup/ai prompts), lib/calc-audit + lib/testing (10 of 12), lib/tie categorisation + analytics remainder (5), lib/bank parsers/normalisation (4), lib/documents classifier/vision remainder (4), dashboard misc pages remainder (~40).
- **Totals:** ~75 functions read in source across ~50 files; ≈145 sites covered by direct read or same-file adjacency; ≈279 sites classified by cluster/name only. Every name-only classification is falsifiable by opening the file — none feeds a NEW-quantity verdict except via its cluster's read representatives.

**Not verified by this sweep:** correctness of any formula (§19.2 worked examples out of scope), runtime reachability of sites, and whether name-only FP clusters hide a stray real producer (the residual risk is concentrated in the ~55-site misc-UI cluster and ~40-site dashboard-misc remainder).

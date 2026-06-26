# Neomatrix + Trust Engine Coverage-Gap Audit — 2026-06-25

> **Commissioned by Reza (2026-06-25):** *"the what-ifs are not added to neomatrix — that is a gap worth reviewing again to make sure nothing is missed out from neomatrix … the what-if was an example, check what else is not covered by the trust engine before W2-W7 cleanup."*
>
> **Method:** three parallel verified sweeps (scenario/what-if engines · projection/planning engines · core/tax/health producers), each cross-referenced against the **72 engine/orchestrator nodes** in `financial-graph.json` and the **3 engines** carrying a Trust Engine verification node. Every finding cites a `file:line` read in source (§19.2 — no guesses).

---

## 0. Headline

The Neomatrix models **72 functions**, but the audit found **~70 additional money-producing calculation functions** in the codebase that are **not in the graph at all** — and the Trust Engine verifies only **3 engines** (income tax, net worth, actual cashflow). The biggest blind spot is exactly the area Reza flagged: **the entire what-if / scenario surface** (the most decision-critical numbers in the app) has only **1** of ~20 engines modelled.

Three structural findings explain how the gap formed:

1. **The graph models *functions*, not files.** Many already-graphed files (`taxOffsets.ts`, `contributionCalculator.ts`, `capTracker.ts`, `crossStateAggregator.ts`) export **additional** money producers (SAPTO, Div 293, co-contribution, cap-tracking, the `*Decimal` siblings) that were never modelled.
2. **Whole engine families are absent:** `lib/cfo/scenarios/**`, `lib/depreciation/**`, `lib/health/metricAggregation.ts`, `lib/cashflow/{forecasting,stressTesting,optimisation}.ts`, `lib/planning/debtPlanner.ts`, `lib/wealthCheck/**`, `lib/strategy/forecasting/**`, ~10 `lib/tax-engine/divisions/*`, `lib/reports/generators/**`.
3. **Float + `*Decimal` pairs carry no `semanticKey`.** Nearly every scenario/engine ships two implementations of the same number; with no shared `semanticKey`, A3 convergence **cannot** detect drift between them today.

This audit is the prerequisite Reza asked for **before** W2–W7: you can't safely dedup paths the harness doesn't cover, and you can't model the duplicates out without first modelling the producers in.

---

## 1. The gap, by remediation tranche (ranked by decision-impact × correctness-risk)

Legend: **In graph?** = modelled in `financial-graph.json`. **TE?** = has a Trust Engine verification node. Risk = decision-impact if wrong.

### Tranche A — What-if cascades (the highest-stakes surface; Reza's example)

| Engine | file:line | In graph? | TE? | The cascade / risk |
|---|---|---|---|---|
| **`sellPropertyScenario`** (+Decimal) | `lib/cfo/scenarios/sellProperty.ts:35/311` | ❌ | ❌ | proceeds − costs − loan payoff → **per-owner CGT** → removes property cashflow → net worth → liquidity. The single most consequential property decision. **HIGH** |
| **`computePropertyDisposalCgt`** | `lib/cfo/scenarios/propertyDisposalCgt.ts:148` | ❌ | ❌ | the CGT core behind sellProperty: gain → per-owner Div 115 split → reform UNCOMPUTED gate → your CGT. Composes modelled `calculateCgtDiscount` + unmodelled `attributeAsset`. **HIGH** |
| **`tenYearProjection`** | `lib/cfo/scenarios/tenYearProjection.ts:43` | ❌ | ❌ | the **projection spine** every What-If chart renders; one wrong growth factor mis-projects *every* scenario at once. **HIGH** |
| **`salarySacrificeToSuperScenario`** (+Decimal) | `lib/cfo/scenarios/salarySacrificeToSuper.ts:291/519` | ❌ | ❌ | sacrifice → SG → **concessional-cap hard-stop** → Div 296 reform gate → take-home + super delta. Wrong math silently models an *illegal* over-cap contribution. **HIGH** |
| `payDownLoanScenario` (+Decimal) | `lib/cfo/scenarios/payDownLoan.ts:19/172` | ❌ | ❌ | its **own** 600-month amortisation walk → interest saved + months reduced. **MOD→HIGH** |
| `refinanceLoanScenario` (+Decimal) | `lib/cfo/scenarios/refinanceLoan.ts:21/140` | ❌ | ❌ | new P&I → monthly/lifetime savings → break-even. **MOD** |
| `redirectToOffsetScenario` (+Decimal) | `lib/cfo/scenarios/redirectToOffset.ts:22/130` | ❌ | ❌ | effective principal → interest saved. **MOD** |
| `addInvestmentScenario` (+Decimal) | `lib/cfo/scenarios/addInvestment.ts:20/124` | ❌ | ❌ | own FV-of-annuity → projected portfolio value. **MOD** |
| `runScenario` / `runScenarioDecimal` (dispatcher) | `lib/cfo/scenarios/index.ts:81/114` | ❌ | ❌ | the What-If + AI-advisor entry point. orchestrator node. |

### Tranche B — CFO decision-support + AI scenario tax engines

| Engine | file:line | In graph? | TE? | Risk |
|---|---|---|---|---|
| **`calculateCFOLoanInsights`** | `lib/cfo/decisionSupport/loanDecisionSupport.ts:144` | ❌ | ❌ | **carried the 2026-06-23 P0 100× interest-rate bug**; own amortisation/payoff-months; refinance + extra-repayment savings. **HIGH** |
| **`applyCapitalLossNetting`** (+Decimal) | `lib/tax-engine/divisions/capitalLossNetting.ts:125` | ❌ | ❌ | statutory loss-ordering → net capital gain; behind BOTH `runCgtScenario` + `getCgtExposure`. **HIGH** |
| `calculateCFOTaxInsights` | `lib/cfo/decisionSupport/taxIntegration.ts:89` | ❌ | ❌ | refund/neg-gearing/unrealised-CGT **heuristics** running parallel to canonical engines (§12.2.1 dup + §19 traceability). **HIGH** |
| `classifyDiv7ALoans` (+Decimal) | `lib/tax-engine/divisions/div7aLoanClassifier.ts:269` | ❌ | ❌ | deemed-dividend exposure (audit-triggering). **HIGH** |
| `calculateMinimumYearlyRepayment` | `div7aLoanClassifier.ts:145` | ❌ | ❌ | Div 7A min repayment amortisation. **HIGH** |
| `trackContributionCaps` (+Decimal) | `lib/tax-engine/super/capTracker.ts:205` | ❌ | ❌ | concessional headroom + **excess-contributions tax**. **HIGH** |
| `calculateCrossStateLandTaxDecimal` | `lib/tax-engine/landTax/crossStateAggregator.ts` | partial (Float only) | ❌ | Decimal sibling the scenario actually calls is unmodelled. **HIGH** |
| `calculateCFOInvestmentInsights` | `lib/cfo/decisionSupport/investmentDecisionSupport.ts:47` | ❌ | ❌ | CAGR, dividend yield, unrealised CGT (heuristic). **MOD** |
| `calculateCFOPropertyInsights` | `lib/cfo/decisionSupport/propertyDecisionSupport.ts:20` | ❌ | ❌ | portfolio LVR/yield/cashflow alerts. **MOD** |

### Tranche C — Projection / planning / standalone calculators

| Engine | file:line | In graph? | TE? | Risk |
|---|---|---|---|---|
| **`incomeNormalizer.calculateTakeHomePay`** (+Decimal) | `lib/cashflow/incomeNormalizer.ts:221/468` | ❌ | ❌ | the **net-income bridge** every cashflow/forecast/debt calc consumes; graph has the tax pieces but not the net node they feed. **HIGH (foundational)** |
| **`debtPlanner.runDebtPlan`** | `lib/planning/debtPlanner.ts:227` | ❌ | ❌ | canonical **Debt-Freedom** engine; own amortisation (§19 100× class); drives the debt-free *date*. **HIGH** |
| **`forecastEngine.generateForecast`** | `lib/strategy/forecasting/forecastEngine.ts:101` | ❌ | ❌ | 5–30yr "**can you retire?**" projection + 4% rule; a *second* projection engine (SSOT divergence vs tenYearProjection). **HIGH** |
| **`depreciation/schedule.generatePropertySchedule`** + Div40 `:210` + Div43 `:103` | `lib/depreciation/**` | ❌ | ❌ | **entire engine absent**; ATO deductions feeding rental tax + CGT cost base; hardcoded marginal-rate constants dup the brackets; reform-sensitive. **HIGH** |
| `buildTaxPackSummary` | `lib/bookkeeping/taxPack/summary.ts:119` | ❌ | ❌ | the numbers handed to the **accountant**. **HIGH** |
| `cashflow/forecasting.generateForecast` | `lib/cashflow/forecasting.ts:42` | ❌ | ❌ | shortfall + "withdrawable cash"; **§19.1 risk** — re-derives spend from patterns, must reconcile to canonical actuals. **HIGH** |
| `cashflow/stressTesting.runStressTests` | `lib/cashflow/stressTesting.ts:128` | ❌ | ❌ | Safety-Net resilience; hidden 30yr-term amortisation. **HIGH** |
| `wealthCheck.calculateWealthCheckResult` (+`selectLever`) | `lib/wealthCheck/calculator.ts:98` | ❌ | ❌ | public-funnel retirement projection; first numbers a prospect sees; AFSL-sensitive. **HIGH** |
| `cashflow/optimisation.generateOptimisations` | `lib/cashflow/optimisation.ts:60` | ❌ | ❌ | "saves $X/yr" from hardcoded multipliers (low traceability). **MOD** |
| `savingOpportunities.detectSavingOpportunities` | `lib/cashflow/savingOpportunities.ts:199` | ❌ | ❌ | HISA/offset/sacrifice benefit proxies. **MOD** |
| `budget-analysis.calculateBenchmarkExpenses` | `lib/budget-analysis/aiPrompt.ts:280` | ❌ | ❌ | realistic-budget total; ABS table dup with optimisation. **MOD** |

### Tranche D — SSOT canonical homes + the duplicated formulas (this tranche *enables* W2–W7)

Modelling these lets **A3 convergence automatically catch the ~20 re-typers** the SSOT audit flagged — turning the cleanup from manual to gate-enforced.

| Engine | file:line | In graph? | Why it matters |
|---|---|---|---|
| **`calculateLVR` / `calculateEquity` / `calculateRentalYield`** | `lib/utils/calculations.ts:9/20/30` | ❌ | the **canonical homes** for LVR (×7 re-typed), yield, equity. Highest-ROI model. |
| **`calculatePIRepayment` / `calculateInterestForPeriod`** (+Decimal) | `lib/utils/calculations.ts:69/53` | ❌ | canonical amortisation — re-typed in debtPlanner, stressTesting, optimisation, payDownLoan. |
| **`toMonthly` / `toAnnual` / `periodsPerYear`** (+Decimal) | `lib/utils/frequencies.ts:29/7/50` | ❌ | canonical frequency converter — ~13 re-implementations (SSOT §5). |
| **`health/metricAggregation.calculateLiquidityMetrics / DebtMetrics / PropertyMetrics`** | `lib/health/metricAggregation.ts:163/273/390` | ❌ | the **SSOT duplication epicentre** (emergency-fund ×9, savings-rate ×7, LVR ×7) feeding the health score. |
| `intelligence/portfolioEngine.calculateNetWorth / Cashflow / Gearing` | `lib/intelligence/portfolioEngine.ts:308/361/435` | ❌ | multi-formula SSOT offender + §19.1 declared-vs-actual risk. |
| `reports/contextBuilder.buildReportContext` + 6 generators | `lib/reports/**` | ❌ | user-facing report numbers; multiple re-derivations. |
| `entityValueBreakdown.getEntityValueBreakdown` | `lib/calculations/entityValueBreakdown.ts:53` | ❌ | per-entity value; whole file unmodelled. |

### Tranche E — Tax-engine divisions + unmodelled siblings

| Engine | file:line | In graph? | Risk |
|---|---|---|---|
| `calculatePAYG` / `calculateGrossFromNet` | `lib/tax-engine/core/paygCalculator.ts:149/237` | ❌ | every net-pay number; reform-sensitive. **HIGH** |
| `applyNegativeGearing` | `lib/tax-engine/divisions/negativeGearing.ts:152` | ❌ | core rental tax; Phase 41E #1. **HIGH** |
| `allocateTrustDistribution` / `getDistributableAmount` | `lib/tax-engine/divisions/trustDistribution.ts:275/514` | ❌ | per-beneficiary $. **HIGH** |
| `applyTrustMinimumTax` | `lib/tax-engine/divisions/trustMinimumTax.ts:123` | ❌ | 30% min trust tax; reform #3. **HIGH** |
| `calculateFrankingCredits` | `lib/tax-engine/income/taxabilityRules.ts:250` | ❌ | feeds taxable income + offset. **HIGH** |
| `applyForeignResidentCgt` / `applyLossRefundability` | `divisions/foreignResidentCgt.ts:100` / `lossRefundability.ts:112` | ❌ | reform #4 / #5. **HIGH/MOD** |
| `calculateDivision293Tax` / `calculateCoContribution` / `calculateSpouseContributionOffset` | `super/contributionCalculator.ts:243/272/338` | ❌ | unmodelled **siblings** in a graphed file. |
| `calculateSAPTO` / `calculateFrankingCreditOffset` / `calculateForeignTaxOffset` / `calculateAllOffsets` | `core/taxOffsets.ts:99/138/155/178` | ❌ | unmodelled **siblings** in a graphed file. |
| `getConcessionalCap` / `getNonConcessionalCap` / `getOptimalContributionStrategy` | `super/capTracker.ts:373/380/297` | ❌ | unmodelled **siblings**. |
| `getMedicareSummary` (+ **no MLS surcharge engine found**) | `core/medicareLevyCalculator.ts:311` | ❌ | possible missing-engine gap. |
| `determineTaxability` | `income/taxabilityRules.ts:18` | ❌ | taxable/exempt classification. |
| `applyDiv152` (small-business CGT) / `applyTrustLossRules` / `applyCompanyLossRules` | `divisions/*` | ❌ | **MOD** |

---

## 2. Cross-cutting findings

1. **Float + `*Decimal` twins need ONE `semanticKey` each.** Almost every engine above ships two user-facing implementations; A3 can't catch drift between them until they share a `semanticKey`. Modelling each money concept with one key spanning both siblings turns the Trust Engine from descriptive into a **drift-catching gate** for these surfaces.
2. **≥4 duplicated constant sets** surfaced across unmodelled engines: marginal tax rates (`depreciation/schedule.ts` `TAX_RATE_32_5/37/45` vs the bracket config), ABS household benchmarks (`budget-analysis` vs `cashflow/optimisation`), SG/cap/return assumptions (`wealthCheck` vs `savingOpportunities` vs `taxYearConfig`), and the amortisation formula (re-typed in `debtPlanner`, `stressTesting`, `optimisation`, `payDownLoan`). Each is a §12.2.1 drift bug that A3 would catch once the producers are modelled.
3. **Two independent long-horizon projection engines** (`cfo/scenarios/tenYearProjection` vs `strategy/forecasting/forecastEngine`) — a likely SSOT divergence to record + reconcile.
4. **Documented intentional divergences** must be recorded so a future dedup doesn't "fix" them: e.g. `salarySacrificeToSuper.sumSuperBalance` deliberately differs from `netWorth.assets.superannuation` (SMSF double-count fix).

---

## 3. Sequenced remediation plan (model into Neomatrix **and** verify with the Trust Engine)

Each tranche = its own draft PR(s); model the producer + add a verification node (golden/reconciliation/differential) in the same PR (§21.2.1); §20.4 10/10; the assurance readout climbs each time.

| Order | Tranche | Why first |
|---|---|---|
| **1** | **A — What-if cascades** (sellProperty + propertyDisposalCgt + tenYearProjection first) | Reza's explicit priority; highest decision-impact; deepest cascades. **Model the cascade lineage + reconciliation tie-outs** (Δcashflow, Δposition = proceeds − CGT − costs). |
| **2** | **D — canonical SSOT homes** (utils/calculations, utils/frequencies, metricAggregation) | Modelling these makes **W2–W7 gate-enforced** (A3 catches the re-typers) instead of manual. Do this *with/just-before* the cleanup. |
| **3** | **B — decision-support + AI scenario tax engines** (loanDecisionSupport first — it was the P0 bug site; then capitalLossNetting, capTracker, Div7A) | High-stakes, recently-wrong, audit-relevant liabilities. |
| **4** | **C — projection/planning** (incomeNormalizer + debtPlanner + forecastEngine + depreciation + taxPack) | foundational net-income + the retirement/debt-free numbers users plan their lives on. |
| **5** | **E — tax divisions + siblings** (PAYG, negative gearing, trust, franking, Div 293, SAPTO, etc.) | broad coverage; many reform-sensitive; lower per-item decision-frequency than A–D. |

**Then** W2–W7 SSOT cleanup runs on a harness that covers the paths being deduped, with A3 catching divergence automatically.

---

*Generated 2026-06-25 from three verified parallel sweeps. Findings are source-verified (§19.2). This audit defines the work that precedes W2–W7 (per Reza: cover the calculations before cleaning up the duplicates).*

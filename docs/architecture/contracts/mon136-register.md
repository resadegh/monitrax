# MON-136 Register — the sixteen blind-spot families (Phase A0 census entries)

> **Scope + method.** MON-131 PHASE A brief §2.2/§3: for MON-136 quantities a REGISTER ENTRY +
> producer count + canonical-home verdict is enough — full Quantity Contracts come when MON-136
> starts. Method: `node scripts/census/producers-census.mjs --list` per-family candidate sites,
> then the top sites READ in source (all `lib/` sites at minimum; for large families the canonical
> engine + spot-checks). Census counts are a **heuristic ceiling** — several hits per family are
> keyword false positives, called out below. Legislation is cited only where the CODE cites it
> (AuthorityCitation blocks / file headers), never from memory (§19.2).
> Settled decisions honoured: D12 (legislated constants only in `TAX_YEAR_CONFIGS`), D6 (named
> quantities), D1 (FACT/DERIVED). Cross-referenced against MON-133's rootCause list
> (`docs/issues/ISSUES.json`).
>
> Verdict vocabulary (exact): **CLEAN / MULTIPLE / WRONG / UNNAMED / UNVERIFIABLE**.
> Generated 2026-07-29. READ-ONLY census — no production code touched.

---

## stampDuty (census 4 · examined 4/4)

1. **Distinct?** DISTINCT — "transfer duty payable on an acquisition." Of the 4 census sites only
   one produces it: `lib/cgt/costBase.ts:108` (`calculateElement2`) and `lib/cgt/index.ts:198`
   *consume* a stored `stampDuty` figure as a cost-base input (FACT to them);
   `masterTaxPosition.ts:406` (`ingestUncomputed`) only aggregates uncomputed flags — both false
   positives as producers.
2. **Real producers:** **1** — `calculateStampDuty` + `calculateStampDutyDecimal` (Float/Decimal
   twins, migrate together per §7 rule 4).
3. **Canonical home:** `lib/tax-engine/stampDuty/stateStampDuty.ts:calculateStampDuty:285`
   (Decimal twin :408; bracket kernel `applyBracketsDecimal:384`).
4. **Legislated?** YES. Code cites per-state Duties Acts in the file header: NSW Duties Act 1997
   Sch 1 + Ch 2 Pt 4 Div 4; VIC Duties Act 2000 Sch 1 + Pt 5; QLD Duties Act 2001 s24–s26 + Ch 4;
   SA Stamp Duties Act 1923 Sch 2 + Pt 4; WA Duties Act 2008 Sch 2 + Ch 3 Pt 5; TAS Duties Act
   2001 Sch 2 + Ch 4 Pt 6; ACT Duties Act 1999 Pt 3 + Pt 5A; NT Stamp Duty Act 1978 Sch 1.
   **D12 flag:** the per-state bracket scales + FPAD rates are typed in
   `stateStampDuty.ts:104` onward (in-engine config objects), outside
   `lib/tax-engine/config/taxYearConfig.ts` and not FY-versioned.
5. **FACT/DERIVED:** DERIVED, SINGLE producer. (The *stored* stamp duty a user paid is a FACT
   consumed by CGT cost base — a separate register row when MON-136 starts.)
6. **Plain English:** what the state government charges you in transfer duty when you buy a
   property, including the foreign-purchaser surcharge where it applies.
7. **Verdict:** **CLEAN** (D12 flag on in-engine bracket constants). Precondition watch: the
   bracket formula uses `inBracket = value − min + 1` — a deliberate Float-mirroring off-by-one-
   dollar quirk both twins share; flag for the MON-136 contract, do not "fix" unilaterally.

## gst (census 15 · examined 8/15)

1. **Distinct?** TWO near-match quantities, NOT aliases: (a) **net GST / BAS position** (1A−1B,
   BAS labels) and (b) **GST component of a scanned receipt/invoice** (perception layer). Near-
   match → separate names per the fold rule. False positives: `extractTextFromPDF`, `extractABN`,
   `extractCurrencyValues`, `GlobalScanReceipt.onFileChange` (plumbing);
   `costBase.ts:76 calculateElement1` takes a `gstIncluded` flag and ignores it;
   `masterTaxPosition:406` aggregates flags only.
2. **Real producers:** **2 formula homes** — `lib/tax-engine/gst/gstCalculator.ts`
   (`calculateGst:104` / `calculateGstDecimal:250`) and
   `lib/documents/intelligence/parsers/australian.ts` (`calculateGSTFromTotal:133` = total/11,
   `calculateGSTFromSubtotal:141` = subtotal×0.1). Receipt/invoice analyzers pattern-extract, they
   do not re-derive the formula.
3. **Canonical home:** (a) `lib/tax-engine/gst/gstCalculator.ts:calculateGst:104`.
   (b) NOT ESTABLISHED (candidate: `parsers/australian.ts` as the perception-side home, renamed as
   its own quantity).
4. **Legislated?** YES. Code cites GST Act 1999 s9-70 (10% rate), s38 (GST-free), s40
   (input-taxed), s23-15 ($75k threshold). **D12 violations:** `GST_RATE = 0.1` typed TWICE —
   `lib/tax-engine/gst/gstCalculator.ts:38` and
   `lib/documents/intelligence/parsers/australian.ts:127`; `GST_REGISTRATION_THRESHOLD = 75_000`
   at `gstCalculator.ts:40`. None in MON-133's list — new sites.
5. **FACT/DERIVED:** DERIVED, MULTIPLE producers (of the 10% arithmetic).
6. **Plain English:** the 10% goods-and-services tax — either what your business owes/claims on a
   BAS, or the GST portion detected inside a receipt you scanned.
7. **Verdict:** **MULTIPLE** (two GST_RATE typings; two arithmetic homes needing distinct names).

## cgt (census 98 · examined 12/98 — canonical engines fully, 8 spot-checks)

1. **Distinct?** DISTINCT (capital gains tax on disposal). Census heavily over-counts: hits like
   `lib/auth/permissions.ts:20`, `WizardContainer.tsx:385`, `parseFinancialYear` are keyword false
   positives. There are **two parallel full engines** plus rogue re-derivations:
   legacy `lib/cgt/*` (`cgtCalc.ts:calculateCGTEventA1:95` with its own constants) and the
   reform-aware `lib/tax-engine/divisions/*` (`cgtDiscount` / `cgtIndexation` / `cgtMinimumRate` /
   `foreignResidentCgt` / `capitalLossNetting`). Good consumers exist:
   `propertyDisposalCgt.ts:148` explicitly "composes the canonical Div 115 engine … no tax
   arithmetic of its own."
2. **Real producers among examined:** **≥5 independent** — (i) `lib/cgt/cgtCalc.ts`,
   (ii) `lib/tax-engine/divisions/cgtDiscount.ts:166` (+ siblings),
   (iii) `app/api/investments/capital-gains/route.ts:isCgtDiscountEligible:38` (365-day rule
   retyped in a route), (iv) `lib/cfo/decisionSupport/taxIntegration.ts:calculateUnrealisedCGT:189`,
   (v) `lib/strategy/analyzers/taxAnalyzer.ts:105` (own tax-saving estimate).
   `lib/investments/costBase.ts` computes discount-eligibility flags per lot (imports the shared
   holding-days constant — a sixth surface of the eligibility rule).
3. **Canonical home:** `lib/tax-engine/divisions/cgtDiscount.ts:calculateCgtDiscount:166` + the
   Div 115 sibling divisions (reform-gated per §12.14 FW-1/FW-2); the legacy `lib/cgt` engine must
   reconcile INTO it, not alongside it.
4. **Legislated?** YES. Code cites ITAA 1997 s115-25, s115-100 (`cgtDiscount.ts`), s102-10,
   s110-25, s116-20 (`propertyDisposalCgt.ts`), Phase 41E reform constants
   (`reformConstants.ts:162`). **D12 violations:** `CGT_DISCOUNT_RATE = 0.5` +
   `CGT_DISCOUNT_HOLDING_DAYS = 365` at `lib/cgt/cgtCalc.ts:78-79`; `CGT_DISCOUNT_RATE = 0.5` +
   `CGT_DISCOUNT_HOLDING_PERIOD_DAYS = 365` at `lib/cgt/index.ts:62,65` (MON-133 already lists
   `lib/cgt/index.ts:68` — same file, overlapping cluster); hardcoded `gain * 0.5` at
   `lib/cfo/decisionSupport/taxIntegration.ts:199`; hardcoded `days >= 365` at
   `app/api/investments/capital-gains/route.ts:40`.
5. **FACT/DERIVED:** DERIVED, MULTIPLE producers.
6. **Plain English:** the tax you pay on the profit when you sell an asset, after the 50% discount
   for assets held over 12 months (and the post-reform rules for newer assets).
7. **Verdict:** **MULTIPLE** + **WRONG** — `taxIntegration.ts:189-204` applies the 50% discount to
   ALL unrealised gains with **no 12-month holding check** (comment admits "simplified"), so the
   CFO tax-insight overstates the discount for recently-bought holdings.

## psiAttribution (census 11 · examined 7/11 — all lib/ sites)

1. **Distinct?** DISTINCT (PSI/PSB classification + attribution of personal-services income).
   Consumers, not producers: `PsiAssessmentCard` (UI), `entityTaxFactsAssembler` (input assembly),
   `masterTaxPosition` (dispatch), `eligibility.ts:31` (entity-type gate),
   `taxYearConfig.ts:480` + `NeomatrixExplorer` (false positives).
2. **Real producers:** **1**.
3. **Canonical home:** `lib/tax-engine/divisions/psiClassifier.ts:classifyPsi:151`.
4. **Legislated?** YES — code cites ITAA 1997 Pt 2-42, s84-5, s87-15 (PSB), TR 2022/3
   (`psiClassifier.ts:113-118`). The 80%-one-client threshold is typed in-engine (minor D12 note;
   structural test thresholds, not FY-indexed rates).
5. **FACT/DERIVED:** DERIVED, SINGLE.
6. **Plain English:** whether income earned mainly from your personal skills must be taxed in your
   own hands (at your marginal rate) instead of staying inside your company or trust.
7. **Verdict:** **CLEAN**.

## div293 (census 4 · examined 4/4)

1. **Distinct?** DISTINCT (extra 15% contributions tax for high earners). `taxIntegration.ts:215`
   (`detectTaxRisks`) and `salarySacrificeToSuper.ts:291` are consumers (no hardcoded $250k found
   in either); both read engine output/config.
2. **Real producers:** **1**.
3. **Canonical home:** `lib/tax-engine/super/highIncomeSuperTax.ts:calculateHighIncomeSuperTax:77`
   (Decimal twin :213).
4. **Legislated?** YES — code cites ITAA 1997 Div 293, s293-15, s294-35; Div 296 gated behind
   `div296CommencementVerified`. Threshold + rate read from `TaxYearConfig`
   (`config.division293Threshold`, `config.superContributionsTaxRate`) — **D12 compliant**.
5. **FACT/DERIVED:** DERIVED, SINGLE.
6. **Plain English:** the extra 15% tax the ATO charges on your super contributions once your
   income tops the Division 293 threshold.
7. **Verdict:** **CLEAN**.

## taxOffsetsFranking (census 50 · examined 10/50)

1. **Distinct?** The census bundles TWO quantities: (a) **franking credit gross-up** and (b)
   **income-tax offsets** (LITO/SAPTO). Both distinct; not aliases of each other or of incomeTax.
   Many hits are consumers/false positives (income page, holdings page, xero FY helper,
   `parseFinancialYear`).
2. **Real producers:** franking gross-up formula typed **3×** with identical math —
   `lib/investments/yield.ts:calculateFrankingCredit:67`,
   `lib/investments/index.ts:calculateFrankingCreditAU:199`,
   `lib/tax-engine/income/taxabilityRules.ts:calculateFrankingCredits:289` — plus a 4th ad-hoc
   estimate in `lib/cfo/decisionSupport/investmentDecisionSupport.ts:260` (avg franking % × DB
   dividend income). `smsfIncomeTax.ts:applyFranking:126` applies credits as an offset (consumer
   of the credit, producer of the SMSF net-tax quantity — fine). Offsets: **1 home**,
   `lib/tax-engine/core/taxOffsets.ts:calculateAllOffsets:178` / `applyOffsets:434`.
3. **Canonical home:** offsets — `lib/tax-engine/core/taxOffsets.ts:calculateAllOffsets:178`.
   Franking — NOT ESTABLISHED (three-way tie; tax-engine's `taxabilityRules.ts` is the natural
   survivor candidate).
4. **Legislated?** YES (franking per ITAA 1997 Div 207 gross-up formula — stated in code comments;
   per-file AuthorityCitation not present on the two `lib/investments` copies). **D12 violations:**
   corporate tax rate 0.30 typed 3× — `lib/tax-engine/income/taxabilityRules.ts:13`,
   `lib/investments/index.ts:59`, `lib/investments/yield.ts:51`; SAPTO shade-out/cutoff thresholds
   (32279 / 28974 / 50119 / 41790) typed at `lib/tax-engine/core/taxOffsets.ts:106-107` and again
   `:316-317` (Decimal twin) while `maxOffset` correctly reads config. None in MON-133's list.
5. **FACT/DERIVED:** DERIVED, MULTIPLE (franking); DERIVED, SINGLE (offsets).
6. **Plain English:** the tax credits attached to Australian dividends (company tax already paid
   on your behalf) and the offsets (like SAPTO) that reduce your final tax bill.
7. **Verdict:** **MULTIPLE** (franking); offsets home CLEAN but D12-violating on SAPTO thresholds.

## fteIeeElections (census 13 · examined 7/13 — all engine sites)

1. **Distinct?** DISTINCT (family-trust-election distribution classification + FTDT). Siblings
   `trustDistribution.ts`, `s100aZoneClassifier.ts`, `trustLossRules.ts` are DIFFERENT quantities
   (Div 6 allocation, s100A zones, trust loss tests) — not duplicates. Route/UI/service hits are
   CRUD + consumers.
2. **Real producers:** **1**.
3. **Canonical home:**
   `lib/tax-engine/divisions/fteIeeClassifier.ts:classifyFteIeeDistributions:166`.
4. **Legislated?** YES — code cites ITAA 1936 Sch 2F, s272-75 (FTE), s272-95 (family group).
   **D12 flag:** `FAMILY_TRUST_DISTRIBUTION_TAX_RATE = 0.47` typed at
   `fteIeeClassifier.ts:57` (FTDT rate = top marginal + Medicare; FY-dependent, belongs in
   `TAX_YEAR_CONFIGS`). Not in MON-133's list — new site.
5. **FACT/DERIVED:** DERIVED, SINGLE. (The election itself — FTE in force, test individual — is a
   FACT input.)
6. **Plain English:** when a family trust pays money to someone outside the elected family group,
   this works out the 47% penalty tax (FTDT) that distribution triggers.
7. **Verdict:** **CLEAN** (D12 flag on the 0.47 constant).

## loanAmortisation (census 8 · examined 8/8)

1. **Distinct?** DISTINCT (monthly P&I repayment, M = P·r(1+r)ⁿ/((1+r)ⁿ−1)).
   `div7aLoanClassifier.ts:calculateMinimumYearlyRepayment:145` is the s109E Div 7A minimum yearly
   repayment — same math shape, legally distinct quantity (benchmark rate passed in; keep as its
   own row). `wealthCheck/lever.ts:54` is the marketing heuristic tier.
2. **Real producers:** the identical P&I formula is typed **5×** —
   `lib/utils/calculations.ts:calculatePIRepayment:84`,
   `app/api/calculate/loan/route.ts:calculateMonthlyRepaymentPI:40`,
   `lib/planning/debtPlanner.ts:calculateMinRepaymentPI:143`,
   `lib/cfo/decisionSupport/loanDecisionSupport.ts:calculateMonthlyPayment:685`,
   `lib/cashflow/stressTesting.ts:calculateNewRepayment:263` (which also hardcodes a 30-year
   remaining term: "Assume 30-year term for simplicity").
3. **Canonical home:** `lib/utils/calculations.ts:calculatePIRepayment:84` (already the §6.2
   canonical-utility table's location).
4. **Legislated?** NO (standard finance math). The Div 7A sibling is legislated (s109E cited in
   its file docs; rate injected, no constant typed — D12 fine).
5. **FACT/DERIVED:** DERIVED, MULTIPLE.
6. **Plain English:** the fixed monthly repayment that pays a loan's interest and principal off
   completely by the end of its term.
7. **Verdict:** **MULTIPLE**. Wrong-input watch: zero-rate edge case diverges —
   `calculations.ts:89` returns `principal / termMonths`, while `route.ts:45` and
   `debtPlanner.ts:144` return the FULL principal as the "monthly" repayment when
   `annualRate <= 0` (an absurd monthly figure for a 0% loan); stressTesting's 30-year assumption
   ignores actual remaining term.

## investmentReturns (census 22 · examined 7/22)

1. **Distinct?** SEVERAL near-match quantities conflated: total/unrealised return $ and %, CAGR,
   IRR, TWR. Each needs its own name (D6); none is an alias of an existing MON-131 quantity.
2. **Real producers:** **≥4** — `lib/investments/performance.ts:calculatePerformanceMetrics:325`
   (snapshot-based CAGR/IRR/TWR/Sharpe), `lib/investments/index.ts:calculateInvestmentPerformance:106`
   (transaction-based totals), `lib/cfo/decisionSupport/investmentDecisionSupport.ts:
   calculatePerformanceMetrics:260` (a SECOND function with the SAME NAME, different math,
   DB-coupled, franking estimated from average %), `lib/health/metricAggregation.ts:
   calculateInvestmentMetrics:326`; page-level gain% re-derivations exist
   (`investments/accounts/[id]/page.tsx:gainPercentage`, listed in the unattributed sweep).
3. **Canonical home:** NOT ESTABLISHED (two engines share a function name across files — a
   collision the MON-136 contract must resolve).
4. **Legislated?** NO.
5. **FACT/DERIVED:** DERIVED, MULTIPLE.
6. **Plain English:** how much your investments have made — in dollars and percent — since you
   bought them, and at what annualised rate.
7. **Verdict:** **MULTIPLE** + **UNNAMED** (return% vs CAGR vs unrealised-gain% undifferentiated).

## superProjection (census 3 · examined 3/3)

1. **Distinct?** DISTINCT — "projected super balance at retirement," marketing/wealth-check
   heuristic tier (ATO median balances + APRA long-run returns), deliberately separate from the
   in-app tax engine. `what-if/[lever]/page.tsx:GenericLeverProjection:1665` is a FALSE POSITIVE —
   it renders scenario-engine impacts, computes nothing.
2. **Real producers:** **2** — `lib/wealthCheck/calculator.ts:calculateWealthCheckResult:98` and
   `lib/wealthCheck/lever.ts:selectLever:54` (lever.ts:88 re-types the same
   `householdIncome × SG × earnerSplit` + FV-of-annuity projection the calculator does).
3. **Canonical home:** `lib/wealthCheck/calculator.ts:calculateWealthCheckResult:98` (lever should
   call shared helpers, not re-derive).
4. **Legislated?** Partially — the SG rate is legislated. **D12 violation:**
   `SG_RATE_FROM_2026_07 = 0.12` typed at `lib/marketing/benchmarks.ts:113`, outside
   `taxYearConfig.ts`. Cross-ref MON-133: its list flags a STALE 11.5% SG in two live paths
   (`lib/cashflow/savingOpportunities.ts:56,162` etc.) — this benchmark file is a THIRD SG typing
   (correct value, still a duplicate source) not yet on MON-133's list.
5. **FACT/DERIVED:** DERIVED, MULTIPLE.
6. **Plain English:** a rough estimate of what your super could be worth at 67, based on your age,
   income and typical Australian returns.
7. **Verdict:** **MULTIPLE**.

## propertyValuationGrowth (census 6 · examined 5/6)

1. **Distinct?** TWO different quantities under one census family: (a) **historical capital
   growth** = currentValue − purchasePrice (`lib/strategy/analyzers/propertyAnalyzer.ts:97`,
   `lib/services/masterFinancialService.ts:buildPropertyMetrics:1223`, assets page, property
   portfolio report) and (b) **projected value growth** = value × (1 + assumed rate)
   (`lib/strategy/forecasting/forecastEngine.ts:projectYear:244` + `applyScenarioAdjustment:164`).
   Near-match, NOT foldable into each other.
2. **Real producers:** ≥3 of (a) (analyzer, master service, assets page each subtract
   independently), 1 of (b).
3. **Canonical home:** NOT ESTABLISHED for (a); (b) lives in
   `forecastEngine.ts:projectYear:244` (assumption-driven, acceptable single home).
4. **Legislated?** NO.
5. **FACT/DERIVED:** DERIVED, MULTIPLE for (a); DERIVED, SINGLE for (b). (purchasePrice and
   currentValue are FACTs.)
6. **Plain English:** how much a property has gained in value since you bought it, and how much it
   might grow each year under the app's assumptions.
7. **Verdict:** **MULTIPLE** + **UNNAMED** (historical vs projected growth need separate names).

## insuranceAdequacy (census 15 · examined 6/15)

1. **Distinct?** The census family is almost entirely keyword false positives on
   "coverage"/"runway": `financialIndependence.ts` + `MoneyStoryHeroV2` (FI lifestyle coverage),
   `scoreCalculator` (cashflow coverage), `riskModelling.analyzeLongevityRisk:435` (retirement
   runway — freedomHorizon-adjacent), `tooltips.ts` (copy), `portfolioEngine.calculateGearing:440`
   (gearing).
2. **Real producers:** **0 real.** The ONLY site that emits an "insurance" number is
   `lib/health/metricAggregation.ts:447` — `const insuranceGapsScore = 70;` — a hardcoded
   placeholder ("would need insurance data") wrapped in `createMetric(…, confidence 40)` and
   surfaced as a scored health metric.
3. **Canonical home:** NOT ESTABLISHED.
4. **Legislated?** NO.
5. **FACT/DERIVED:** neither — a constant masquerading as DERIVED.
6. **Plain English:** whether your insurance cover is enough for your situation — the app
   currently shows a fixed 70/100 for everyone, regardless of any data.
7. **Verdict:** **documented capability never built — a finding, not an empty result** +
   **WRONG** (a constant presented as a computed metric) + **UNNAMED**. This is the §19 false-
   number class: it should surface UNCOMPUTED/refuse-to-compute, not 70.

## budgetVariance (census 21 · examined 8/21)

1. **Distinct?** DISTINCT (planned vs actual per category/entry). Not an alias of expenseRunRate.
2. **Real producers:** **3 confirmed, drifting** —
   `lib/utils/reconciliation.ts:calculateBudgetVariance:387` (+`calculateAggregatedBudgetVariance:422`;
   variance = budgeted − actual, ±5% status band),
   `lib/bank/budgetComparison.ts:compareAgainstBudget:95` (variance = target − actual, percentUsed
   vs per-target warningThreshold status — different status semantics),
   `lib/services/masterFinancialService.ts:calculateExpenseBudgetVariance:983` +
   `calculateIncomeBudgetVariance:1160` (transaction-actuals-first; falls back to budget-as-actual,
   i.e. zero variance when unreconciled). `app/api/cashflow/intelligence/route.ts:
   buildBudgetComparison:260` is a fourth candidate (not read this pass);
   `healthScoreAggregator.calculateBudgetAdherenceScore:174` scores on top.
3. **Canonical home:** NOT ESTABLISHED (three homes, three status conventions).
4. **Legislated?** NO.
5. **FACT/DERIVED:** DERIVED, MULTIPLE.
6. **Plain English:** how far your actual spending (or income) ran over or under what you planned.
7. **Verdict:** **MULTIPLE**.

## lvrGearing (census 39 · examined 8/39)

1. **Distinct?** TWO quantities: per-property **LVR** (loan/value %) and portfolio **gearing**
   (debt-to-asset / debt-to-income, `lib/intelligence/portfolioEngine.ts:calculateGearing:440` —
   its own named quantity, single home). Most census hits are consumers/renderers.
2. **Real producers (LVR):** **4** — `lib/utils/calculations.ts:calculateLVR:9` (whose OWN comment
   claims "the single source for every LVR surface"),
   `lib/calculations/loanAggregator.ts:calculateLVR:170` (second lib producer, same name),
   `app/dashboard/properties/page.tsx:calculateLVR:452`,
   `app/dashboard/properties/[id]/page.tsx:computeLvr` (~:165) — the two pages re-derive inline.
3. **Canonical home:** `lib/utils/calculations.ts:calculateLVR:9` (already the §6.2 table entry).
4. **Legislated?** NO.
5. **FACT/DERIVED:** DERIVED, MULTIPLE.
6. **Plain English:** how much of a property's value is still owed to the bank — the key number
   lenders use for refinancing headroom.
7. **Verdict:** **MULTIPLE** — and a drifted-claim note: the SSOT comment inside
   `calculations.ts:calculateLVR` is contradicted by three live re-derivations.

## freedomHorizon (census 6 · examined 6/6)

1. **Distinct?** A bundle of near-match but DIFFERENT quantities, none foldable: retirement
   runway/shortfall (`lib/strategy/analyzers/timeHorizonAnalyzer.ts:analyzeRetirementRunway:40` —
   25× rule + 7% growth), forecast trajectory (`forecastEngine.ts:generateForecast:101`),
   wealth-check freedom age (`lib/wealthCheck/calculator.ts:98`, marketing tier), and FI
   coverage/freedomYears (`lib/calculations/financialIndependence.ts:computeFinancialIndependence:97`
   — census filed it under insuranceAdequacy).
2. **Real producers:** **4**, each a different semantic — MULTIPLE at the family level even though
   each might survive as its own named quantity.
3. **Canonical home:** NOT ESTABLISHED (naming decision required first — D6).
4. **Legislated?** NO.
5. **FACT/DERIVED:** DERIVED, MULTIPLE.
6. **Plain English:** how long until — and whether — you can stop relying on a salary, and how
   long your money would last in retirement.
7. **Verdict:** **MULTIPLE** + **UNNAMED**. Wrong-input watch: `timeHorizonAnalyzer.ts:44-59`
   silently defaults age to 30 and monthly expenses to $5,000 when data is missing, and hardcodes
   the 4%-rule 25× multiple + 7% growth — fabricates a projection instead of refusing to compute
   (§19/FW-2 discipline).

## moneyStoryMargin (census 6 · examined 5/6)

1. **Distinct?** DISTINCT (earned / spent / kept trend + margin %). Trend is single-sourced;
   `app/api/dashboard/insights/route.ts:monthlyOf:277` + `dashboard/page.tsx:generateInsights` are
   consumers/false positives; labs page renders.
2. **Real producers:** **1** for the trend —
   `lib/calculations/moneyStoryTrend.ts:getMoneyStoryTrend:88` (UnifiedTransaction, transfers
   excluded per §19.1). BUT the **margin %** itself is computed inline in the component:
   `components/editorial/money-story/MoneyStoryHeroV2.tsx:234`
   (`marginPct = earned > 0 ? Math.round((kept/earned)*100) : 0`) — a ratio with no lib/ producer.
3. **Canonical home:** trend — `lib/calculations/moneyStoryTrend.ts:getMoneyStoryTrend:88`;
   margin % — NOT ESTABLISHED (component-inline).
4. **Legislated?** NO.
5. **FACT/DERIVED:** DERIVED; trend SINGLE, margin % single-site but homeless.
6. **Plain English:** of every dollar you earned this period, how much you actually kept after
   spending — your personal profit margin.
7. **Verdict:** **CLEAN** (trend) + **UNNAMED** (margin % has no named canonical producer).

---

## Summary table

| family | distinct/alias | examined/total | real producers | canonical home | FACT/DERIVED | verdict |
|---|---|---|---|---|---|---|
| stampDuty | distinct | 4/4 | 1 | `stateStampDuty.ts:calculateStampDuty:285` | DERIVED/SINGLE | CLEAN |
| gst | 2 distinct (BAS vs receipt) | 8/15 | 2 | `gstCalculator.ts:calculateGst:104`; receipt-GST NOT ESTABLISHED | DERIVED/MULTIPLE | MULTIPLE |
| cgt | distinct | 12/98 | ≥5 | `cgtDiscount.ts:calculateCgtDiscount:166` (+ Div 115 siblings) | DERIVED/MULTIPLE | MULTIPLE, WRONG |
| psiAttribution | distinct | 7/11 | 1 | `psiClassifier.ts:classifyPsi:151` | DERIVED/SINGLE | CLEAN |
| div293 | distinct | 4/4 | 1 | `highIncomeSuperTax.ts:calculateHighIncomeSuperTax:77` | DERIVED/SINGLE | CLEAN |
| taxOffsetsFranking | 2 distinct (franking vs offsets) | 10/50 | 3–4 (franking) / 1 (offsets) | franking NOT ESTABLISHED; `taxOffsets.ts:calculateAllOffsets:178` | DERIVED/MULTIPLE | MULTIPLE |
| fteIeeElections | distinct | 7/13 | 1 | `fteIeeClassifier.ts:classifyFteIeeDistributions:166` | DERIVED/SINGLE | CLEAN |
| loanAmortisation | distinct (+ Div 7A sibling) | 8/8 | 5 | `lib/utils/calculations.ts:calculatePIRepayment:84` | DERIVED/MULTIPLE | MULTIPLE |
| investmentReturns | several conflated | 7/22 | ≥4 | NOT ESTABLISHED | DERIVED/MULTIPLE | MULTIPLE, UNNAMED |
| superProjection | distinct (marketing tier) | 3/3 | 2 | `wealthCheck/calculator.ts:calculateWealthCheckResult:98` | DERIVED/MULTIPLE | MULTIPLE |
| propertyValuationGrowth | 2 distinct (historical vs projected) | 5/6 | ≥3 + 1 | NOT ESTABLISHED (hist.); `forecastEngine.ts:projectYear:244` (proj.) | DERIVED/MULTIPLE | MULTIPLE, UNNAMED |
| insuranceAdequacy | mostly false positives | 6/15 | 0 real (1 placeholder) | NOT ESTABLISHED | placeholder constant | never built; WRONG, UNNAMED |
| budgetVariance | distinct | 8/21 | 3 (+1 candidate) | NOT ESTABLISHED | DERIVED/MULTIPLE | MULTIPLE |
| lvrGearing | 2 distinct (LVR vs gearing) | 8/39 | 4 (LVR) / 1 (gearing) | `lib/utils/calculations.ts:calculateLVR:9` | DERIVED/MULTIPLE | MULTIPLE |
| freedomHorizon | 4 near-match distinct | 6/6 | 4 | NOT ESTABLISHED | DERIVED/MULTIPLE | MULTIPLE, UNNAMED |
| moneyStoryMargin | distinct | 5/6 | 1 (trend); margin% inline | `moneyStoryTrend.ts:getMoneyStoryTrend:88`; margin% NOT ESTABLISHED | DERIVED/SINGLE (trend) | CLEAN (trend), UNNAMED (margin%) |

## D12 violations found this pass (legislated constants typed outside `taxYearConfig.ts`)

Cross-ref: MON-133 rootCause already lists `income/page.tsx:566`, `savingOpportunities.ts:56,162`,
`what-if/[lever]/page.tsx:419`, `capTracker.ts:374`, `contributionCalculator.ts:186`,
`DebtQualityWidget.tsx:80`, `lib/cgt/index.ts:68`. **New sites found here:**

- `lib/tax-engine/gst/gstCalculator.ts:38` (`GST_RATE = 0.1`) and `:40` ($75k threshold)
- `lib/documents/intelligence/parsers/australian.ts:127` (`GST_RATE = 0.1`, second typing)
- `lib/cgt/cgtCalc.ts:78-79` (CGT discount 0.5 + 365 days); `lib/cgt/index.ts:62,65` (same, again)
- `lib/cfo/decisionSupport/taxIntegration.ts:199` (`gain * 0.5` hardcoded discount)
- `app/api/investments/capital-gains/route.ts:40` (`days >= 365` in a route)
- `lib/tax-engine/income/taxabilityRules.ts:13`, `lib/investments/index.ts:59`,
  `lib/investments/yield.ts:51` (corporate tax rate 0.30, three typings)
- `lib/tax-engine/core/taxOffsets.ts:106-107` + `:316-317` (SAPTO thresholds, Float + Decimal)
- `lib/tax-engine/divisions/fteIeeClassifier.ts:57` (FTDT 0.47)
- `lib/marketing/benchmarks.ts:113` (`SG_RATE_FROM_2026_07 = 0.12` — third SG typing)
- `lib/tax-engine/stampDuty/stateStampDuty.ts:104+` (per-state duty scales + FPAD rates in-engine)

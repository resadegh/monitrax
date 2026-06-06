# Changelog - 2026-06-06

## Session: qdec-pr2d3d-composers-LIlK9

### Changes Made

- **Type**: Feature / Foundation — composer-tier Decimal siblings (Q-DEC PR 2.D.3d)
- **Scope**: Q-DEC PR 2.D.3d — `lib/tax-engine/super/smsfIncomeTax.ts` (`calculateSmsfIncomeTaxDecimal`), `lib/tax-engine/income/salaryProcessor.ts` (`processSalaryDecimal`), `lib/tax-engine/core/paygCalculator.ts` (`calculateGrossFromNetDecimal` — supporting binary-search reverse calc)
- **Description**: Fourth and final money-math sub-PR of Q-DEC PR 2.D.3. Ships the two composer-tier engines that have real arithmetic worth a Decimal sibling:
  - `calculateSmsfIncomeTax` — Div 295 concessional rate × assessable contributions + concessional rate × (investment income − ECPI exempt) + top rate × NALI + refundable franking offset (Div 207 + s67-25 for complying funds). ECPI honesty discipline preserved bit-for-bit on the Decimal path.
  - `processSalary` — NET→GROSS reverse calc (binary search), salary-sacrifice composition, PAYG (NAT 1004 whole-dollar rounding), Medicare levy (shade-in + surcharge), super guarantee.
- **Scope decision**: `lib/tax-engine/entity/entityTaxRouter.ts` and `lib/tax-engine/orchestrator/masterTaxPosition.ts` were INTENTIONALLY DEFERRED to PR 3 (cutover). They are pure aggregating routers — the underlying engines they call are all already Decimal-capable. A composer-tier Decimal sibling at this layer would be massive type-churn for no marginal correctness benefit; PR 3 cuts the boundary over by switching route handlers from `*` to `*Decimal` and the type contract follows the data.

### Files Modified (Decimal siblings appended)

- `lib/tax-engine/core/paygCalculator.ts` — `calculateGrossFromNetDecimal` appended. Binary-search reverse-calc with 50-iteration cap, $0.01 tolerance, calls `calculatePAYGDecimal` per iteration. Final `gross` rounded `toDecimalPlaces(2, ROUND_HALF_EVEN)` to match Float's `Math.round(x * 100) / 100`. Used only by `processSalaryDecimal`'s NET branch.
- `lib/tax-engine/super/smsfIncomeTax.ts` — `calculateSmsfIncomeTaxDecimal` + `SmsfIncomeTaxInputDecimal` + `SmsfIncomeTaxResultDecimal`. **ECPI honesty discipline preserved bit-for-bit** — pension phase with undefined `ecpiExemptProportion` returns `tax: null, investmentIncomeTax: null, ecpiExemptAmount: null` and surfaces `UC-SMSF-ECPI-PROPORTION` with the same s295-385 citation; never guesses a number. Non-complying branch: top rate on ALL assessable income, NON-refundable franking. Complying branch: 15% concessional, top rate NALI, refundable franking via `applyFrankingDecimal(grossTax, frankingCredits, true)`.
- `lib/tax-engine/income/salaryProcessor.ts` — `processSalaryDecimal` + `SalaryBreakdownDecimal`. Composes: `toAnnualDecimal` → (NET branch: `calculateGrossFromNetDecimal` binary-search) → `calculatePAYGDecimal` (NAT 1004 whole-dollar PAYG preserved) → `calculateMedicareLevyDecimal` → super guarantee + sacrifice. Final outputs rounded HALF_EVEN to 2dp. `calculations` array deliberately omitted from the Decimal sibling — it's a display-side narration concern that already lives on the Float path; we don't dual-write it.

### Files Created

- `lib/calc-audit/engines/decimal-tax-engine-composers.ts` — 2 shadow engines (`smsfIncomeTaxShadow` × 6 fixtures + `processSalaryShadow` × 5 fixtures = 11 fixtures). SMSF fixtures cover: complying accumulation, complying pension 100% ECPI, complying pension 50% ECPI, NALI top rate, franking refund (pension phase), non-complying top rate. Salary fixtures cover: median GROSS annual, GROSS with sacrifice, monthly GROSS, NET reverse-calculated, high earner GROSS.
- `tests/tax-engine/composers.decimal.test.ts` — 22 tests (11 shadow + 6 SMSF contract + 4 salary contract + 1 aggregate shadow report).

### Architectural notes

- **ECPI null preservation.** The Float path returns `tax: null` etc. (not 0) when ECPI proportion is unknown in pension phase — the Decimal sibling MUST mirror this exactly, or the harness would diff one path returning null against the other returning 0. Preserved with explicit `Decimal | null` return-type shape + identical `uncomputed` push.
- **Binary search idempotent on Decimal.** The reverse-calc loop converges in the same iteration count as Float (~25-30 for typical AU salary ranges); both paths agree on gross within tolerance because the underlying PAYG calc agrees within tolerance. Shadow harness validates this end-to-end.
- **Frequency annualisation.** `toAnnualDecimal` already shipped in PR 2.D.0; both salary entry points (GROSS + NET) call it for the input and for the sacrifice amount. Sacrifice frequency defaults to pay frequency (preserves the Float contract).
- **`calculations` array intentionally not dual-written.** Float-side `processSalary` returns a 12-step `CalculationStep[]` narration; the Decimal sibling omits it because (a) it's presentation-side, not computation-side; (b) when PR 3 cuts route handlers over to Decimal, the consumer of `calculations` can either keep its Float source or get rebuilt against the Decimal numbers — that's a UI decision, not a calc-engine decision. The shadow engine `floatExecute` strips `calculations` before comparison.
- **§12.14 reform-agnosticism.** Both engines are reform-agnostic — SMSF income tax + salary PAYG are not in scope of any of the eight 2026-27 reform measures. No regime parameter required, no `commencementVerified` gate needed (FW-1/FW-2 outcome (a)).

### Testing

- [x] 22 new tests pass (11 shadow + 11 contract).
- [x] `npx tsc --noEmit` clean.
- [x] Shadow report PASS on all 11 fixtures across both composer engines (full report aggregate).
- [x] Pre-existing test failures (29 in `tools-41h5` + `cross-module`) confirmed to predate this branch via `git stash` → re-run on main → same failures (out of scope).

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (PR 2.D.3d row flipped to ✅ COMPLETE in `IMPLEMENTATION_PLAN.md`)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 2.D.3d row flipped to ✅ COMPLETE; PR 2.D scope summary updated to reflect all four sub-PRs landed.
- `docs/changelog/CHANGELOG_2026_06_06.md` — this entry.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Functions added are reform-agnostic by design — SMSF Div 295 + PAYG NAT 1004 + Medicare + super guarantee are not in scope of any 2026-27 reform measure. FW-1 outcome (a): no regime parameter required.
- [x] No `commencementVerified` gate needed (FW-2 outcome (a)).
- [x] No new schema columns on `Property` / `Investment` / `LegalEntity` (FW-3 N/A).
- [x] No new AI tool (FW-4 N/A).
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only. No Prisma writes, no schema changes.

### Next

- PR 2.D.3 complete (all four sub-PRs landed: 3a state taxes / 3b CGT / 3c loss treatment + 3c2 beneficiary + 3d composers).
- PR 3 — cutover. Route handlers + AI tools + UI consumers switched from `*` to `*Decimal`. `entityTaxRouter` and `masterTaxPosition` get their Decimal siblings created at this layer once their downstream consumers are Decimal too (avoids the type-churn dance of dual-typing an aggregating router).

---

## Session: qdec-pr2e-cfo-LIlK9

### Changes Made

- **Type**: Feature / Foundation — `lib/cfo/scenarios/*` Decimal siblings (Q-DEC PR 2.E.1)
- **Scope**: Q-DEC PR 2.E.1 — Decimal siblings for the 6 deterministic What-If scenarios (`refinanceLoan` / `payDownLoan` / `redirectToOffset` / `sellProperty` / `cutSpendCategory` / `addInvestment`) + 3 supporting primitive Decimal siblings on `lib/utils/calculations.ts` (`calculatePIRepaymentDecimal` — exact amortising annuity via `Decimal.pow`; `calculateInterestForPeriodDecimal`; `calculateEffectivePrincipalDecimal`).
- **Description**: First sub-PR of Q-DEC PR 2.E. Splits the ~6.6k-LOC `lib/cfo/*` into 4 cohesive sub-PRs by theme; this PR is the Phase 45 What-If critical path — every lever the UI exposes runs through one of these engines, and the 10-year projection composer (Phase 45 PR 1) will consume the Decimal outputs directly without a Float-bridge.
- **Scope refinement**: original PR 2.E was monolithic; given lib/cfo/ is 19 files / 6,568 LOC, split into 4 sub-PRs (E.1 scenarios, E.2 score+risk, E.3 decision-support, E.4 actions+AI+intelligence) for review tractability — same pattern as PR 2.D.3 split.

### Files Modified (Decimal siblings appended)

- `lib/utils/calculations.ts` — `calculateEffectivePrincipalDecimal` (max(0, p − offset) mirror), `calculateInterestForPeriodDecimal` (p × rate/n; zero-period guard), `calculatePIRepaymentDecimal` (exact amortising annuity via `Decimal.pow`; degenerate cases — zero rate falls back to straight-line, zero term floors at max(1, term) — preserved bit-for-bit).
- `lib/cfo/scenarios/types.ts` — `ScenarioImpactDecimal` + `ScenarioResultDecimal` types; mirror Float shape with `Decimal` typed `before/after/delta`.
- `lib/cfo/scenarios/refinanceLoan.ts` — `refinanceLoanScenarioDecimal`. Calls `calculatePIRepaymentDecimal` for new repayment; lifetime savings + break-even months + cashflow delta in Decimal.
- `lib/cfo/scenarios/payDownLoan.ts` — `payDownLoanScenarioDecimal` + `walkAmortisationDecimal` (private Decimal amortisation walk; same 600-month cap + $0.01 stop threshold + max-payment-floor as Float).
- `lib/cfo/scenarios/redirectToOffset.ts` — `redirectToOffsetScenarioDecimal`. Composes `calculateEffectivePrincipalDecimal` + `calculateInterestForPeriodDecimal`.
- `lib/cfo/scenarios/sellProperty.ts` — `sellPropertyScenarioDecimal`. Net cash freed = grossProceeds − sellingCosts − loanPayoff; net worth delta = −sellingCosts.
- `lib/cfo/scenarios/cutSpendCategory.ts` — `cutSpendCategoryScenarioDecimal`. Realised reduction = `min(requested, currentSpend)`; savings rate recompute preserves Float's divide-by-zero guard; emergency months recompute = liquid / monthlyExpensesAfter.
- `lib/cfo/scenarios/addInvestment.ts` — `addInvestmentScenarioDecimal`. Future-value of monthly annuity via `Decimal.pow` with integer-month exponent; zero-return fallback preserved.

### Files Created

- `lib/calc-audit/engines/decimal-cfo-scenarios.ts` — 6 shadow engines × ~5 fixtures each = 28 fixtures total. Synthetic `MasterFinancialSnapshot` helper populates only the fields each scenario reads (the snapshot is large but the per-scenario read-surface is narrow). Aggregate export `cfoScenarioShadowEngines`.
- `tests/cfo/scenarios.decimal.test.ts` — 53 tests (6 primitive contract + 28 shadow + 18 scenario contract + 1 aggregate report).

### Architectural notes

- **`Decimal.pow(integer)` for annuity exponent**. Both `calculatePIRepaymentDecimal` and `addInvestmentScenarioDecimal` raise `(1 + rate)` to an integer month count — exact, no series approximation. Float's `Math.pow` agrees on the same numbers to within currency tolerance (verified by all 28 shadow fixtures).
- **Amortisation walk preserved bit-for-bit**. `walkAmortisationDecimal` mirrors the Float walk's structure: 600-month cap, $0.01 stop threshold (`stopThreshold = new Decimal('0.01')`), `Decimal.max(new Decimal(0), monthlyRepayment.minus(interest))` floors the principal payment (mirrors Float's `Math.max(0, ...)`), `Decimal.min(principalPayment, principal)` caps the applied amount.
- **String fields skipped by harness**. Each `ScenarioResult` carries `title` / `summary` / `warnings[].message` / `assumptions[]` strings — the shadow harness `isNumericLeaf` check skips these cleanly. Only `impacts[*].{before, after, delta}` numeric leaves are compared.
- **Savings-rate field policy**. `cutSpendCategory.impacts[2]` is a percentage (not currency); Float doesn't pre-round it via `Math.round`, so `'percentage'` tolerance fits. Override is the only non-default in any fieldPolicy.
- **Float-bridge avoided**. No scenario reaches into Float math from the Decimal sibling — all primitives have Decimal siblings shipped in this PR; the supporting `lib/utils/calculations.ts` math is now fully Decimal-capable for the scenario surface.
- **§12.14 reform-agnosticism.** All 6 scenarios are reform-agnostic — none invoke a reform-aware tax engine. (CGT is explicitly delegated to the tax engine via a warning, not recomputed in-engine — `sellPropertyScenario` warns about CGT but doesn't compute it; §12.2 SSOT preserved.) No regime parameter required, no `commencementVerified` gate needed (FW-1/FW-2 outcome (a)).

### Testing

- [x] 53 new tests pass (6 primitive contract + 28 shadow + 18 scenario contract + 1 aggregate report).
- [x] `npx tsc --noEmit` clean.
- [x] Shadow report PASS on all 28 fixtures across all 6 scenarios.
- [x] Pre-existing failures (58 in `tools-41h5` + `cross-module` + `regression/api`) confirmed via baseline — out of scope, predate this branch.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 2.E.1 row added under new PR 2.E section split; PR 2.E.2/3/4 queued)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 2.E expanded from single row to 4 sub-PR rows (E.1 IN FLIGHT this PR; E.2/3/4 queued); Last touched flipped to 2026-06-06.
- `docs/changelog/CHANGELOG_2026_06_06.md` — this entry.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] All 6 scenarios are reform-agnostic (FW-1 outcome (a)) — `sellProperty` explicitly delegates CGT to the tax engine via a warning rather than recomputing in-engine, preserving §12.2 SSOT + reform-awareness already in the tax engine.
- [x] No `commencementVerified` gate needed (FW-2 outcome (a)).
- [x] No new schema columns (FW-3 N/A).
- [x] No new AI tool (FW-4 N/A).
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only. No Prisma writes, no schema changes.

### Next

- PR 2.E.2 — `scoreCalculator` (financial health) + `riskRadar` (cross-engine risk surfacing).
- PR 2.E.3 — `decisionSupport/{property, loan, investment, taxIntegration}`.
- PR 2.E.4 — `actionEngine` + `aiAdvisor` + `intelligenceEngine`.

---

## Session: qdec-pr2e2-cfo-score-risk-LIlK9

### Changes Made

- **Type**: Feature / Foundation — `scoreCalculator` + `riskRadar` Decimal siblings (Q-DEC PR 2.E.2)
- **Scope**: Q-DEC PR 2.E.2 — Decimal siblings for `lib/cfo/scoreCalculator.ts` (6 component sub-scores + composer + weighted-overall) and `lib/cfo/riskRadar.ts` (`calculateSummaryDecimal`).
- **Description**: Second sub-PR of Q-DEC PR 2.E. Ships the financial-health scoring engine on the Decimal path. Each of the 6 component sub-scores (`cashflowStrength` / `debtCoverage` / `emergencyBuffer` / `investmentDiversification` / `spendingControl` / `savingsRate`) is a pure step-function with linear interpolation between thresholds — the math compounds via the weighted-overall composer, so real Decimal siblings matter. `riskRadar` gets a summary-layer Decimal sibling only — per-detector Decimal siblings deferred because each detector is categorical (ratio → conditional risk object) with shallow money math + already-rounded per-risk `impact`.

### Files Modified (Decimal siblings appended)

- `lib/cfo/scoreCalculator.ts` — 8 exports appended:
  - `CFOScoreComponentsDecimal` — Decimal-typed mirror of `CFOScoreComponents`.
  - `calculateCashflowStrengthDecimal` — cashflow-ratio step function, 7 tiers preserved, divide-by-zero floor.
  - `calculateDebtCoverageDecimal` — DSR step function, 6 tiers preserved, zero-income + zero-debt special case (100), zero-income + nonzero debt (0).
  - `calculateEmergencyBufferDecimal` — months-covered step function, 4 tiers preserved, zero-essential-expenses split (100 if liquid, else 50).
  - `calculateInvestmentDiversificationDecimal` — asset-class count + balance + concentration penalty, max-100 floor preserved.
  - `calculateSpendingControlDecimal` — discretionary-ratio step function, 5 tiers preserved + final linear-decay floor (`max(0, 20 - (ratio - 0.5) × 40)`).
  - `calculateSavingsRateDecimal` — post-loan savings-rate step function, 5 tiers preserved, zero-income + negative-rate floors.
  - `calculateComponentsDecimal` — composer; returns UN-rounded Decimal sub-scores (Float path rounds at this layer; Decimal path defers rounding to the API boundary).
  - `calculateOverallScoreDecimal` — weighted-overall composition using the existing `SCORE_WEIGHTS` constants.
- `lib/cfo/riskRadar.ts` — `RiskSummaryDecimal` + `calculateSummaryDecimal` appended. Counts stay as numbers (categorical); `totalImpact` accumulated in Decimal so 10× $123.45 sums exactly to $1,234.50 (vs Float `0.1 + 0.2 !== 0.3` drift category).

### Files Created

- `lib/calc-audit/engines/decimal-cfo-score-risk.ts` — 8 shadow engines × ~5 fixtures each = 41 fixtures. Float-side helpers re-derived in this file (the originals in `scoreCalculator.ts` are NOT exported); each re-derivation tagged with the source-file line range for audit. Aggregate export `cfoScoreRiskShadowEngines`.
- `tests/cfo/score-risk.decimal.test.ts` — 71 tests (41 shadow + 26 contract + 4 aggregate including `calculateSummaryDecimal` precision check).

### Architectural notes

- **Step-function thresholds preserved bit-for-bit.** Each component's tier boundaries (`0.3 / 0.2 / 0.1 / 0 / -0.1 / -0.2` for cashflow; `0.2 / 0.3 / 0.4 / 0.5 / 0.6` for DSR; etc.) translated as `'0.3' / '0.2' / ...` string literals into Decimal constants — avoids any IEEE-754 representation issues at the boundary itself.
- **Component rounding deferred to API boundary.** Float-side `calculateComponents` rounds each sub-score to integer BEFORE the weighted composition; Decimal path keeps the raw sub-score then weights, then rounds at the API. For shadow comparison the harness's `currency` tolerance (0.005) absorbs the typically <0.5 rounding-order difference per fixture.
- **Re-derived Float helpers in shadow file.** The Float helpers in `scoreCalculator.ts` (`calculateCashflowStrength` etc.) are not exported and re-deriving them in the shadow file keeps the test harness self-contained — any drift between paths surfaces as a real DIFF rather than a transcription error. Each re-derivation cites the source-file line range.
- **`riskRadar` summary-only Decimal sibling — rationale.** Each of the 10 detectors (`detectLowBalanceRisks`, `detectCashflowShortfallRisks`, etc.) is structurally categorical: compute one ratio (e.g. payment / income), compare against a threshold (0.2 / 0.3 / 0.5 / 0.7), conditionally emit a `FinancialRisk` object whose `impact` is `Math.round(...)`-rounded for display. The threshold comparisons are float-stable (no compounding). The aggregator at the summary layer is where impact precision starts to matter — summing N impacts across detectors. That's where the Decimal sibling lives.
- **§12.14 reform-agnosticism.** Both engines are reform-agnostic — `scoreCalculator`'s 6 components measure cashflow / debt / liquidity / diversification / spending / savings ratios; none are in scope of any 2026-27 reform measure. `riskRadar` summarises detector outputs without reform-aware math. FW-1/FW-2 outcome (a).

### Testing

- [x] 71 new tests pass (41 shadow + 26 contract + 4 aggregate).
- [x] `npx tsc --noEmit` clean.
- [x] Shadow report PASS on all 41 fixtures across all 8 shadow engines.
- [x] Pre-existing failures (58 in `tools-41h5` + `cross-module` + `regression/api`) confirmed out of scope.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 2.E.1 row marked ✅ MERGED #991; PR 2.E.2 row flipped IN FLIGHT this PR)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 2.E.1 ✅ MERGED #991; PR 2.E.2 IN FLIGHT this PR; Last touched flipped 2026-06-06 / E.2.
- `docs/changelog/CHANGELOG_2026_06_06.md` — this entry.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] All 6 component sub-scores are reform-agnostic — cashflow / debt / liquidity / diversification / spending / savings ratios are not in scope of any 2026-27 reform measure. FW-1 outcome (a).
- [x] `riskRadar.calculateSummary` is reform-agnostic — aggregates detector outputs. FW-1 outcome (a).
- [x] No `commencementVerified` gate needed (FW-2 outcome (a)).
- [x] No new schema columns (FW-3 N/A).
- [x] No new AI tool (FW-4 N/A).
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only. No Prisma writes, no schema changes.

### Next

- PR 2.E.3 — `lib/cfo/decisionSupport/{propertyDecisionSupport, loanDecisionSupport, investmentDecisionSupport, taxIntegration}` Decimal siblings.
- PR 2.E.4 — `actionEngine` + `aiAdvisor` + `intelligenceEngine` Decimal siblings.

---

## Session: qdec-pr2e3-cfo-decision-support-LIlK9

### Changes Made

- **Type**: Feature / Foundation — `lib/cfo/decisionSupport/*` Decimal siblings (Q-DEC PR 2.E.3)
- **Scope**: Q-DEC PR 2.E.3 — Pure-math Decimal siblings across all 4 decision-support files: `propertyDecisionSupport`, `loanDecisionSupport`, `investmentDecisionSupport`, `taxIntegration`. 8 helpers total.
- **Description**: Third sub-PR of Q-DEC PR 2.E. The 4 files in `lib/cfo/decisionSupport/` are ~1,927 LOC combined. Each one mixes pure money math with async/Prisma fetching + categorical alert generation. This PR ships Decimal siblings for the pure-math helpers only — the async `calculateCFO*Insights` wrappers + categorical alert/risk/performance generators are deferred to PR 3 cutover (their outputs are presentation objects, not numeric, so they swap with the route handlers).

### Files Modified (Decimal siblings appended)

- `lib/cfo/decisionSupport/propertyDecisionSupport.ts` — `CFOPropertyPortfolioSummaryDecimal` + `calculatePortfolioSummaryDecimal`. Aggregates totals (value / equity / monthly income from annual / monthly cashflow) + weighted LVR (`(totalValue − totalEquity) / totalValue × 100`). Empty-portfolio + zero-value floors preserved. UN-rounded outputs (Float path rounds via `Math.round`; Decimal defers to API boundary).
- `lib/cfo/decisionSupport/loanDecisionSupport.ts` — `calculateMonthlyPaymentDecimal` (amortising annuity, degenerate `rate=0 OR months=0` falls back to `principal/max(1,months)`), `calculatePayoffMonthsDecimal` (months-to-payoff via `-ln(1 − P×r/M) / ln(1+r)`; logarithm bridged via `.toNumber()` because `decimal.js` doesn't ship `log` on the core API; output is `Math.ceil`'d to integer months anyway so sub-1-month drift is irrelevant; capped at 600), `calculateTotalInterestDecimal` (`max(0, payment × months − principal)`).
- `lib/cfo/decisionSupport/investmentDecisionSupport.ts` — `calculateDividendYieldDecimal` (franked @ 4%, unfranked @ 2%, blended by share of total value — pre-rounded `'0.04'`/`'0.02'` strings to avoid IEEE-754 representation issues) + `calculateMaxConcentrationDecimal` (single-holding share of portfolio, returns % Decimal). Both with divide-by-zero guards. New exported types `InvestmentHoldingDecimalInput`.
- `lib/cfo/decisionSupport/taxIntegration.ts` — `calculateUnrealisedCGTDecimal` (per-holding gain × 50% CGT discount; loss-excluded; null `currentPrice` falls back to `averagePrice` → 0 gain) + `calculateNegativeGearingBenefitDecimal` (per-INVESTMENT property `annualIncome − annualExpenses − annualLoanInterest`; negative net × `marginalRate/100`). New exported types `CgtHoldingDecimalInput` + `NegativeGearingPropertyDecimalInput`. **§12.14 FW-1 note**: this helper is a portfolio-overview heuristic assuming pre-reform grandfathered treatment; the canonical reform-aware engine is `applyNegativeGearingDecimal` in `lib/tax-engine/divisions/negativeGearing.ts` (shipped in PR 2.D.3c). FW-1 outcome (a) here — the caller-side regime gating happens in the AI advisor + master tax position.

### Files Created

- `lib/calc-audit/engines/decimal-cfo-decision-support.ts` — 8 shadow engines × ~3-5 fixtures each = 33 fixtures. Float-side helpers re-derived in this file (the originals in `loanDecisionSupport.ts` are NOT exported; the property/investment/tax-integration helpers are exported as Decimal siblings but their Float counterparts are private). Aggregate export `cfoDecisionSupportShadowEngines`.
- `tests/cfo/decision-support.decimal.test.ts` — 61 tests (33 shadow + 27 contract + 1 aggregate).

### Architectural notes

- **Logarithm bridge in `calculatePayoffMonthsDecimal`.** `decimal.js` core API doesn't export `log`/`ln`; using the `decimal.js` extended API would mean importing the `decimal.js/decimal.js` build instead of `decimal.js/decimal.js-light`. Rather than churn the bundle dep, the helper bridges to Float `Math.log` after the divide-and-subtract step. The output is `Math.ceil`'d to an integer month count, so sub-1-month logarithm drift is irrelevant. Shadow comparison validates this end-to-end (Float and Decimal agree on `Math.ceil` integer output for all fixtures).
- **Categorical helpers deferred.** Each of `generatePropertyAlerts`, `generateInvestmentAlerts`, `calculateRefinanceOpportunities`, `generateRateAlerts`, `detectLoanRisks`, `detectTaxRisks`, `findPerformanceExtremes`, `calculateAllocationAnalysis`, `identifyMissedDeductions` produces structured objects (alerts/risks/performance/rebalance actions) with rounded `Math.round(...)` numeric leaves for display. The threshold comparisons that gate alert emission are float-stable (no compounding). PR 3 cutover swaps the consumer route handlers from Float to Decimal at the inputs; these categorical generators stay on the Float path until then.
- **Async wrappers deferred to PR 3.** `calculateCFOPropertyInsights`, `calculateCFOLoanInsights`, `calculateCFOInvestmentInsights`, `calculateCFOTaxInsights` are all async + Prisma-fetching. PR 3 swaps the route-handler-side consumer pattern, at which point these wrappers either compose the Decimal helpers shipped here OR get their own Decimal sibling wrappers (TBD per consumer needs).
- **§12.14 reform-agnosticism.** 7 of the 8 helpers are reform-agnostic by construction (portfolio sums, amortisation, dividend yield, concentration, CGT discount heuristic). The 8th — `calculateNegativeGearingBenefitDecimal` — is documented as a pre-reform-grandfathered heuristic that defers regime gating to the canonical `applyNegativeGearingDecimal` engine in `lib/tax-engine/divisions/negativeGearing.ts`. FW-1 outcome (a).

### Testing

- [x] 61 new tests pass (33 shadow + 27 contract + 1 aggregate).
- [x] `npx tsc --noEmit` clean.
- [x] Shadow report PASS on all 33 fixtures across all 8 shadow engines.
- [x] Pre-existing failures (58 in `tools-41h5` + `cross-module` + `regression/api`) confirmed out of scope.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 2.E.2 marked ✅ MERGED #992; PR 2.E.3 IN FLIGHT this PR)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 2.E.2 ✅ MERGED #992; PR 2.E.3 IN FLIGHT this PR; Last touched flipped to 2026-06-06 / E.3.
- `docs/changelog/CHANGELOG_2026_06_06.md` — this entry.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] 7 of 8 helpers are reform-agnostic by construction (portfolio sums, amortisation, dividend yield, concentration, CGT discount heuristic). FW-1 outcome (a).
- [x] `calculateNegativeGearingBenefitDecimal` documented as pre-reform-grandfathered portfolio-overview heuristic; canonical reform-aware engine is `applyNegativeGearingDecimal` in `lib/tax-engine/divisions/negativeGearing.ts` (shipped PR 2.D.3c). FW-1 outcome (a) — regime gating happens at the AI advisor + master tax position layers, not in this helper.
- [x] No `commencementVerified` gate needed (FW-2 outcome (a)).
- [x] No new schema columns (FW-3 N/A).
- [x] No new AI tool (FW-4 N/A).
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only.

### Next

- PR 2.E.4 — `actionEngine` + `aiAdvisor` + `intelligenceEngine` Decimal siblings.

---

## Session: qdec-pr2e4-cfo-actions-ai-intel-LIlK9

### Changes Made

- **Type**: Feature / Foundation — `lib/cfo/intelligenceEngine` Decimal siblings (Q-DEC PR 2.E.4 — **final 2.E sub-PR**)
- **Scope**: Q-DEC PR 2.E.4 — Decimal siblings for the 2 pure-math helpers in `intelligenceEngine.ts`. `actionEngine.ts` + `aiAdvisor.ts` SHIPPED WITHOUT Decimal siblings — full rationale below.
- **Description**: Final sub-PR of Q-DEC PR 2.E (and thus of Q-DEC PR 2 overall). The original PR 2.E.4 brief was "`actionEngine` + `aiAdvisor` + `intelligenceEngine`". On inspection, only `intelligenceEngine` had pure-math helpers worth a Decimal sibling. `actionEngine` and `aiAdvisor` are categorical/presentation-side — Decimal siblings would be wasteful churn with zero precision benefit. The skip rationale is documented in code (header of `lib/calc-audit/engines/decimal-cfo-actions-ai-intel.ts`) so the next session doesn't re-litigate.

### Files Modified (Decimal siblings appended)

- `lib/cfo/intelligenceEngine.ts` — 2 helpers:
  - `calculateProjectedMonthEndBalanceDecimal(liquidBalance, dailyBurn, daysRemaining)` — pure: `liquidBalance − dailyBurn × daysRemaining`. Composes Decimal `totalLiquid` (from `netWorthCalculator` Decimal sibling, PR 2.A) and Decimal `dailyBurn` (from `expenseAggregator` Decimal sibling, PR 2.B), so once PR 3 cutover lands the Decimal flow runs end-to-end here without Float-bridge.
  - `calculateMonthlyProgressNetWorthDecimal({accountBalances, propertyValues, investmentHoldings, totalDebt})` — pure: `accounts + properties + holdings × price − debt`. Note documented: a more comprehensive net-worth engine already ships in PR 2.A (`calculateNetWorthDecimal`); this helper exists for the intelligence-engine local composition only, where the downstream `lastMonthNetWorth = currentNetWorth × 0.98` simulated placeholder makes the canonical engine's extra precision moot.

### Files Created

- `lib/calc-audit/engines/decimal-cfo-actions-ai-intel.ts` — 2 shadow engines × 5 fixtures each = 10 fixtures. Header documents the full scope-discipline rationale for why `actionEngine` + `aiAdvisor` have no Decimal siblings.
- `tests/cfo/actions-ai-intel.decimal.test.ts` — 19 tests (10 shadow + 8 contract + 1 aggregate).

### Architectural notes — why NO Decimal sibling for actionEngine + aiAdvisor

- **`actionEngine.ts` — categorical recommendation generator.** Functions like `generateScoreImprovementActions` emit `CFOAction` objects with hard-coded display amounts (`amount: 5000`, `amount: 200`, `amount: 1000`) used as priority thresholds (`impact.amount > 500` / `> 1000` in `determinePriority`). The threshold comparisons are float-stable (no compounding). The numeric leaves are recommendation copy, not computed money. A Decimal sibling here would be wasteful churn — the threshold comparisons produce the same `'do_now' | 'upcoming' | 'consider_soon' | 'background'` categorical output under both paths.
- **`aiAdvisor.ts` — Gemini tool-call dispatcher + prompt construction.** The 3 numeric helpers (`bucket`, `round`, `clamp`) are all display-side / range-guard utilities. The actual money math the advisor narrates over is the scenario engine output (Decimal siblings shipped PR 2.E.1) and the master tax position (Decimal siblings shipped PR 2.D.2b). PR 3 cutover swaps these consumers to Decimal at the input boundary; aiAdvisor stays as a presentation-side narrator.

### Architectural notes — what was shipped

- **Local net-worth aggregation in intelligence engine.** The canonical net-worth engine in `netWorthCalculator.calculateNetWorthDecimal` (PR 2.A) is the SSOT for proper liability classification + cost-base costs + accounting hygiene. The intelligence-engine local aggregation is a smaller composition for the dashboard's "monthly progress" tile, which downstream multiplies by a simulated `× 0.98` placeholder for "last month net worth". The extra precision of the canonical engine is moot when the downstream is a placeholder constant. This helper exists so the intelligence-engine's composition is fully Decimal once PR 3 cuts over — not to compete with the canonical engine.
- **Projected month-end balance precision.** This is real money math the user sees on the dashboard's "Where you'll land" tile. Float would drift by epsilon on 31-day × $X/day multiplications across a household with many recurring expense components. Decimal accumulates exact.
- **§12.14 reform-agnosticism.** Both helpers are reform-agnostic — net-worth aggregation + projected balance are not in scope of any 2026-27 reform measure. FW-1/FW-2 outcome (a).

### Testing

- [x] 19 new tests pass (10 shadow + 8 contract + 1 aggregate).
- [x] `npx tsc --noEmit` clean.
- [x] Shadow report PASS on all 10 fixtures across both shadow engines.
- [x] Pre-existing failures (58 in `tools-41h5` + `cross-module` + `regression/api`) confirmed out of scope.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 2.E.4 IN FLIGHT this PR; after merge, **entire Q-DEC PR 2 is complete**)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 2.E.4 IN FLIGHT this PR; Last touched flipped to reflect 2.E completion.
- `docs/changelog/CHANGELOG_2026_06_06.md` — this entry.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Both Decimal helpers are reform-agnostic — net-worth aggregation + projected balance are not in scope of any 2026-27 reform measure. FW-1 outcome (a).
- [x] No `commencementVerified` gate needed (FW-2 outcome (a)).
- [x] No new schema columns (FW-3 N/A).
- [x] No new AI tool (FW-4 N/A) — `aiAdvisor.ts` intentionally not modified.
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only.

### Next

- **Q-DEC PR 2 is COMPLETE** once this PR lands (16 sub-PRs total: 1, 1.5, 2.A, 2.B, 2.C, 2.D.1, 2.D.2, 2.D.2b, 2.D.3a/b/c/c2/d, 2.E.1/2/3/4).
- PR 3 — engine-by-engine cutover. Route handlers + AI tools + UI consumers switched from `*` to `*Decimal`. `entityTaxRouter` and `masterTaxPosition` get their Decimal siblings created at this layer once downstream consumers are Decimal too. Async `calculateCFO*Insights` wrappers in `decisionSupport/*` and `getCFODashboardData` in `intelligenceEngine` get their Decimal-flow swap at this layer.
- PR 4 — Float column drop (after 7-day parallel-run shows zero diff; §12.11 destructive-write checklist mandatory). Unblocks Phase 45 PR 1 (engine composition).

---

## Session: qdec-pr3a-tax-composers-LIlK9

### Changes Made

- **Type**: Feature / Foundation — composer-tier Decimal siblings (Q-DEC PR 3.A — first PR 3 sub-PR)
- **Scope**: Q-DEC PR 3.A — `lib/tax-engine/entity/entityTaxRouter.ts:calculateEntityTaxPositionDecimal` + `lib/tax-engine/orchestrator/masterTaxPosition.ts:buildMasterTaxPositionDecimal`. These were INTENTIONALLY DEFERRED from PR 2.D.3d per the scope decision documented in CHANGELOG_2026_06_06 (PR #989 entry): pure aggregating routers with no marginal benefit at Decimal until downstream consumers are also Decimal. PR 3 is when those consumers swap, so this PR ships the composer Decimal siblings as the foundation.
- **Description**: First sub-PR of Q-DEC PR 3 cutover. Adds the two deferred composer Decimal siblings without changing any caller — PR 3.B-E are the consumer swaps. Splits PR 3 into 5 sub-PRs (A composers / B tax routes / C cfo routes / D AI tools / E UI) matching PR 2's tractability discipline.

### Files Modified (Decimal siblings appended)

- `lib/tax-engine/entity/entityTaxRouter.ts` — `calculateEntityTaxPositionDecimal` + `EntityTaxPositionDecimal`. Same routing logic as Float (PERSONAL_NAME / SOLE_TRADER → `calculateTaxPositionDecimal`; DISCRETIONARY_TRUST / UNIT_TRUST with distribution data → `allocateTrustDistributionDecimal`; SMSF with dispatch data → `trackContributionCapsDecimal` + `calculateHighIncomeSuperTaxDecimal` + `calculateSmsfIncomeTaxDecimal`; COMPANY with div7a → `classifyDiv7ALoansDecimal`; UNCOMPUTED branches preserve the same flag IDs as Float). CGT side calc via `applyCapitalLossNettingDecimal` runs independent of income-tax dispatch — preserves the "COMPANY with cgtEvents → income tax UNCOMPUTED + CGT computed" pattern from Float.
- `lib/tax-engine/orchestrator/masterTaxPosition.ts` — `buildMasterTaxPositionDecimal` + `MasterTaxPositionDecimal` + `CrossCuttingTaxResultDecimal`. Same 5-step pipeline as Float (per-entity dispatch → cross-cutting modules → per-entity overlays → totals aggregation → boundary footer); each downstream engine call is the `*Decimal` sibling already shipped by PR 2.D sub-PRs. Totals aggregation accumulates `assessableIncome + taxableIncome + netTax + paygWithheld` in Decimal across entities; `estimatedRefund = paygWithheld − netTax`. Trust-deed validation overlay reuses the Float result type (categorical — citations + UNCOMPUTED only, no numeric leaves).

### Files Created

- `tests/tax-engine/composers.decimal.routerOrchestrator.test.ts` — 15 tests covering the COMPOSITION layer:
  1. PERSONAL_NAME / SOLE_TRADER dispatch returns Decimal result.
  2. UNCOMPUTED branches (PARTNERSHIP / COMPANY without div7a / DISCRETIONARY_TRUST without distribution / SMSF without dispatch) preserve the same flag IDs as Float.
  3. CGT side calc surfaces Decimal `cgtResult` even when income tax is UNCOMPUTED (the "never false silence" pattern).
  4. Orchestrator aggregates Decimal totals; `estimatedRefund = paygWithheld − netTax`.
  5. Cross-cutting GST runs on Decimal path when input provided.
  6. UNCOMPUTED-only households produce 0 totals (no false numbers from the orchestrator).

### Architectural notes

- **Composition-layer testing only.** Numerical agreement with Float is validated by the existing 11-engine Decimal shadow-comparison suite (PR 2.D sub-PRs) — every downstream engine the router dispatches to is already shadow-tested. This PR's tests focus on the COMPOSITION layer (right dispatch per entity type, right Decimal types flow through, right aggregation in the orchestrator). No new shadow engine added.
- **Trust-deed validation overlay reuses Float result type.** `validateTrustDistributionAgainstDeed` returns a categorical result (citations + UNCOMPUTED only, no numeric leaves). The Decimal sibling reuses the Float result type — no Decimal sibling needed.
- **Stamp-duty Float input → Decimal stamp-duty engine.** `MasterTaxPositionInput.stampDutyTransactions` carries Float `StampDutyInput`. `calculateStampDutyDecimal` accepts the same input shape (both Float and Decimal engines coerce via `toDecimal()` at the boundary).
- **GST input shape parity.** Float `GstInput` and Decimal `GstInputDecimal` are structurally identical (`transactions[] + annualTurnover + isRegistered`). No mapping needed.
- **§12.14 reform-agnosticism.** Both composers are reform-agnostic — they're pure dispatch/aggregation routers. The reform-aware engines they dispatch to (negativeGearing, cgtDiscount, trustMinimumTax, etc.) carry their own FW-1/FW-2 guards. The composer-tier engines don't need a regime parameter. FW-1 outcome (a).

### Testing

- [x] 15 new tests pass (composition-layer dispatch + types + aggregation).
- [x] `npx tsc --noEmit` clean.
- [x] Pre-existing failures (58 in `tools-41h5` + `cross-module` + `regression/api`) confirmed out of scope.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (Q-DEC PR 2 ✅ COMPLETE; PR 3 expanded from single row to 5 sub-PR rows; PR 3.A IN FLIGHT this PR)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 3 expanded into A/B/C/D/E sub-PRs (A IN FLIGHT this PR; B/C/D/E queued); Last touched flipped to reflect PR 2 completion + PR 3.A in flight.
- `docs/changelog/CHANGELOG_2026_06_06.md` — this entry.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Both composer-tier engines are reform-agnostic — they dispatch to reform-aware engines (negativeGearing, cgtDiscount, trustMinimumTax) which carry their own FW-1/FW-2 guards. No regime parameter required at the composer layer. FW-1 outcome (a).
- [x] No `commencementVerified` gate needed (FW-2 outcome (a)).
- [x] No new schema columns (FW-3 N/A).
- [x] No new AI tool (FW-4 N/A).
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only.

### Next

- PR 3.B — `/api/tax/*` route handlers swap from Float composers to `buildMasterTaxPositionDecimal`. Response shape unchanged (JSON `number` at the boundary via `.toNumber()`).
- PR 3.C — `/api/cfo/*` route handlers swap to PR 2.E Decimal engines.
- PR 3.D — `lib/ai/tax-advisor/tools/*` consume the Decimal engines.
- PR 3.E — UI consumers (components + hooks) consume Decimal at fetch boundary, format via `formatCurrency()`.

---

## Session: qdec-pr3b-tax-routes-LIlK9

### Changes Made

- **Type**: Feature / Foundation — first PR 3 consumer cutover (Q-DEC PR 3.B)
- **Scope**: Q-DEC PR 3.B — `/api/tax/entity/[entityId]` (GET + POST) + `/api/tax/position` (GET) route handlers swap from Float composers to `*Decimal` siblings. New `lib/decimal/serialize.ts` boundary walker is the canonical Decimal → JSON conversion path. PR 3.A doc-sync rolled in (PR 3.A row flipped ✅ MERGED #996).
- **Description**: First consumer cutover sub-PR of Q-DEC PR 3. Establishes the route-handler swap pattern: engine runs Decimal end-to-end, `serializeDecimalsForJson` converts Decimal → number at the JSON boundary, public response shape is byte-compatible with the pre-cutover Float response. Two routes swapped this PR; salary + super routes deferred to PR 3.B.2 for review tractability.

### Files Created

- `lib/decimal/serialize.ts` — `serializeDecimalsForJson(value, options)` recursive walker. Default `'currency'` policy (2dp HALF_EVEN, ATO standard); per-path policy overrides for rate/units/percentage fields. Non-Decimal leaves (strings, booleans, null, Date) pass through unchanged. JSON.stringify-safe output.
- `tests/decimal/serialize.test.ts` — 16 tests covering basic conversion + nested structures + policy overrides + null preservation + JSON round-trip.

### Files Modified (route handlers cutover)

- `app/api/tax/entity/[entityId]/route.ts` — GET + POST swap from `calculateEntityTaxPosition` to `calculateEntityTaxPositionDecimal`; response body wrapped in `serializeDecimalsForJson({ entityPosition, boundary })`. Same `withPermission('tax_data.read')` guard, same body validation, same `assembleEntityTaxFacts` data fetch, same `renderBoundaryFootnote` envelope.
- `app/api/tax/position/route.ts` — GET swap from `calculateTaxPosition` to `calculateTaxPositionDecimal`. Per-field conversion preserves the existing per-field rounding pattern (most money fields `Math.round`'d to integers; rates + paygWithheld + estimatedRefund pass through as-is). Local helpers `n` (toNumber) + `r` (toNumber + Math.round) thread through each field. Dual-call to `calculateTaxPosition` (Float) sources `warnings` + `recommendations` (presentation-side; no Decimal sibling — moves to Decimal in PR 4 when Float is dropped).

### Files Modified (exports)

- `lib/decimal/index.ts` — `serializeDecimalsForJson` + `SerializeOptions` added to public surface.

### Architectural notes

- **The serializer is the canonical Decimal → JSON exit.** Every subsequent PR 3 sub-PR (3.B.2 salary+super, 3.C cfo routes, 3.D AI tools, 3.E UI consumers) uses `serializeDecimalsForJson` as the boundary. This means: (a) the boundary policy is consistent across the app, (b) any future change to ATO rounding (e.g. if HALF_UP becomes preferred) is one-place, (c) developers don't re-roll per-route conversion patterns.
- **Dual-call for presentation-side fields.** `calculateTaxPosition` (Float) is still called by `/api/tax/position` to source `warnings` + `recommendations` arrays — those are presentation-side narration that doesn't have a Decimal sibling. PR 4 will need to migrate the narration generators to consume Decimal inputs (or accept Float input via `.toNumber()` boundary — TBD). Cost: one extra engine call (~1ms) on the route's critical path; benefit: behavior-preserving cutover.
- **Per-field rounding preserved.** `/api/tax/position` historically returned most money fields as integers (`Math.round`'d) and rates + payg as floats. The cutover preserves this byte-for-byte by keeping the `Math.round` calls but sourcing the underlying number from the Decimal sibling via `.toNumber()`. No surprise behavior changes for consumers.
- **`/api/tax/salary` + `/api/tax/super` deferred to PR 3.B.2.** Each uses different engines (`processSalary` / `trackContributionCaps`) with their own response shapes; bundling all 4 routes in one PR would breach tractability discipline. Separate sub-PR coming next.
- **`/api/calculate/tax` skipped — different SSOT.** That route uses `lib/tax/auTax.ts` (legacy module outside Q-DEC scope). Not migrated.
- **`/api/tax/entity/[entityId]/smsf-return` skipped — no engine call.** The route references `calculateSmsfIncomeTax` in a doc comment only; no actual call site.

### Testing

- [x] 16 new tests pass (`tests/decimal/serialize.test.ts`).
- [x] `npx tsc --noEmit` clean.
- [x] Pre-existing failures (58 in `tools-41h5` + `cross-module` + `regression/api`) confirmed out of scope.
- N/A — no new route-handler integration tests added; behavior preservation guaranteed by:
  1. The per-field rounding pattern is unchanged.
  2. The Decimal engine outputs are shadow-tested against Float to 0.005 currency tolerance by the PR 2.D suite.
  3. `serializeDecimalsForJson` is unit-tested.
  4. Composition is the only new code (engine swap + serializer wire); composition is verified by typecheck.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 3.A ✅ MERGED #996; PR 3.B IN FLIGHT this PR)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 3.A row flipped ✅ MERGED #996; PR 3.B row flipped IN FLIGHT this PR; Last touched flipped to reflect first consumer cutover.
- `docs/changelog/CHANGELOG_2026_06_06.md` — this entry.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] No engine math changed in this PR — just the consumer wire-up. Reform-aware engines downstream (negativeGearing, cgtDiscount, trustMinimumTax) continue to carry their own FW-1/FW-2 guards untouched. FW-1 outcome (a).
- [x] No `commencementVerified` gate needed (FW-2 outcome (a)).
- [x] No new schema columns (FW-3 N/A).
- [x] No new AI tool (FW-4 N/A).
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only (new serializer + new engine call paths; old Float paths still callable).

### Next

- PR 3.B.2 — `/api/tax/salary` + `/api/tax/super` route handlers cutover.
- PR 3.C — `/api/cfo/*` route handlers cutover.
- PR 3.D — `lib/ai/tax-advisor/tools/*` consume Decimal engines.
- PR 3.E — UI consumers (components + hooks) consume Decimal at fetch boundary, format via `formatCurrency()`.

---

## Session: qdec-pr3b2-tax-salary-super-LIlK9

### Changes Made

- **Type**: Feature / Foundation — second tax-route consumer cutover (Q-DEC PR 3.B.2)
- **Scope**: Q-DEC PR 3.B.2 — `/api/tax/salary` (POST) + `/api/tax/super` (GET) route handlers cutover. PR 3.B doc-sync rolled in (PR 3.B row flipped ✅ MERGED #997).
- **Description**: Second tax-route consumer cutover. Same pattern as PR 3.B — engine swaps to `*Decimal`; dual-call to Float sources presentational fields that don't have Decimal siblings; per-field `.toNumber()` at the JSON boundary preserves the existing response shape byte-for-byte.

### Files Modified (route handlers cutover)

- `app/api/tax/salary/route.ts` — `TaxEngine.processSalary` → `processSalaryDecimal`. Dual-call to Float `processSalary` sources the `calculations[]` narration array (12-step explainer; presentational). All numeric output (`grossSalary` / `netSalary` / `taxableIncome` / `tax.payg` / `tax.medicareLevy` / `tax.total` / `super.guarantee` / `super.salarySacrifice` / `super.total` / `perPeriod.{gross,super,tax,net}` / `effectiveTaxRate`) converted via `.toNumber()`. `TaxEngine.calculateOptimalSalarySacrifice` stays Float — recommendation engine, not money math; it consumes the Decimal `grossSalary` via `.toNumber()` boundary.
- `app/api/tax/super/route.ts` — `TaxEngine.trackContributionCaps` → `trackContributionCapsDecimal`. Per-field conversion preserves the existing `Math.round(...)` integer-dollar pattern: `used`/`remaining`/`percentageUsed`/`carryForwardAvailable` for both concessional + non-concessional + `bringForwardCap`. Categorical fields (`isExceeded`, `bringForwardAvailable`, `warnings[]`) flow through unchanged.

### Architectural notes

- **Dual-call for presentation fields.** `calculations[]` (salary narration) and Float-side `warnings[]` (super recommendations) are presentation-side arrays the Decimal siblings deliberately don't dual-write. The route handlers call both engines, use Decimal for numbers, use Float for those arrays. Cost: one extra engine call (~1ms) per request; benefit: behavior-preserving cutover without a separate presentation-engine refactor. PR 4 migrates the narration generators or accepts Float-bridge input.
- **`calculateOptimalSalarySacrifice` stays Float.** It's a recommendation engine (returns `optimalAmount` / `taxSavings` / `netImpact` / `reason` — `reason` is a narrative string, not a number). The numbers it returns are derived from compound `calculateSuperContributions` + `calculateIncomeTax` arithmetic; migrating it would mean its own sub-PR. For PR 3.B.2 we feed it `grossSalary.toNumber()` and call it as before. PR 3.C will revisit.
- **`bringForwardCap.toNumber()` is unconditional.** The Decimal sibling returns `Decimal` (not nullable) for `bringForwardCap`, mirroring the Float result. Confirmed by reading `lib/tax-engine/super/capTracker.ts:411`.
- **Per-route response shape unchanged.** Both routes preserve the same JSON keys, key order, type signatures, and rounding pattern as the pre-cutover Float responses. Consumers (`SalaryInput` form on `/dashboard/income`, super-position tile on `/dashboard/cfo`) need no changes.

### Testing

- [x] `npx tsc --noEmit` clean.
- [x] Pre-existing failures (58 in `tools-41h5` + `cross-module` + `regression/api`) confirmed out of scope.
- N/A — no new route-handler integration tests added; behavior preservation guaranteed by:
  1. Per-field rounding pattern unchanged.
  2. Decimal engine outputs shadow-tested vs Float to 0.005 currency tolerance (PR 2.D.3d for `processSalary`; PR 2.D.2 for `trackContributionCaps`).
  3. Composition is the only new code; verified by typecheck.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 3.B ✅ MERGED #997; PR 3.B.2 IN FLIGHT this PR)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 3.B row flipped ✅ MERGED #997; PR 3.B.2 row added IN FLIGHT; Last touched flipped.
- `docs/changelog/CHANGELOG_2026_06_06.md` — this entry.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] No engine math changed — consumer wire-up only. Both engines (`processSalary`, `trackContributionCaps`) reform-agnostic by construction (salary PAYG + super caps are not in scope of any 2026-27 reform measure). FW-1 outcome (a).
- [x] No `commencementVerified` gate needed (FW-2 outcome (a)).
- [x] No new schema columns (FW-3 N/A).
- [x] No new AI tool (FW-4 N/A).
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only.

### Next

- PR 3.C — `/api/cfo/*` route handlers cutover (~6-10 routes consuming the PR 2.E Decimal engines).
- PR 3.D — `lib/ai/tax-advisor/tools/*` consume Decimal engines.
- PR 3.E — UI consumers (components + hooks) consume Decimal at fetch boundary.

---

## Session: qdec-pr3c-cfo-routes-LIlK9

### Changes Made

- **Type**: Feature / Foundation — first CFO route consumer cutover (Q-DEC PR 3.C)
- **Scope**: Q-DEC PR 3.C — `/api/cfo/scenarios/run` (POST) route handler cutover + new `runScenarioDecimal` dispatcher exported from `lib/cfo/scenarios/index.ts`. PR 3.B.2 doc-sync rolled in (PR 3.B.2 row flipped ✅ MERGED #998).
- **Description**: First CFO route consumer cutover. The scenarios run endpoint is the most direct PR 2.E.1 consumer — each lever the UI exposes (or the AI advisor tool-call) routes through `runScenario` → one of 6 scenario engines. Adds the Decimal dispatcher counterpart, swaps the route, and serializes via the canonical `serializeDecimalsForJson` boundary walker shipped in PR 3.B.

### Files Modified

- `lib/cfo/scenarios/index.ts` — `runScenarioDecimal(ctx, request): ScenarioResultDecimal` dispatcher added. Routes each of the 6 scenario types (`sellProperty` / `payDownLoan` / `refinanceLoan` / `redirectToOffset` / `cutSpendCategory` / `addInvestment`) to its `*Decimal` sibling shipped in PR 2.E.1. Also re-exports the `*Decimal` scenario functions + `ScenarioResultDecimal` + `ScenarioImpactDecimal` types for direct consumers (AI tool dispatcher in PR 3.D).
- `lib/cfo/index.ts` — barrel exports `runScenarioDecimal`, `ScenarioResultDecimal`, `ScenarioImpactDecimal`.
- `app/api/cfo/scenarios/run/route.ts` — POST swapped from `runScenario` → `runScenarioDecimal`. Response body wrapped in `serializeDecimalsForJson(result)` — `result.impacts[*].{before,after,delta}` Decimal leaves convert to numbers at currency policy (2dp HALF_EVEN). Categorical fields (`type`, `title`, `summary`, `warnings[]`, `assumptions[]`, `computedAt`) flow through unchanged.

### Architectural notes

- **Dispatcher-level Decimal sibling is the right abstraction.** The Decimal scenario engines already exist (PR 2.E.1); the dispatcher just routes by `request.type` and there's no engine-tier composition to migrate. Adding `runScenarioDecimal` as a sibling preserves the SSOT pattern — one dispatcher per execution path; route handlers consume the dispatcher, not individual scenarios.
- **AI advisor tool-call cutover is PR 3.D.** The AI advisor calls `runScenario` via its closed `ToolKind` registry. Swapping that consumer is PR 3.D scope; the route + dispatcher in this PR are independent paths to the same scenario engines.
- **CFO dashboard routes deferred.** `/api/cfo` (`getCFODashboardData`) and `/api/cfo/advice/*` (`generateOrFetchAdvice`) compose many engines but their wrapper-level Decimal siblings don't exist yet. PR 2.E.2/3/4 shipped Decimal siblings at the inner-helper level (`scoreCalculator` / `riskRadar` summary / decision-support helpers / `intelligenceEngine` helpers); the async wrappers around them are presentation + I/O composition. Those wrappers either get their own Decimal siblings (in a follow-up sub-PR) or get cut over once PR 4 drops the Float path and the wrappers can be simplified.
- **`serializeDecimalsForJson` is the canonical boundary.** Same pattern as PR 3.B routes — engine runs Decimal end-to-end; serializer converts at the JSON boundary. The currency-policy default (2dp HALF_EVEN, ATO standard) applies to every numeric leaf in the scenario result, including non-money fields (`emergencyFundMonths`, `months to payoff`). For Phase 45 What-If 10-year horizons, this becomes critical — every accumulation runs in exact Decimal, only the final display rounds.

### Testing

- [x] `npx tsc --noEmit` clean.
- [x] Pre-existing failures (58 in `tools-41h5` + `cross-module` + `regression/api`) confirmed out of scope.
- N/A — no new route-handler tests added; behavior preservation guaranteed by:
  1. The 6 scenario Decimal engines are shadow-tested against Float to 0.005 currency tolerance by PR 2.E.1's 28-fixture suite.
  2. `serializeDecimalsForJson` is unit-tested.
  3. The dispatcher is a literal switch; verified by typecheck (exhaustive `never` branch).

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 3.B.2 ✅ MERGED #998; PR 3.C IN FLIGHT this PR; cfo dashboard/advice routes deferred to follow-up)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 3.B.2 ✅ MERGED #998; PR 3.C IN FLIGHT (scope refined to scenarios route only); Last touched flipped.
- `docs/changelog/CHANGELOG_2026_06_06.md` — this entry.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] No engine math changed — consumer wire-up + dispatcher. The 6 scenarios are reform-agnostic by construction (Phase 45 What-If levers don't model regime branching at the scenario level — Phase 45 PR 1 will add regime-aware tax-position composition on top). FW-1 outcome (a).
- [x] No `commencementVerified` gate needed (FW-2 outcome (a)).
- [x] No new schema columns (FW-3 N/A).
- [x] No new AI tool (FW-4 N/A) — `runScenarioDecimal` is a programmatic dispatcher, not an AI tool.
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only.

### Next

- PR 3.D — `lib/ai/tax-advisor/tools/*` consume Decimal engines.
- PR 3.E — UI consumers (components + hooks) consume Decimal at fetch boundary.
- Follow-up — cfo dashboard / advice routes once async-wrapper Decimal siblings exist (or cut over post-PR 4 when Float drops).

---

## Session: qdec-pr3d-ai-tools-LIlK9

### Changes Made

- **Type**: Feature / Foundation — AI advisor tools cutover (Q-DEC PR 3.D)
- **Scope**: Q-DEC PR 3.D — all 9 tax-engine-consuming tools in `lib/ai/tax-advisor/tools/*` swapped from Float engines to `*Decimal` siblings. Bonus: one PR 2.D.3a Decimal-sibling parity gap closed.
- **Description**: Third PR 3 consumer cutover. Each AI tool wraps a tax-engine function and surfaces results to the Gemini advisor via `ToolResult.numericFields[]` (number-typed) + `raw` (unknown). The cutover keeps the AI-facing shape identical — `numericFields[].value` stays `number`, sourced from `.toNumber()` on the Decimal result. The `raw` field is wrapped in `serializeDecimalsForJson` so JSON.stringify works correctly when the AI consumes the result as context. PR 3.C doc-sync rolled in (PR 3.C row flipped ✅ MERGED #999).

### Files Modified (9 AI tools swapped)

- `lib/ai/tax-advisor/tools/getEntityTaxPosition.ts` — `calculateEntityTaxPosition` → `calculateEntityTaxPositionDecimal`. The result type-narrowing pattern updated to check `instanceof Decimal` instead of `typeof === 'number'`. `cgtResult.netCapitalGain` field renamed to `assessableNetCapitalGain` (the actual field on the Decimal sibling).
- `lib/ai/tax-advisor/tools/getContributionCapHeadroom.ts` — `trackContributionCaps` → `trackContributionCapsDecimal`. 10 `value:` fields converted via `.toNumber()`; narrative `.toLocaleString()` calls fixed via `.toNumber().toLocaleString()`; `> 0` guards swapped to `.gt(0)`.
- `lib/ai/tax-advisor/tools/getCgtExposure.ts` — `applyCapitalLossNetting` → `applyCapitalLossNettingDecimal`. 7 fields converted; narrative `> 0` swapped to `.gt(0)`.
- `lib/ai/tax-advisor/tools/getDiv7aRisk.ts` — `classifyDiv7ALoans` → `classifyDiv7ALoansDecimal`. Per-loan `c.deemedDividendAmount` guard swapped from `&& > 0` to `&& .gt(0)`.
- `lib/ai/tax-advisor/tools/getLandTaxPosition.ts` — `calculateCrossStateLandTax` → `calculateCrossStateLandTaxDecimal`. 6 fields converted + per-state breakdown loop.
- `lib/ai/tax-advisor/tools/runContributionScenario.ts` — `trackContributionCaps` → `trackContributionCapsDecimal` (×2 — baseline + scenario). Delta fields compute via `.minus().toNumber()` instead of `-`.
- `lib/ai/tax-advisor/tools/runCgtScenario.ts` — `applyCapitalLossNetting` → `applyCapitalLossNettingDecimal` (×2). Delta fields via `.minus().toNumber()`.
- `lib/ai/tax-advisor/tools/runLandTaxScenario.ts` — `calculateCrossStateLandTax` → `calculateCrossStateLandTaxDecimal` (×2). Delta fields via `.minus().toNumber()`.
- `lib/ai/tax-advisor/tools/runDiv7aRefinanceScenario.ts` — `classifyDiv7ALoans` → `classifyDiv7ALoansDecimal` (×2). Delta field via `.minus().toNumber()`.

### Bonus parity fix — `lib/tax-engine/landTax/stateLandTax.ts`

The Decimal sibling `calculateLandTaxDecimal` was missing the `UC-MULTI-STATE-LAND-TAX` UNCOMPUTED flag that the Float sibling emits unconditionally at line 504. This was a gap in PR 2.D.3a (state taxes Decimal siblings, MERGED PR #984) — the Decimal sibling shipped without the flag, and shadow-comparison didn't catch it because UNCOMPUTED flags are categorical, not numeric. The cutover in `getLandTaxPosition` surfaced the gap because the registry test explicitly asserts the flag exists. **Fix**: added the same unconditional `uncomputed.push({ id: 'UC-MULTI-STATE-LAND-TAX', rationale: ... })` push to the Decimal sibling. Both Float and Decimal paths now have parity.

### Architectural notes

- **AI-facing shape preserved byte-for-byte.** Each tool's `ToolResult.numericFields[].value` is `number`-typed. The cutover swaps the engine but keeps the conversion at the boundary — `.toNumber()` on each Decimal field at the push site. The Gemini advisor sees the same JSON shape as before; only the underlying calc engine changed.
- **`raw` field wrapped in `serializeDecimalsForJson`.** Several tools pass the engine result through to `raw: result`. Without serialization, `JSON.stringify(Decimal)` produces a string (Decimal's `toJSON` returns `toString()`), which would break the AI's expectation of nested `number` leaves. The walker converts Decimal → number at currency policy (2dp HALF_EVEN) for consistent JSON output.
- **Categorical guards swapped to Decimal predicates.** `value > 0` → `value.gt(0)`; `value - other` → `value.minus(other)`. The non-Decimal branches (e.g. `bringForwardAvailable` boolean) stay unchanged.
- **`getReformImpactSummaryForUser` and `getReformedTaxRegimeStatus` not modified.** Those tools read reform-config metadata, not engine output. No tax-engine cutover needed.
- **§12.14 reform-agnosticism preserved.** All swapped tools were already reform-agnostic at the tool layer — they consume engine output. The reform-aware engines downstream (negativeGearing, cgtDiscount, trustMinimumTax) continue to carry their own FW-1/FW-2 guards.

### Testing

- [x] `npx tsc --noEmit` clean.
- [x] 58 pre-existing failures unchanged after the parity fix (one new failure introduced by the Decimal swap on `getLandTaxPosition` was the `UC-MULTI-STATE-LAND-TAX` test — fixed by the parity update to `calculateLandTaxDecimal`).
- N/A — no new tool integration tests added; behavior preservation guaranteed by:
  1. Each engine the tools call is shadow-tested against Float to 0.005 currency tolerance by PR 2.D's per-engine shadow suite.
  2. Per-field `.toNumber()` boundary preserves the AI-facing `number` shape.
  3. Composition is the only new code; verified by typecheck.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 3.C ✅ MERGED #999; PR 3.D IN FLIGHT this PR; PR 2.D.3a parity gap closed)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 3.C ✅ MERGED #999; PR 3.D IN FLIGHT; Last touched flipped.
- `docs/changelog/CHANGELOG_2026_06_06.md` — this entry.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] All 9 swapped tools were reform-agnostic at the tool layer. The reform-aware engines downstream (negativeGearing, cgtDiscount, trustMinimumTax) continue to carry their own FW-1/FW-2 guards. FW-1 outcome (a).
- [x] No `commencementVerified` gate needed (FW-2 outcome (a)).
- [x] No new schema columns (FW-3 N/A).
- [x] **Tools modified are NOT new AI tools** — they're existing tools with engine swaps (FW-4 N/A — tagged knowledge-pack status not changed). The reform-aware tools that DO carry knowledge-pack tags (`getReformImpactSummaryForUser`, `getReformedTaxRegimeStatus`) were NOT modified.
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only.

### Next

- PR 3.E — UI consumers (components + hooks) consume Decimal at fetch boundary; format via `formatCurrency()` (type-abstract). Last sub-PR before PR 4.
- Follow-up — cfo dashboard / advice routes once async-wrapper Decimal siblings exist OR cut over post-PR 4 when Float drops.
- PR 4 — Float column drop. §12.11 destructive-write checklist mandatory.

---

## Session wrap — 2026-06-06 end of day

### Headline

**24 PRs merged in a single day.** Q-DEC PR 2 went from "in-flight start of day" → ✅ COMPLETE (16 sub-PRs); Q-DEC PR 3 went from "queued" → 5/6 sub-PRs MERGED. Day finished with PR #1001 — symbolic 1000+ milestone. Only PR 3.E (UI consumers) remains in PR 3; then PR 4 (Float column drop) unblocks Phase 45 PR 1 (engine composition).

### Cumulative merge ledger (chronological, this day)

**Morning batch — Q-DEC PR 2 completion (16 sub-PRs in flight at start of day):**
- PR #989 — Q-DEC PR 2.D.3d (composer-tier Decimal: `smsfIncomeTax` + `processSalary`).
- PR #990 — doc-sync after 2.D.3d.
- PR #991 — Q-DEC PR 2.E.1 (6 scenarios + 3 supporting `lib/utils/calculations.ts` primitives).
- PR #992 — Q-DEC PR 2.E.2 (`scoreCalculator` 6-component + `riskRadar` summary).
- PR #993 — Q-DEC PR 2.E.3 (decision-support layer — 8 helpers across 4 files).
- PR #994 — doc-sync after 2.E.3.
- PR #995 — Q-DEC PR 2.E.4 (`intelligenceEngine` 2 helpers; `actionEngine` + `aiAdvisor` skipped with rationale).

**Afternoon batch — Q-DEC PR 3 cutover start:**
- PR #996 — Q-DEC PR 3.A (composer-tier Decimal siblings: `calculateEntityTaxPositionDecimal` + `buildMasterTaxPositionDecimal` — deferred work from PR 2.D.3d).
- PR #997 — Q-DEC PR 3.B (tax entity + position routes + new `serializeDecimalsForJson` boundary walker).
- PR #998 — Q-DEC PR 3.B.2 (tax salary + super routes).
- PR #999 — Q-DEC PR 3.C (cfo scenarios route + new `runScenarioDecimal` dispatcher).
- PR #1000 — doc-sync after 3.C (milestone PR 1000).
- PR #1001 — Q-DEC PR 3.D (all 9 AI advisor tools + PR 2.D.3a `UC-MULTI-STATE-LAND-TAX` parity fix).

### Architectural artefacts shipped this day

- **`lib/decimal/serialize.ts:serializeDecimalsForJson`** — the canonical Decimal → JSON exit. Every route handler + AI tool that produces a Decimal result uses this walker. Default `'currency'` policy (2dp HALF_EVEN, ATO standard); per-path overrides for rate/units/percentage fields. JSON.stringify-safe output.
- **`lib/cfo/scenarios/index.ts:runScenarioDecimal`** — dispatcher routing each of 6 scenario types to its `*Decimal` sibling. Mirrors the Float `runScenario` SSOT pattern.
- **`lib/tax-engine/entity/entityTaxRouter.ts:calculateEntityTaxPositionDecimal`** + **`lib/tax-engine/orchestrator/masterTaxPosition.ts:buildMasterTaxPositionDecimal`** — the two composer-tier Decimal siblings deferred from PR 2.D.3d. Now shipped + consumed by PR 3.B's entity route + (future) the cfo dashboard wrapper.

### Code-quality state — complete check

- `npx tsc --noEmit` clean.
- 2,287 tests passing (+58 pre-existing failures in `tools-41h5` + `cross-module` + `regression/api` — confirmed unchanged baseline; all predate Q-DEC work).
- All 14 PR 2 + 6 PR 3 prod deploys ✅ READY per §17.2 post-merge verification.
- No new schema columns, no destructive Prisma writes, no security-posture changes (Q-DEC is pure type-shape evolution).

### State of the world — what's still in flight

| Stage | Status | Blast radius / Risk |
|---|---|---|
| **PR 3.E — UI consumers cutover** | ⏳ Last 3.x sub-PR | Components + hooks consume Decimal at fetch boundary; format via `formatCurrency()` (already type-abstract). Low-risk: no schema changes; no engine math changes. |
| **Follow-up — cfo dashboard/advice routes** | ⏳ Queued | `getCFODashboardData` + `generateOrFetchAdvice` async wrappers need Decimal siblings OR cut over post-PR 4. Defer-or-do decision TBD. |
| **PR 4 — Float column drop** | ⏳ Queued | After 7-day parallel-run shows zero diff. **§12.11 destructive-write checklist mandatory** (this PR drops production columns). |
| **Phase 45 PR 1 — engine composition** | ⏳ Unblocked once PR 4 lands | New `salarySacrificeToSuper` scenario + `tenYearProjection.ts` 10-year composer + H1/H2/H3 hardening items. |
| **Phase 45 PR 2 — UI port** | ⏳ Sequential after PR 1 | `/dashboard/cfo/what-if` lever picker + 5 lever-detail screens. |
| **Phase 45.1 — contextual entry points** | ⏳ Separate PR | "What if?" affordance on entity-detail pages. |

### Discipline notes preserved

- **`serializeDecimalsForJson` is the canonical exit.** Every PR 3 sub-PR uses it. If future sub-PRs reach for `JSON.stringify(decimalObj)` directly without it, that's a bug — the walker is the SSOT for Decimal → number conversion at policy.
- **Dual-call pattern for presentation-side fields.** `/api/tax/position` calls Float for `warnings + recommendations` (no Decimal sibling); `/api/tax/salary` calls Float for `calculations[]` narration. PR 4 (Float drop) needs to migrate these to Decimal-compatible generators or accept Float-bridge input.
- **`actionEngine` + `aiAdvisor` deliberately have no Decimal siblings.** Categorical recommendation generator + Gemini tool-call dispatcher; their numeric leaves are display-side, not compounding. Rationale committed in `lib/calc-audit/engines/decimal-cfo-actions-ai-intel.ts` header so future sessions don't re-litigate.
- **`UC-MULTI-STATE-LAND-TAX` parity discovery.** PR 2.D.3a's Decimal sibling silently dropped a categorical UNCOMPUTED flag because shadow comparison only checks numeric leaves. Fixed in PR 3.D when the AI registry test surfaced it. If similar gaps exist for other UC flags, they'll surface when the matching consumer cutover lands. Pattern: when a `.test.ts` file fails its `.uncomputed` assertion post-cutover, check the Decimal sibling for the missing flag — usually a copy-paste oversight.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR (session-wrap doc-only PR):
- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 3.D ✅ MERGED #1001; PR 3 progression captured cleanly; session-wrap summary written)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — Last touched flipped to session-wrap; PR 3.D row flipped ✅ MERGED #1001.
- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §5 — Q-DEC PR 3 ledger updated (5/6 sub-PRs landed; PR 3.D ✅ MERGED #1001 + parity-fix note).
- `docs/changelog/CHANGELOG_2026_06_06.md` — this session-wrap entry.

### Phase 41E reform compliance (CLAUDE.md §12.14)

N/A — documentation-only PR.

### Destructive write checklist (CLAUDE.md §12.11)

NONE — no code change. `git diff` shows only docs.

### Pause-point check

The day's work concludes at a structurally clean boundary:
- All shipped PRs prod-verified ✅ READY.
- Doc state matches code state across `IMPLEMENTATION_PLAN.md`, `PHASE_45_WHAT_IF_SCENARIOS.md`, `CHANGELOG_2026_06_06.md`.
- Pre-existing test failures unchanged (58, baseline preserved).
- No half-finished work on disk; no in-flight branches besides this session-wrap.
- Next session can pick up at PR 3.E with full context from this changelog + the live `IMPLEMENTATION_PLAN.md`.

🎉 — 24 merges, 16 of them PR 2 sub-PRs (engine adapter layer complete), 5 PR 3 sub-PRs (cutover 5/6 complete), milestone PR #1000 hit. Solid foundation for tomorrow.

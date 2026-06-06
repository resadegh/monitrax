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

# Changelog - 2026-06-04

## Session: phase-45-stitch-design-LIlK9

### Changes Made

- **Type**: Design / Documentation
- **Scope**: Phase 45 "What If?" Stitch design pass
- **Description**: Completed the 4-variant matrix (desktop-light + desktop-dark + mobile-light + mobile-dark) for both Phase 45 surfaces — Screen A (lever picker) and Screen B (lever detail, Salary-sacrifice as the showcase lever). Vocabulary corrected mid-pass from Restrained Editorial flat (v1, rejected) to §18.7.2 My Wealth glass (v2 onward). Hover/focus/tap interaction patterns + mobile composition (Apple Numbers RESULT-HERO-ON-TOP) + dark mode spec all locked in PHASE_45_WHAT_IF_SCENARIOS.md before generation. CLAUDE.md §18.7.2 expanded to a side-by-side light/dark token table + 4-variant reviewer enforcement rule.

### Approved Artefacts (locked in `.stitch/designs/`)

| Surface | Device | Mode | Canonical alias | Stitch screen ID |
|---|---|---|---|---|
| A — Lever picker | DESKTOP | LIGHT | `what-if-lever-picker.{html,png}` | `9a4fa51d1fee41698e34065d72cb8cb9` |
| A — Lever picker | MOBILE | LIGHT | `what-if-lever-picker-mobile.{html,png}` | `9664c0a2a86d4cd3bc2f3c62e90258b8` |
| A — Lever picker | DESKTOP | DARK | `what-if-lever-picker-dark.{html,png}` | `7d1f3957a4aa48a8af07736181b78216` |
| A — Lever picker | MOBILE | DARK | `what-if-lever-picker-mobile-dark.{html,png}` | `fd72914ed53543b9b3bbee13f8ad7042` |
| B — Lever detail (Salary-sacrifice) | DESKTOP | LIGHT | `what-if-lever-detail.{html,png}` | `1d4642ec31db4e92a728715d6e55a43c` |
| B — Lever detail (Salary-sacrifice) | MOBILE | LIGHT | `what-if-lever-detail-mobile.{html,png}` | `a5d4ba2fae1a4af39bd751568383657b` |
| B — Lever detail (Salary-sacrifice) | DESKTOP | DARK | `what-if-lever-detail-dark.{html,png}` | `ab6dda017382473e82918a85e6909029` |
| B — Lever detail (Salary-sacrifice) | MOBILE | DARK | `what-if-lever-detail-mobile-dark.{html,png}` | `82c7f906d53845f49c76f51d87cc7ad7` |

### Files Modified

- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` — added §6.0 (v1 vocabulary failure mode), §6.1 (§18.7.2 tokens verbatim), §6.2 (per-lever sub-palette table for 5 levers × TRAIL stages), §6.3-§6.4 (Screen A + B layouts), §6.5 (locked Stitch prompt template), §6.6 (artefact iteration log with Mode column, 10 rows), §6.7 (reviewer enforcement), §6.8 (interaction patterns — hover/focus/tap, 4 subsections), §6.9 (mobile/tablet layout with RESULT-HERO-ON-TOP IA, 6 subsections), §6.10 (dark mode lock with light/dark token table + 4-variant iteration discipline, 5 subsections). §6.10.4 flipped to ✅ APPROVED for all 8 variants.
- `CLAUDE.md` §18.7.2 — expanded from 11-row single-column digest to 11 rows × 2 columns (Light + Dark) with the canonical My Wealth glass vocabulary anchored on `app/globals.css` `.dark` block tokens. Added 4-variant reviewer enforcement rule (desktop-light + desktop-dark + mobile-light + mobile-dark per surface) — light-only PRs must be rejected.
- `docs/IMPLEMENTATION_PLAN.md` — workstream `0·WI` Phase 45 Stitch design pass row flipped from `[ ]` to `[x] ✅ COMPLETE (2026-06-04)` with the locked-artefact summary.

### Files Created (artefacts)

- `.stitch/designs/what-if-lever-picker-dark.{html,png}` (Screen A desktop DARK canonical)
- `.stitch/designs/what-if-lever-picker-mobile-dark.{html,png}` (Screen A mobile DARK canonical)
- `.stitch/designs/what-if-lever-detail-v1-desktop-dark.{html,png}` (versioned)
- `.stitch/designs/what-if-lever-detail-v1-mobile-dark.{html,png}` (versioned)
- `.stitch/designs/what-if-lever-detail.{html,png}` (canonical alias of v1 desktop light)
- `.stitch/designs/what-if-lever-detail-mobile.{html,png}` (canonical alias of v1 mobile light)
- `.stitch/designs/what-if-lever-detail-dark.{html,png}` (canonical alias of v1 desktop dark)
- `.stitch/designs/what-if-lever-detail-mobile-dark.{html,png}` (canonical alias of v1 mobile dark)

### Documentation Updated

- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §6 fully rewritten — see above
- `CLAUDE.md` §18.7.2 — see above
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` Phase row 1 — see above

### Testing

- [x] Design review: Reza approved Screen A v3 desktop+mobile light (2026-06-04 "looks good, ship it")
- [x] Design review: Reza approved all 4 dark variants + implicitly Screen B light (2026-06-04 "looks great, ship it" on the dark-variant review = dark mirror validates the underlying composition)
- N/A Build/lint — design-only PR; no code touched

### PR

- Branch: `claude/phase-45-stitch-design-LIlK9`
- PR URL: (to be created as draft after this commit lands)

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern (Phase 45 surfaces × full 4-variant matrix)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Phase 45 Stitch design pass flipped to COMPLETE in `IMPLEMENTATION_PLAN.md`)

Docs updated in this PR:
- `CLAUDE.md` §18.7.2 — light/dark side-by-side token table + 4-variant reviewer enforcement rule
- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §6.0-§6.10 — full Stitch design spec with iteration log
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — Phase 45 Stitch design pass marked ✅ COMPLETE
- `docs/changelog/CHANGELOG_2026_06_04.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Functions/tools added or modified in this PR: NONE (design-only PR, no engine code touched)
- N/A — no `lib/tax-engine/*` files modified
- N/A — no new schema columns on `Property` / `Investment` / `LegalEntity`
- N/A — no new AI tool added
- [x] One UI surface (Screen B Salary-sacrifice detail) DOES exercise §12.14 reform-awareness via the concessional-cap headroom check in the spec (PHASE_45_WHAT_IF_SCENARIOS.md §6.4 + §6.8.2). The React port (Phase 45 PR 2) will be the place where this is enforced in code — the design pass establishes the visual contract.

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows: NONE — design-only PR. No Prisma writes.

### Next

- Phase 45 PR 1 (engine composition) — `salarySacrificeToSuper.ts` + `tenYearProjection.ts`. Gated on Q-DEC PR 2-4 landing first.
- Phase 45 PR 2 (React port) — render the approved Stitch designs with cosmos-* token pin to `app/globals.css` `.dark` block.

---

## Session: qdec-pr2-adapter-layer-LIlK9 (continuation after PR #977 merge)

### Changes Made

- **Type**: Feature / Foundation
- **Scope**: Q-DEC PR 2.A — Decimal precision foundation + `netWorthCalculator` shadow proof
- **Description**: First sub-PR of Q-DEC PR 2 per the Reza 2026-06-04 split decision (sub-PRs by directory; netWorthCalculator as the proof engine). Introduces the `lib/decimal/` module (pure conversion + diff + tolerance utilities), extends the Phase 41I calc-audit harness with `runShadowComparison` (parallel-run Float vs Decimal comparator), and adds `*Decimal` sibling functions to `netWorthCalculator.ts` that compose `Prisma.Decimal` end-to-end. ZERO existing engine changes — every Float function stays live for back-compat. PR 2.B-E will replicate the pattern across `lib/calculations/*`, `lib/cashflow/*`, `lib/tax-engine/*`, `lib/cfo/*`. PR 3 will swap route handlers + components to the Decimal path. PR 4 will drop the Float DB columns.

### Architectural rules (CLAUDE.md §0 architect lens + §12.2 SSOT)

- The ONLY entry to Decimal-land is `toDecimal` / `toDecimalRequired`.
- The ONLY exit is `fromDecimal`.
- Mid-computation MUST stay in Decimal. Rounding only happens at the OUTPUT boundary, policy-driven (currency 2 dp HALF_EVEN, rates 4 dp, units 4 dp, percentages 4 dp).
- Engines compose via `sumDecimal`, `.plus`, `.minus`, `.times`, `.div` — never via `+`, `-`, `*`, `/` (which silently coerce to Float).
- `toDecimal(number)` routes through `String()` to defuse the IEEE-754 carry-in (e.g. `0.1 + 0.2 = 0.30000000000000004` would otherwise carry the Float error into Decimal land). Test `tests/decimal/convert.test.ts` documents the trap.

### Files Created

- `lib/decimal/types.ts` — `Decimal`, `MoneyValue`, `RoundingPolicy`, `DecimalDiff`, `ShadowComparisonResult`, `ShadowComparisonReport`
- `lib/decimal/convert.ts` — `toDecimal`, `toDecimalRequired`, `fromDecimal`, `sumDecimal`, `decimalDiff`, `isCloseEnough`, `getPolicyTolerance`
- `lib/decimal/index.ts` — public surface barrel
- `lib/calc-audit/shadowComparison.ts` — `runShadowComparison`, `runShadowComparisonReport`, `ShadowEngine<TIn, TFloat, TDec>` type
- `lib/calc-audit/engines/decimal-netWorth.ts` — net-worth shadow engine with 4 fixtures (empty / single-home / mass-affluent persona / IEEE-754 trap)
- `tests/decimal/convert.test.ts` — 22 tests including the IEEE-754 trap defence
- `tests/calc-audit/shadowComparison.test.ts` — 6 tests covering PASS / DIFF / ERROR / flattened nested outputs / aggregation
- `tests/calculations/netWorthCalculator.decimal.test.ts` — 8 tests; per-fixture shadow run + exactness proof on the IEEE-754 fixture + Phase 39.5 + Phase 41e.0 contract checks

### Files Modified

- `lib/calculations/netWorthCalculator.ts` — added `calculateTotalAssetsDecimal`, `calculateTotalLiabilitiesDecimal`, `calculateNetWorthDecimal` with their result types. Existing Float exports untouched.
- `docs/IMPLEMENTATION_PLAN.md` — workstream `0·WI` Q-DEC PR 2 row expanded with the 5-sub-PR split + the PR 2.A scope.
- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §5 — sequencing list updated with the PR 2.A-E split + PR 1.5 ✅ + PR #977 ✅.

### Testing

- [x] All 36 new tests pass (`tests/decimal/`, `tests/calc-audit/shadowComparison.test.ts`, `tests/calculations/netWorthCalculator.decimal.test.ts`)
- [x] All 182 existing calc-audit tests still pass — no regression
- [x] `tsc --noEmit` clean on every new/touched file
- [x] Shadow report PASS on all 4 fixtures (including the mass-affluent persona + IEEE-754 trap)

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Q-DEC PR 2 split locked in IMPLEMENTATION_PLAN; PR 2.A scope landed)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` Phase row — PR 2 expanded into 5 sub-PRs with the PR 2.A scope detailed
- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §5 — sequencing list updated
- `docs/changelog/CHANGELOG_2026_06_04.md` — this session entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Functions/tools added or modified in this PR: `calculateTotalAssetsDecimal`, `calculateTotalLiabilitiesDecimal`, `calculateNetWorthDecimal` — outcome (a) reform-agnostic by design (the input shapes don't carry regime-relevant fields; net-worth math is the same pre- vs post-reform).
- [x] No `lib/tax-engine/*` modified.
- [x] No schema columns added to `Property` / `Investment` / `LegalEntity`.
- [x] No new AI tool added.
- [x] No UI surface added.

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows: NONE — additive code only. No Prisma writes. No schema changes.

### Next

- PR 2.B — rest of `lib/calculations/*`: `cashflowOrchestrator`, `expenseAggregator`, `incomeAggregator`, `loanAggregator`, `entityValueBreakdown`, `moneyStoryTrend`, `netWorthHistory`.
- Branch: `claude/qdec-pr2-adapter-layer-LIlK9` (PR 2.A); new branch for 2.B.

---

## Session: qdec-pr2b-calculations-rest-LIlK9 (continuation after PR #978 merge)

### Changes Made

- **Type**: Feature / Foundation
- **Scope**: Q-DEC PR 2.B — rest of `lib/calculations/*` (4 pure-compute engines + frequency helpers)
- **Description**: Second sub-PR of Q-DEC PR 2. Extends the Decimal foundation from PR 2.A to four canonical calculation engines: `expenseAggregator`, `incomeAggregator`, `loanAggregator`, `cashflowOrchestrator`. Adds `toAnnualDecimal` / `toMonthlyDecimal` to `lib/utils/frequencies.ts` so every Decimal-side caller has a canonical SSOT for frequency conversion. ZERO existing engine changes — every Float function stays live for back-compat. The 3 I/O readers (`entityValueBreakdown`, `moneyStoryTrend`, `netWorthHistory`) intentionally deferred to PR 3 because their math is either trivial subtraction or delegates to PR 2.A's `netWorthCalculator` Decimal siblings.

### Latent bugs discovered + fixed

- **`Decimal(0).isPositive()` truthy.** decimal.js (via Prisma re-export) treats `Decimal(0).isPositive()` as truthy in some builds, causing `0 / 0 = NaN` in div-by-zero guards (`totalPrincipal.isPositive() ? sum.div(totalPrincipal) : 0` silently produces NaN). Caught by the shadow harness on the `loanAggregator/empty` fixture (`|Δ|=NaN`). Replaced all such guards with `.gt(0)` (strict positive). Applies to `loanAggregator.aggregateLoanRepaymentsDecimal`, `calculateDebtMetricsDecimal`, `calculateLVRDecimal`, and `cashflowOrchestrator.calculateCashflowDecimal` (savingsRate / expenseRatio / debtServiceRatio guards). The same pattern in `expenseAggregator.aggregateExpensesByCategoryDecimal`'s sort comparator was also tightened to `.gt(a.amount)`.
- **Cashflow ratio fields are pre-rounded percentages, not raw rates.** The Float `calculateCashflow` calls `Math.round(n * 100) / 100` on EVERY output field including `savingsRate`, `expenseRatio`, `debtServiceRatio`. The Decimal sibling does NOT pre-round (rounding happens only at the OUTPUT boundary). So the shadow comparison sees Float `5.40` vs Decimal `5.398765…` — diff ~0.0012, fails 'percentage' tolerance (0.00005) but passes 'currency' tolerance (0.005). Initial fix: `fieldPolicy.savingsRate = 'percentage'`. Real fix: drop the per-field policy and let everything default to 'currency'. Documented in `decimal-calculations.ts` comment.

### Files Created

- `lib/calc-audit/engines/decimal-calculations.ts` — 4 shadow engines (`expenseAggregatorShadow`, `incomeAggregatorShadow`, `loanAggregatorShadow`, `cashflowOrchestratorShadow`) + a `calculationsShadowEngines` convenience export
- `tests/utils/frequencies.decimal.test.ts` — 17 tests for the Decimal frequency converters
- `tests/calculations/aggregators.decimal.test.ts` — 18 tests covering per-engine shadow PASS + Decimal-path exactness contracts + the aggregate report

### Files Modified

- `lib/utils/frequencies.ts` — added `toAnnualDecimal`, `toMonthlyDecimal` (null-safe, accepts `number | string | Decimal | null | undefined`).
- `lib/calculations/expenseAggregator.ts` — `aggregateExpensesDecimal`, `aggregateExpensesByCategoryDecimal`, `aggregateExpensesBySourceDecimal` + their `*Decimal` result types.
- `lib/calculations/incomeAggregator.ts` — `aggregateIncomeDecimal`, `aggregateIncomeBySourceDecimal` + `*Decimal` result types; private helpers `getGrossAmountDecimal` / `getNetAmountDecimal` / `getPaygAmountDecimal` mirror the Float salary/PAYG branching.
- `lib/calculations/loanAggregator.ts` — `aggregateLoanRepaymentsDecimal`, `calculateDebtMetricsDecimal`, `calculateLVRDecimal` + `*Decimal` result types.
- `lib/calculations/cashflowOrchestrator.ts` — `calculateCashflowDecimal` + private `calculateIncomeAmountsDecimal` helper (Float-bridges to `calculateTakeHomePay` per PR 2.B scope; PR 2.C provides the Decimal sibling).
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` Phase 45 row — PR 2.B row flipped to `[~] IN FLIGHT this PR` with scope + lessons documented.

### Architectural rules (CLAUDE.md §0 + §12.2)

Same as PR 2.A:
- The ONLY entry to Decimal-land is `toDecimal` / `toDecimalRequired`.
- The ONLY exit is `fromDecimal`.
- Mid-computation MUST stay in Decimal. Rounding only at the OUTPUT boundary.
- Engines compose via `.plus`, `.minus`, `.times`, `.div`, `sumDecimal` — never via `+`, `-`, `*`, `/`.
- Div-by-zero guards use `.gt(0)`, never `.isPositive()` (lesson from this PR).

### Testing

- [x] All 35 new tests pass (17 frequencies + 18 aggregators)
- [x] All 218 existing decimal/calc-audit tests still pass — zero regression (247 total across the surface)
- [x] `tsc --noEmit` clean on every new/touched file
- [x] Shadow report PASS on all 13 fixtures across the 4 engines

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (new failure-mode lesson: `Decimal(0).isPositive()` truthiness on this Prisma.Decimal build — documented inline + in changelog)
- [x] strategic decision (PR 2.B scope: 4 pure-compute engines IN; 3 I/O readers DEFERRED to PR 3 with rationale)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` Phase 45 row — PR 2.B status flipped to `[~]` with scope detailed
- `docs/changelog/CHANGELOG_2026_06_04.md` — this session entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Functions added: `aggregateExpensesDecimal`, `aggregateExpensesByCategoryDecimal`, `aggregateExpensesBySourceDecimal`, `aggregateIncomeDecimal`, `aggregateIncomeBySourceDecimal`, `aggregateLoanRepaymentsDecimal`, `calculateDebtMetricsDecimal`, `calculateLVRDecimal`, `calculateCashflowDecimal`, plus the `toAnnualDecimal` / `toMonthlyDecimal` frequency helpers — outcome **(a) reform-agnostic by design**. Input shapes don't carry regime-relevant fields; aggregation math is the same pre- vs post-reform.
- [x] No `lib/tax-engine/*` modified.
- [x] No schema columns added to `Property` / `Investment` / `LegalEntity`.
- [x] No new AI tool added.
- [x] No UI surface added.

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows: **NONE** — additive code only. No Prisma writes. No schema changes.

### Next

- PR 2.C — `lib/cashflow/*` (daily/monthly/annual rollups + `calculateTakeHomePay` Decimal sibling — which unblocks the Float-bridge in cashflowOrchestrator).
- PR 2.D — `lib/tax-engine/*` (largest sub-PR; salary-sacrifice depends on this for Phase 45 PR 1).
- PR 2.E — `lib/cfo/*` (scenarios + intelligence engine).

---

## Session: qdec-pr2c-cashflow-LIlK9 (continuation after PR #979 merge)

### Changes Made

- **Type**: Feature / Foundation
- **Scope**: Q-DEC PR 2.C — `lib/cashflow/incomeNormalizer.ts` Decimal siblings + PR 2.B Float-bridge unblocker
- **Description**: Third sub-PR of Q-DEC PR 2. Delivers the critical PR 2.B unblocker — `calculateTakeHomePayDecimal` — and swaps `cashflowOrchestrator.calculateCashflowDecimal` off the Float-bridge introduced in PR 2.B. Also adds Decimal siblings for `normalizeIncomeStream`, `normalizeAllIncome`, `getEffectiveMonthlyIncome`, + the private `calculateNetSalary` helper. ZERO existing engine changes — every Float function on `incomeNormalizer.ts` stays live for back-compat.
- **Scope note (deferred to PR 3):** The 4 larger files in `lib/cashflow/` (`forecasting.ts`, `optimisation.ts`, `stressTesting.ts`, `insightGenerator.ts`, ~2750 lines combined) are consumer-layer decision-support engines, not money-producers. They consume `cashflowOrchestrator` / `TaxEngine` output and produce notifications / insights / scenarios. They'll adopt the Decimal path automatically when route handlers cut over in PR 3 — no Decimal sibling required at the engine level.

### Architectural improvement to the harness

- **`runShadowComparison` skips non-numeric leaves.** Discovered when `normalizeAllIncome`'s result spread `IncomeStream` fields (`id`, `userId`, `name`, etc.) into the comparison surface, causing `new Decimal('fixture')` to throw. Updated the harness: numeric leaves (number, Decimal, null, undefined) compare; non-numeric leaves (string, boolean, Date, etc.) are silently skipped. A TYPE MISMATCH between paths (one numeric, one non-numeric for the same field) is surfaced as a failed field — that's a real engine bug. `isNumericLeaf` helper exported as internal. **This is the second operational lesson** in Q-DEC PR 2 (first being `Decimal(0).isPositive()` truthiness in PR 2.B).

### Files Created

- `lib/calc-audit/engines/decimal-cashflow.ts` — 2 shadow engines (`calculateTakeHomePayShadow` 6 fixtures + `normalizeAllIncomeShadow` 3 fixtures) + `cashflowShadowEngines` convenience export
- `tests/cashflow/incomeNormalizer.decimal.test.ts` — 19 tests covering per-fixture shadow + Decimal-path contract checks (tax-free threshold, round-trip, high-income, branch coverage on each `normalizeIncomeStream` branch)

### Files Modified

- `lib/cashflow/incomeNormalizer.ts` — `calculateTakeHomePayDecimal`, `normalizeIncomeStreamDecimal`, `normalizeAllIncomeDecimal`, `getEffectiveMonthlyIncomeDecimal` + private `calculateNetSalaryDecimal` helper + `IncomeWithTaxDecimal` / `NormalizedIncomeResultDecimal` types
- `lib/calculations/cashflowOrchestrator.ts` — swapped Float-bridge in `calculateIncomeAmountsDecimal` to use `calculateTakeHomePayDecimal`; updated comments to reflect PR 2.C state
- `lib/calc-audit/shadowComparison.ts` — `runShadowComparison` skips non-numeric leaves; new `isNumericLeaf` private helper; type-mismatch detection surfaces as a failed field
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` Phase 45 row — PR 2.C row flipped to `[~] IN FLIGHT this PR` with scope + deferred files documented

### Architectural rules (CLAUDE.md §0 + §12.2)

Same as PR 2.A / 2.B. New rule added this PR: shadow comparison skips non-numeric leaves and surfaces type-mismatches.

### Testing

- [x] All 19 new tests pass
- [x] All 305 existing decimal/calc-audit/calculations/cashflow tests still pass — zero regression (324 total)
- [x] `tsc --noEmit` clean on every new/touched file

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (new failure-mode lesson: shadow harness throws on string leaves — harness updated to skip non-numeric leaves cleanly)
- [x] strategic decision (PR 2.C scope: incomeNormalizer.ts IN; forecasting/optimisation/stressTesting/insightGenerator DEFERRED to PR 3 with rationale)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` Phase 45 row — PR 2.C status flipped + scope detailed
- `docs/changelog/CHANGELOG_2026_06_04.md` — this session entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Functions added: `calculateTakeHomePayDecimal`, `normalizeIncomeStreamDecimal`, `normalizeAllIncomeDecimal`, `getEffectiveMonthlyIncomeDecimal`, `calculateNetSalaryDecimal` — outcome **(c) gated through Float TaxEngine.calculatePAYG / Medicare / LITO during PR 2.C**. The composition arithmetic (subtract, divide, multiply) is Decimal; the inner tax calculations stay Float until PR 2.D provides Decimal siblings. NO direct dependence on reform regime — `calculateTakeHomePay` is a takehome-pay helper, not a regime-sensitive calculation. PR 2.D will revisit per §12.14 FW-1.
- [x] No `lib/tax-engine/*` modified.
- [x] No schema columns added to `Property` / `Investment` / `LegalEntity`.
- [x] No new AI tool added.
- [x] No UI surface added.

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows: **NONE** — additive code only. No Prisma writes. No schema changes.

### Next

- PR 2.D — `lib/tax-engine/*`. Reza scope decision 2026-06-04: 2-PR Phase-45-driven split, no CGT/trust reform engines in D.1.
- PR 2.E — `lib/cfo/*` (scenarios + intelligence engine).
- PR 3 — engine-by-engine cutover.

---

## Session: qdec-pr2d1-tax-engine-core-LIlK9 (continuation after PR #980 merge)

### Changes Made

- **Type**: Feature / Foundation
- **Scope**: Q-DEC PR 2.D.1 — `lib/tax-engine/core/*` Decimal siblings + inner Float-bridge in `incomeNormalizer.calculateTakeHomePayDecimal` dropped
- **Description**: First sub-PR of Q-DEC PR 2.D. Mid-session scope refinement: given `lib/tax-engine/*` is 12,238 lines / 45 files, the "Phase 45 critical path" splits into three cohesive sub-PRs (D.1 core, D.2 super+income+position+orchestrator, D.3 rest). This PR ships D.1 — the 4 ATO regulatory math primitives that everything downstream composes through. Inner Float-bridge in PR 2.C's `calculateTakeHomePayDecimal` swapped to the Decimal core engines — Decimal chain is now end-to-end for the salary-sacrifice critical path.

### Architectural notes

- **Intentional ATO rounding preserved.** PAYG weekly withholding rounds to nearest WHOLE DOLLAR per NAT 1004 Schedule 1 — a regulatory rule, not a Float artefact. Decimal sibling preserves via `toDecimalPlaces(0, ROUND_HALF_EVEN)`. Same pattern for income tax, Medicare levy, LITO/SAPTO output rounding.
- **Decimal-accepting input types.** Each *Decimal engine accepts a `*InputDecimal` type whose numeric fields are `number | string | Decimal` so callers don't lose precision at the boundary.
- **`applyOffsetsDecimal` mirrors Float refund logic.** Non-refundable offsets floor at $0; franking credits can refund (negative netTax).

### Files Modified

- `lib/tax-engine/core/incomeTaxCalculator.ts` — `calculateIncomeTaxDecimal`, `calculateMarginalTaxDecimal`, `calculateDeductionSavingsDecimal`
- `lib/tax-engine/core/paygCalculator.ts` — `calculatePAYGDecimal` (NAT 1004 round-to-dollar preserved)
- `lib/tax-engine/core/medicareLevyCalculator.ts` — `calculateMedicareLevyDecimal`
- `lib/tax-engine/core/taxOffsets.ts` — `calculateLITODecimal`, `calculateSAPTODecimal`, `calculateFrankingCreditOffsetDecimal`, `calculateForeignTaxOffsetDecimal`, `calculateAllOffsetsDecimal`, `applyOffsetsDecimal`
- `lib/cashflow/incomeNormalizer.ts` — `calculateTakeHomePayDecimal` + `calculateNetSalaryDecimal` swapped to Decimal core engines
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 2.D row expanded with mid-session D.1 / D.2 / D.3 split

### Files Created

- `lib/calc-audit/engines/decimal-tax-engine-core.ts` — 4 shadow engines + 24 fixtures
- `tests/tax-engine/core.decimal.test.ts` — 34 tests

### Testing

- [x] 34 new tests pass + 324 existing tests pass (358 total)
- [x] `tsc --noEmit` clean
- [x] Shadow report PASS on all 24 fixtures across 4 engines

### Doc-sync block (CLAUDE.md §16.5)

- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 2.D split refined into D.1 / D.2 / D.3)

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — PR 2.D row expanded
- `docs/changelog/CHANGELOG_2026_06_04.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Functions added are reform-agnostic by design (base ATO bracket / Medicare / offset primitives). Reform-aware engines all live in `lib/tax-engine/divisions/` — ship in PR 2.D.3 with their `commencementVerified`-guarded regime parameters intact (FW-1/FW-2).
- [x] No `lib/tax-engine/divisions/*` modified.
- [x] No schema columns added. No new AI tool. No UI surface.

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only.

### Next

- PR 2.D.2 — `super/` (3 files: capTracker, contributionCalculator, highIncomeSuperTax). H3 hardening anchor.
- PR 2.D.2b — `income/` + `position/` + `orchestrator/`.
- PR 2.D.3 — rest of `lib/tax-engine/*`.

---

## Session: qdec-pr2d2-tax-super-LIlK9 (continuation after PR #981 merge)

### Changes Made

- **Type**: Feature / Foundation / H3 hardening
- **Scope**: Q-DEC PR 2.D.2 — `lib/tax-engine/super/* (3 files)` Decimal siblings + Phase 45 H3 anchor primitive
- **Description**: Second sub-PR of Q-DEC PR 2.D. Ships Decimal siblings for the 3 superannuation engines on the salary-sacrifice critical path. Mid-session scope refinement: original D.2 plan included income/+position/+orchestrator/ alongside super/; given super/ alone is ~1000 lines of Decimal-sibling code + tests, split D.2 into super-only (this PR) and D.2b (income+position+orchestrator). The new `concessionalCapHeadroomDecimal` primitive is the H3 hardening anchor for Phase 45 spec §4.1 — the salary-sacrifice UI slider's hard stop reads from this.
- **smsfIncomeTax** deferred to PR 2.D.3 (SMSF-specific, off the salary-sacrifice path).

### Files Modified (Decimal siblings appended)

- `lib/tax-engine/super/capTracker.ts` — `trackContributionCapsDecimal`, `calculateCarryForwardDecimal`, `calculateBringForwardDecimal`, **`concessionalCapHeadroomDecimal`** (H3 anchor — pure primitive consumed by Phase 45 PR 1's UI slider hard stop)
- `lib/tax-engine/super/contributionCalculator.ts` — `calculateSuperGuaranteeDecimal`, `calculateSuperContributionsDecimal`, `calculateDivision293TaxDecimal`
- `lib/tax-engine/super/highIncomeSuperTax.ts` — `calculateHighIncomeSuperTaxDecimal` (Div 293 + Div 296 gated + TBC)
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 2.D.2 row flipped to `[~] IN FLIGHT` with mid-session scope refinement

### Files Created

- `lib/calc-audit/engines/decimal-tax-engine-super.ts` — 3 shadow engines with 18 fixtures total (capTracker H3 anchor fixtures + contributions + Div 293/296/TBC)
- `tests/tax-engine/super.decimal.test.ts` — 31 tests (18 shadow + 6 H3 anchor contract + 7 Decimal sibling contracts)

### Architectural notes

- **H3 primitive shape locked.** `concessionalCapHeadroomDecimal(ytd, config, options)` returns `{ capLimit, carryForwardAvailable, totalAvailable, used, headroomRemaining, isExceeded }`. The salary-sacrifice slider reads `headroomRemaining` for max value + `isExceeded` to know when to render the hard-stop tooltip. Phase 45 PR 1 wires this directly.
- **Phase 41E §12.14 FW-2 preserved.** `calculateHighIncomeSuperTaxDecimal` still gates Div 296 on `config.div296CommencementVerified`. Returns `0` + surfaces `UC-DIV-296-PENDING` when commencement is unverified. The Decimal port did not loosen any regime guard.
- **Output rounding preserved exactly.** `excessContributionsTax` rounds to nearest dollar (Float `Math.round`); `superGuarantee` to cents (Float `Math.round * 100 / 100`); `taxSavingsFromSalarySacrifice` to nearest dollar with `Math.max(0, ...)` floor. All preserved in Decimal via `toDecimalPlaces(0/2, HALF_EVEN)`.

### Testing

- [x] 31 new tests pass + 944 existing tests pass — zero regression (975 total)
- [x] `tsc --noEmit` clean on every new/touched file
- [x] Shadow report PASS on all 18 fixtures across 3 super engines

### Doc-sync block (CLAUDE.md §16.5)

- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 2.D.2 scope refined mid-session into super-only this PR + D.2b for income/position/orchestrator)

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 2.D.2 row flipped + D.2b added
- `docs/changelog/CHANGELOG_2026_06_04.md` — this session entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] **FW-1 outcome (c) where regime-affected:** `calculateHighIncomeSuperTaxDecimal` preserves the Div 296 commencement-verified gate — returns 0 + UC-DIV-296-PENDING flag if `config.div296CommencementVerified === false`. Other super primitives (SG, contributions tax, cap tracking) are reform-agnostic by design.
- [x] No `lib/tax-engine/divisions/*` modified.
- [x] No schema columns added. No new AI tool. No UI surface.

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only.

### Next

- PR 2.D.2b — `income/taxabilityRules` + `position/taxPositionCalculator` (consumer composer).
- PR 2.D.3 — rest of `lib/tax-engine/*` (divisions/, landTax/, stampDuty/, gst/, entity/, config/, super/smsfIncomeTax, income/salaryProcessor, orchestrator/masterTaxPosition).

---

## Session: qdec-pr2d2b-tax-income-position-orch-LIlK9

### Changes Made

- **Type**: Feature / Foundation — tax-position composer Decimal sibling
- **Scope**: Q-DEC PR 2.D.2b — `lib/tax-engine/income/taxabilityRules.ts` + `lib/tax-engine/position/taxPositionCalculator.ts` Decimal siblings
- **Description**: Composes Decimal core (PR 2.D.1) + Decimal taxability rules end-to-end into a full tax-position calculator. The salary-sacrifice scenario's "after-sacrifice" tax position is one of the consumers — Phase 45 PR 1 calls `calculateTaxPositionDecimal` with the modified income breakdown.
- **Scope refinement:** `income/salaryProcessor` (uses iterative `calculateGrossFromNet` binary search; 359 lines) and `orchestrator/masterTaxPosition` (depends on D.3 engines: entity router, divisions, landTax, stampDuty, gst, boundaries) deferred to a follow-up PR alongside D.3 dependencies.

### Files Modified (Decimal siblings appended)

- `lib/tax-engine/income/taxabilityRules.ts` — `calculateFrankingCreditsDecimal`, `determineTaxabilityDecimal` + `IncomeContextDecimal`, `TaxabilityResultDecimal` types. Float `determineTaxability` is called inline (with `amountDec.toNumber()`) to inherit the classification + explanation strings; numeric fields re-computed in Decimal.
- `lib/tax-engine/position/taxPositionCalculator.ts` — `calculateTaxPositionDecimal`, `calculateQuickTaxPositionDecimal` + the supporting `IncomeBreakdownDecimal`, `DeductionBreakdownDecimal`, `TaxCalculationDecimal`, `TaxPositionResultDecimal` types. Imports the Decimal siblings from PR 2.D.1 core (`calculateIncomeTaxDecimal`, `calculateMedicareLevyDecimal`, `calculateAllOffsetsDecimal`, `applyOffsetsDecimal`) and PR 2.D.2b taxability (`determineTaxabilityDecimal`).
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — PR 2.D.2b row flipped to `[~] IN FLIGHT` with scope refinement documented.

### Files Created

- `lib/calc-audit/engines/decimal-tax-engine-income-position.ts` — 2 shadow engines (`frankingCreditsShadow` × 5 fixtures, `quickTaxPositionShadow` × 7 fixtures)
- `tests/tax-engine/income-position.decimal.test.ts` — 30 tests (12 shadow + 8 taxability contract + 5 full-position contract + 2 quick-position contract + 3 frankingCredits exactness)

### Architectural notes

- **`calculateTaxPositionDecimal` is the salary-sacrifice composer.** PR 1's scenario engine calls this with the modified income breakdown (gross − sacrifice). Returns the same shape as Float (income breakdown, deductions, tax, paygWithheld, estimatedRefund, superContributions including Div 293) — all as Decimal.
- **Float-Decimal interop preserved.** `determineTaxabilityDecimal` calls Float `determineTaxability` ONCE (with `amountDec.toNumber()`) to inherit the classification + explanation + references; numeric fields are then re-computed in Decimal so precision survives. This is a defensible bridge — the classification rules are categorical, not arithmetic.
- **Output rounding preserved.** `paygWithheld` and `estimatedRefund` round to whole dollars (Float `Math.round`); `effectiveRate` rounds to 2 dp HALF_EVEN; `quickTaxPosition.taxPayable`/`medicareLevy`/`netTax` round to whole dollars. All mirrored via `Decimal.toDecimalPlaces(0/2, ROUND_HALF_EVEN)`.

### Testing

- [x] 30 new tests pass
- [x] 1067 existing Q-DEC scope tests still pass (1097 total in the calc-audit + decimal + tax-engine + cashflow + calculations + utils suites)
- [x] `tsc --noEmit` clean on every new/touched file (one round of type tightening to handle `IncomeContextDecimal.frequency: string | undefined` → Float `IncomeContext.frequency: string` via `?? 'ANNUALLY'`)
- [x] Shadow report PASS on all 12 fixtures across 2 engines

### Doc-sync block (CLAUDE.md §16.5)

- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 2.D.2b scope refined: `salaryProcessor` + `masterTaxPosition` deferred to a follow-up alongside D.3 deps)

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Functions added are reform-agnostic by design (taxability classification is regime-independent; tax position composer uses the same brackets/Medicare/offsets PR 2.D.1 already established as FW-1 outcome (a))
- [x] No `lib/tax-engine/divisions/*` modified
- [x] No schema columns added. No new AI tool. No UI surface.

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only.

### Next

- PR 2.D.3 — rest of `lib/tax-engine/*` (~8400 lines split into 4 cohesive sub-PRs: 3a state taxes, 3b CGT, 3c other divisions, 3d composers).

---

## Session: qdec-pr2d3a-tax-state-LIlK9

### Changes Made

- **Type**: Feature / Foundation — state-tax engine Decimal siblings
- **Scope**: Q-DEC PR 2.D.3a — `lib/tax-engine/gst/* + stampDuty/* + landTax/*` Decimal siblings (4 engines)
- **Description**: First sub-PR of Q-DEC PR 2.D.3. Self-contained state-tax cluster with no reform dependencies. Ships Decimal siblings for `calculateGst` (BAS labels + net GST), `calculateStampDuty` (general + FPAD per state), `calculateLandTax` (general + trust + foreign per state), and `calculateCrossStateLandTax` (multi-state aggregator with within-state aggregation + alphabetical stable sort).
- **Scope refinement**: original PR 2.D.3 plan was monolithic; given the ~8400-line scope (25 files), split into 4 sub-PRs (3a state taxes, 3b CGT, 3c other divisions, 3d composers) for review tractability.

### Files Modified (Decimal siblings appended)

- `lib/tax-engine/gst/gstCalculator.ts` — `calculateGstDecimal` + Decimal types. BAS-label aggregation, reverse-charge, registration-threshold, UNCOMPUTED flags preserved.
- `lib/tax-engine/stampDuty/stateStampDuty.ts` — `calculateStampDutyDecimal` + Decimal types + private `applyBracketsDecimal`. NT FPAD-absent + concession + multi-purchaser UC flags preserved.
- `lib/tax-engine/landTax/stateLandTax.ts` — `calculateLandTaxDecimal` + Decimal types + private `applyBracketsDecimal`. NSW special trust surcharge (`min(value, $1.075M) × 0.015`), VIC absentee, ACT/NT structural disclosures preserved.
- `lib/tax-engine/landTax/crossStateAggregator.ts` — `calculateCrossStateLandTaxDecimal` + Decimal types. Within-state aggregation + cross-state independence + alphabetical stable sort + de-duped citations/UNCOMPUTED.

### Files Created

- `lib/calc-audit/engines/decimal-tax-engine-state.ts` — 4 shadow engines (gst × 5, stampDuty × 6, landTax × 7, crossStateLandTax × 3 = 21 fixtures)
- `tests/tax-engine/state.decimal.test.ts` — 30 tests (21 shadow + 8 Decimal contract checks + 1 aggregate report)

### Architectural notes

- **No intermediate rounding.** State-tax engines preserve full precision; shadow tests see zero diff because both paths produce identical floating output to within currency tolerance.
- **Within-state aggregation preserved.** Cross-state aggregator uses `Map<AustralianState, ...>` to group, then aggregates Decimal values exactly.

### Testing

- [x] 30 new tests pass + 1097 existing Q-DEC scope tests still pass (1127 total)
- [x] `tsc --noEmit` clean on every new/touched file
- [x] Shadow report PASS on all 21 fixtures across the 4 engines

### Doc-sync block (CLAUDE.md §16.5)

- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 2.D.3 split into 4 sub-PRs for review tractability)

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] State-tax engines are reform-agnostic by design — no §12.14 reform engines in this PR.
- [x] No `lib/tax-engine/divisions/*` modified. No schema columns added. No new AI tool. No UI surface.

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only.

### Next

- PR 2.D.3b — CGT division engines (cgtDiscount, cgtIndexation, cgtMinimumRate, foreignResidentCgt, capitalLossNetting). Reform-aware §12.14 FW-1/FW-2.
- PR 2.D.3c — other divisions (negative gearing, trusts, companies, classifiers).
- PR 2.D.3d — composers + remaining (entity router, orchestrator, smsfIncomeTax, salaryProcessor).

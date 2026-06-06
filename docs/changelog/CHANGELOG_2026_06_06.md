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

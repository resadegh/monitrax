# medicareLevy — Quantity Contract (MON-131 Phase A)

> **The proof case.** Medicare levy is the app's ONLY single-sourced quantity (REFERENCE_NUMBERS_DESIGN.md §1).
> This contract documents WHY it is clean, so Phase B can replicate the pattern, and verifies at HEAD
> (2026-07-29) that no second producer exists. All 26 census-flagged sites are classified below.
> Read-only Phase A artefact — no production code was changed.

## classification

**DERIVED** (D1). Computed from: taxable income (itself DERIVED from FACT income/deduction rows),
household composition FACTs (family status, dependants, spouse income, hospital cover), and the
legislated constants in `TAX_YEAR_CONFIGS` (rate, thresholds, shade-out multiplier, MLS tiers — D12
compliant: **zero** medicare constants are hardcoded outside `lib/tax-engine/config/taxYearConfig.ts`).
Never stored (D2) — computed on every request.

## semantic

- **Basis:** annual taxable income for the resolved FY; for FAMILY, the low-income test and the MLS
  tier are applied to COMBINED income (own + spouse) but the levy/surcharge is levied on OWN income
  (MON-088; shade-range levy apportioned by own share of tested income).
- **Window:** one financial year (`TaxYearConfig` resolved via `getCurrentTaxYearConfig()` or caller-passed).
- **Inclusions:** basic levy (2%) + shade-in (10% of excess over threshold between threshold and
  1.25×threshold) + Medicare Levy Surcharge (1%/1.25%/1.5% tiers when no private hospital cover;
  family tiers = singles × 2 + $1,500 per dependent child after the first — `medicareSurchargeFamily`).
- **Exclusions:** $0 when `hasMedicareExemption`; $0 at/below threshold (single $27,222 FY24-25;
  family $45,907 + $4,216/child); MLS $0 for a family member whose own income ≤ the single threshold
  (ATO low-earner exception); MLS $0 with (whole-family) hospital cover.
- **Units:** AUD per year, rounded to cents at the producer (`Math.round(x*100)/100` Float,
  `toDecimalPlaces(2, ROUND_HALF_EVEN)` Decimal). Dollar rounding happens only at display/quick-position.
- **Output shape:** `{ medicareLevy, medicareSurcharge, total, isShadeIn, isExempt }` — consumers must
  pick the right field (`total` = levy + MLS; `medicareLevy` = levy only).

## canonicalHome

- **Float:** `lib/tax-engine/core/medicareLevyCalculator.ts:55` `calculateMedicareLevy` — verified at HEAD.
- **Decimal twin:** `lib/tax-engine/core/medicareLevyCalculator.ts:334` `calculateMedicareLevyDecimal` — verified at HEAD. Twins migrate together (already co-located, same file — this is the pattern Phase B should copy).
- **Internal (non-exported-producer) helpers, same file:** `mlsTierRate:207` (ONE tier table, family bounds derived — never a second list), `calculateMedicareSurcharge:239` (Float), `calculateMedicareSurchargeDecimal:303`. `getMedicareSummary:412` is an exported convenience WRAPPER that calls the canonical producer twice (with/without PHI) — a consumer, not a second producer.
- **Constants:** `lib/tax-engine/config/taxYearConfig.ts` — `medicareRate:61/183/286/361`, `medicareThresholds:62`, `medicareSurchargeThresholds:74`, `medicareSurchargeFamily:83` (per-FY, ATO-cited, retrieved 2026-06-07).

### Why it is clean (the proof, stated so Phase B can replicate it)

1. **One file owns the formula AND its Decimal twin** — nobody imports "half" of medicare.
2. **Every constant lives in `TAX_YEAR_CONFIGS`** with an ATO citation; a repo-wide sweep of `0.02` at HEAD finds NO medicare-shaped hardcode outside config + the state land-tax bracket tables (a different quantity).
3. **Every downstream surface reads a canonical OUTPUT FIELD** (`taxPosition.tax.medicareLevy`, `takeHome.medicareLevy`) — none re-derives. MON-020 explicitly repointed the cashflow-intelligence route to the one tax position; MON-039a itemised the component without re-computing it.
4. **The one semantic fork that existed (family legs) was fixed IN the producer** (MON-088, CLOSED) — family/MLS support was added to `calculateMedicareLevy` itself and callers pass context, instead of a family-aware sibling being built next door.

## callSites

All 26 sites from `census:producers --list` (section `medicareLevy`) at HEAD. The census splits files
into units crudely, so several site names are **unit-boundary artifacts** — the medicare reference
actually sits in the code region after that function's start; the real anchor is given.

| Census site | Tag | What the code actually does (verified at HEAD) |
|---|---|---|
| `lib/tax-engine/core/medicareLevyCalculator.ts:calculateMedicareLevy` (55) | **CANONICAL PRODUCER** | levy + shade-in + MLS composition |
| `…/medicareLevyCalculator.ts:calculateMedicareLevyDecimal` (334) | **CANONICAL PRODUCER (Decimal twin)** | mirrors Float incl. rounding mode |
| `…/medicareLevyCalculator.ts:calculateMedicareSurcharge` (239) | PRODUCER-INTERNAL | MLS leg, private to the composition (module-private) |
| `…/medicareLevyCalculator.ts:mlsTierRate` (207) | PRODUCER-INTERNAL | tier lookup; family bounds derived from the ONE config table |
| `lib/tax-engine/position/taxPositionCalculator.ts:calculateTaxPosition` (153) | CONSUMER | calls producer at :319 with MON-088 `medicareContext` |
| `…:calculateTaxPositionDecimal` (714) | CONSUMER | calls Decimal twin at :861 |
| `…:calculateQuickTaxPosition` (587) | CONSUMER | calls producer at :604; dollar-rounds at :613 (`Math.round(medicare.total)`) |
| `…:calculateQuickTaxPositionDecimal` (938) | CONSUMER | calls Decimal twin at :958; mirrors dollar rounding at :971 |
| `…:calculateDivision293TaxAmountDecimal` (695) | CONSUMER (unit artifact) | no medicare code of its own; the unit's body spans into `calculateTaxPositionDecimal`'s region |
| `lib/tax-engine/position/userTaxPosition.ts:getUserTaxPosition` (86) | CONSUMER | derives `medicareContext` ONCE from household profile (:232-269) and passes through — no arithmetic |
| `lib/tax-engine/income/salaryProcessor.ts:processSalary` (46) | CONSUMER | calls producer at :139 (estimate path: taxable income only, defaults) |
| `…:compareSalaryScenarios` (334) | CONSUMER | consumes `processSalary` output; no own derivation |
| `…:annualizeDecimal` (410) | CONSUMER (unit artifact) | real call is `calculateMedicareLevyDecimal` at :435 inside `processSalaryDecimal` |
| `lib/cashflow/incomeNormalizer.ts:calculateNetSalary` (49) | CONSUMER | calls producer at :64 (⚠ input note below) |
| `…:calculateNetSalaryDecimal` (313) | CONSUMER | calls Decimal twin at :325 |
| `…:calculateTakeHomePay` (221) | CONSUMER | calls producer at :244; divides by frequency divisor at :266 (unit conversion of the OUTPUT, not a re-derivation) |
| `…:calculateTakeHomePayDecimal` (468) | CONSUMER | calls Decimal twin at :487 |
| `lib/calculations/cashflowOrchestrator.ts:calculateIncomeAmounts` (131) | CONSUMER | reads `takeHome.medicareLevy` at :164 (PAYG+levy → monthly) |
| `…:calculateIncomeAmountsDecimal` (491) | CONSUMER | reads Decimal `takeHome.medicareLevy` at :521 |
| `…:round` (386) | CONSUMER (unit artifact) | no medicare code; unit body spans a comment at :444 |
| `app/api/cashflow/intelligence/route.ts:buildTaxOptimization` (431) | CONSUMER | reads `taxPosition.tax.medicareLevy` at :438 (MON-020/MON-039a — itemises, never recomputes) |
| `lib/cfo/decisionSupport/taxIntegration.ts:calculateCFOTaxInsights` (85) | CONSUMER | reads `taxPosition.tax.medicareLevy` at :158 |
| `app/dashboard/cfo/page.tsx:getPriorityIcon` (624) | CONSUMER (unit artifact) | renders `keyTaxMetrics.medicareLevy` at :901 — display only |
| `app/dashboard/tax/page.tsx:formatPercent` (186) | CONSUMER (unit artifact) | renders `taxPosition.tax.medicareLevy` :344, `medicareSurcharge` :349, and `config.medicareRate` copy :522 — display only |
| `lib/neobrain/factPack.ts:appRule` (340) | CONSUMER (constants) | exposes `config.medicareRate`/threshold as reference facts (:116-117, :345) — reads config, no derivation |
| `lib/neobrain/grounding.ts:pct` (151) | CONSUMER (constants) | formats the fact-pack rate/threshold into the grounding prompt (:162) — display only |

**DUPLICATE count: 0. DIFFERENT-QUANTITY count: 0. Verdict: CLEAN — no second producer exists at HEAD.**

⚠ **Input-fidelity note (MON-028 class — same engine ≠ same inputs), not a producer violation:**
`incomeNormalizer` (:64, :244, :325, :487) and `salaryProcessor` (:139, :435) pass `taxableIncome = annual GROSS salary`
(no deductions) with defaulted `hasPrivateHealthInsurance: true` / `SINGLE` — the estimate-level contract
documented in `MedicareLevyInput`'s JSDoc (:28-49). The tax-position producer passes captured household
context. The two paths legitimately answer different questions ("take-home estimate" vs "tax position")
but will show different medicare figures for the same user. Phase B should keep this divergence NAMED
(estimate vs assessed), not "fix" it.

## invariants

1. **Full-rate leg:** for tested income ≥ 1.25 × threshold, `medicareLevy == taxableIncome × config.medicareRate` (before cent rounding).
2. **Live recompute from `taxYearConfig.ts` constants** (golden baseline: taxable **$145,426**, Medicare **$2,909**):
   single threshold $27,222 (:63) → shade-out $34,027.50; $145,426 > $34,027.50 → full rate;
   `145,426 × 0.02 = $2,908.52` (producer output, cents) → **$2,909** displayed via `calculateQuickTaxPosition`'s
   dollar rounding (:613). ✅ matches the live figure — the invariant holds at HEAD.
3. Below threshold (tested income ≤ threshold): levy == 0.
4. Shade range: `0 < levy ≤ 0.10 × (testedIncome − threshold)` and levy < full-rate leg (continuity: at exactly 1.25×threshold the shade formula equals 2% of threshold-share — apportionment keeps it ≤ own-income × 2%).
5. `total == medicareLevy + medicareSurcharge`, always.
6. MLS == 0 whenever `hasPrivateHealthInsurance == true` (whole-family cover for FAMILY); MLS == 0 for own income ≤ single threshold in a family.
7. Float ≡ Decimal parity to the cent for identical inputs (both round half-even at 2dp).

## independentExpectation

- **Rate:** Medicare Levy Act 1986 (Cth) s6(1) — 2% of taxable income. Config cites ATO
  (`taxYearConfig.ts:22-25`, thresholds verified against NAT 1005: "$523 weekly = $27,222 annual", retrieved 2026-06-07 — :51-60).
- **Thresholds/shade-in:** Medicare Levy Act 1986 s7 (low-income reduction; 10c-in-the-dollar shade at 1.25×).
- **MLS:** Medicare Levy Act 1986 s8B-8G + A New Tax System (Medicare Levy Surcharge—Fringe Benefits) Act 1999; family tiers per ATO "Medicare levy surcharge income, thresholds and rates" (MON-088, config :80-83).
- Checkable without reading another screen: hand-compute `taxableIncome × 0.02` above the shade-out. **NOT "NONE FOUND"** — this quantity is fully independently verifiable.

## surfaces

| Route | Label |
|---|---|
| `/dashboard/tax` | "Medicare Levy" row (+ "Medicare Surcharge" row when > 0); bracket-table footnote "Plus 2% Medicare Levy…" |
| `/dashboard/cfo` (My Guide) | "Medicare levy: $X · included in tax above" (MON-039a itemisation) |
| `/cashflow` (intelligence → `GlassTaxTile`) | Medicare levy itemised inside estimated annual tax (route :476 → tile props :37-48) |
| Income take-home paths (`quickMetrics` via `cashflowOrchestrator` net salary) | inside net-of-tax income figures (not itemised) |
| Neobrain/AI grounding | reference constant (rate + threshold), not the user's levy |
| `/api/tax/entity/[entityId]` per-entity position | via `taxPosition.tax.medicareLevy` field in serialized position |

## expectedMoves

**NONE.** This contract predicts **zero movement** of any medicare figure through Phase B — the
quantity is already single-sourced and no migration touches it. This is the strongest, most
falsifiable prediction in the set: any medicare delta in a tranche's golden-baseline diff is a
defect in that tranche, full stop. `pathPrefixes` expected to move: `[]`.

## decisionsRequired

1. **Estimate-vs-assessed naming (input fidelity):** the take-home estimate paths call the canonical
   producer with gross-as-taxable + SINGLE/PHI=true defaults, the tax position with captured context.
   Keep both, but should the estimate figure be surfaced/labelled as `medicareLevyEstimate` (D6 —
   name the quantity) so the two can never be compared as "the same number"? (Consequence of not
   deciding: a future parity check flags take-home vs tax-page medicare as drift when it is a
   documented semantic difference.)
2. **Family MLS single-only modelling gap** (config :70-73 note): family MLS is now modelled via
   `medicareSurchargeFamily`; the FY25-26/26-27 thresholds are carried forward "pending ATO update"
   (:184-186, :287-289). Confirm at the `reviewSchedule` checkpoint — a config-review task, not a
   producer change.

## coverageBoundary

- **Verifies:** all 26 census sites read at HEAD and classified; the canonical producer + Decimal twin
  read in full (443 lines); the repo-wide `0.02` sweep; the invariant recompute from config constants;
  MON-088/MON-020/MON-039a registry entries cross-checked.
- **Does NOT verify:** runtime rendered values (that is Ring 3 / the Number Ledger); the correctness of
  taxable income feeding the levy (separate quantities — `taxableIncome` contract, T4); whether the
  household-profile FACTs (spouse income, cover) are correctly captured upstream (intake integrity);
  exemption categories beyond the boolean flag (half-levy categories are not modelled — the code has
  no NAT 1005 half-levy path; that is a documented capability gap, not a wrong number).
- **Stale-anchor report:** none — every census anchor for this quantity resolves at HEAD (unit-name
  artifacts noted per-row above are census method quirks, not drift).

## Adversarial review (§7) — 2026-07-29

- **Claims checked: 41** (anchors 30 · arithmetic 6 · negative-claims 5)
- **REFUTED / CORRECTED: none.** Every load-bearing claim survived a hostile re-check:
  - Producer + twin anchors exact: `calculateMedicareLevy:55`, `calculateMedicareLevyDecimal:334`,
    `mlsTierRate:207`, `calculateMedicareSurcharge:239`/Decimal `:303`, `getMedicareSummary:412`
    (wrapper calling the producer at `:423/:428`); file is 443 lines as stated.
  - Consumer anchors spot-verified in source: position `:319/:861`, quick `:604` + dollar-round
    `:613`, quickDecimal `:958/:971`; normalizer `:64/:244/:325/:487` (and the frequency divisor
    at `:262-266` is output unit-conversion, as claimed); salaryProcessor `:139/:435`
    (`annualizeDecimal:410` unit-artifact confirmed — real call inside `processSalaryDecimal:396`);
    orchestrator `:164/:521`; intelligence `:438`; taxIntegration `:158`; cfo page `:901`;
    tax page `:344/:349/:522`; factPack `:116-117/:340-345`; grounding `:151/:162`.
  - Independent second-producer hunt (beyond the census 26): repo-wide `0.02` sweep, Decimal-string
    `'0.02'` sweep, and a full enumeration of every medicare-mentioning file in `lib/`, `app/`,
    `components/` — the only extra hits are display/type/pass-through files plus ONE additional
    canonical-producer CONSUMER the census misses: `app/api/tax/super/optimize/route.ts:255,:260`
    (base/reduced scenarios call `calculateMedicareLevy` on GROSS salary — the same estimate-level
    input caveat as incomeNormalizer; a consumer, not a producer). **DUPLICATE count stays 0.**
  - Invariant recompute re-done independently: 27,222 × 1.25 = 34,027.50; 145,426 × 0.02 = 2,908.52
    → $2,909 (golden `lib/matrix/goldenBaseline.ts:77`). Shade-continuity claim verified
    algebraically against the apportionment code (`ownShare` at the producer's shade branch:
    0.10 × 0.25T × ownShare == 0.02 × (ownShare × 1.25T)). Config lines all exact
    (`medicareRate:61/183/286/361`, thresholds `:62-67`, MLS tiers `:74-81`, family `:83`,
    NAT 1005 citation block `:51-60`).
- **Could not verify:** the FY24-25 threshold figures against ATO NAT 1005 itself (the in-file
  citation retrieved 2026-06-07 is the trail — same boundary the contract declares); runtime
  rendered values (Ring 3, out of scope by rule).
- **Verdict impact: none. PASS — the CLEAN verdict (0 duplicates, 0 different-quantity producers)
  survives the adversarial pass unchanged**, including the "expectedMoves: NONE" prediction.
  One census-coverage note added for the gate pack: the super/optimize route consumer sits outside
  the census's 26 sites — a census-signature gap, not a contract error.

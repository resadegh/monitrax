# negativeGearing — Quantity Contract (MON-131 Phase A)

> Census: 6 sites at seed. Verified at HEAD 2026-07-29. MON-045 history honoured: the four rogue
> producers WERE deleted (verified by tombstones in source) — but this contract finds the census
> both over-counts (3 comment artifacts) and **under-counts (the two LIVE benefit producers are not
> in its 6 sites)**, and one duplicate formula survives. Read-only Phase A artefact.

## classification

**DERIVED.** Inputs: the canonical tax position's `deductions.property` (which since MON-045 includes
auto-derived deductible property-loan interest from the ONE producer,
`lib/tax-engine/deductions/propertyLoanInterest.ts`) and `income.rental`, plus `tax.marginalRate`;
regime classification additionally consumes property FACTs (acquisition contract date, new-build flag)
per Phase 41E §12.14.

## semantic — FOUR distinct quantities under one name (D6: name them; the census conflates them)

| Named quantity | Semantic | Units |
|---|---|---|
| **`negativeGearingRegime`** | Phase 41E classification per property/entity: `PRE_REFORM_GRANDFATHERED` / `POST_REFORM_NEW_BUILD` / `POST_REFORM_RESTRICTED` / UC_* — reform gated behind `negativeGearingReformCommencementVerified` (false on every FY config at HEAD; FW-2 respected) | enum |
| **`entityLossTreatment`** | ITAA 97 Div 8/36 per-entity treatment of a net rental/business loss: individuals/partners offset other income; trusts/companies trap + carry forward; SMSF offsets fund income; post-reform quarantine when regime restricted | AUD offset now / carried forward |
| **`netRentalLoss`** | `max(0, deductions.property − income.rental)` for the FY — the loss amount itself, before any rate | AUD/yr |
| **`negativeGearingTaxBenefit`** | `netRentalLoss × marginalRate` — the estimated tax sheltered by the loss | AUD/yr |

- **Window:** one FY (the tax-position FY).
- **Inclusions:** property deductions per the canonical position (interest auto-derived actuals-first,
  HOME excluded, deductible fraction honoured — propertyLoanInterest.ts); rental income per position.
- **Exclusions:** MON-045's invariant — the benefit can NEVER exceed total deductions; no per-property
  `Σ principal × rate` re-derivation anywhere (deleted).

## canonicalHome

- **`negativeGearingRegime`:** `lib/tax-engine/divisions/negativeGearingRegime.ts:147`
  `deriveNegativeGearingRegime` (+ `regimePermitsLossOffsetOtherIncome:194`). No Decimal twin needed (enum) — **NOT APPLICABLE**.
- **`entityLossTreatment`:** `lib/tax-engine/divisions/negativeGearing.ts:152` `applyNegativeGearing`
  — **Decimal twin** `applyNegativeGearingDecimal:346`; helper `entityCanOffsetLossesCurrentFy:311`.
  ⚠ **DORMANT**: zero production callers at HEAD — only `lib/calc-audit/engines/decimal-tax-engine-loss.ts`
  fixtures exercise it (`taxPositionCalculator.ts:254` comment: individual path is "grandfathered /
  always-offset today", which IS the pre-reform law for individuals — dormancy is currently harmless
  but becomes a wrong number the day a trust/company entity or the reform flag goes live without wiring).
- **`netRentalLoss` / `negativeGearingTaxBenefit`:** **NOT ESTABLISHED** — no named producer exists;
  the arithmetic is inlined at the three sites below. Phase B must pick ONE home (recommended: emit
  both fields from the tax-position producer, since both inputs already live there). **No Decimal twin
  exists for either** — the Decimal tax position does not compute the benefit at all.

## callSites

### The 6 census sites (section `negativeGearing`) at HEAD

| Census site | Tag | Actual arithmetic (in words) |
|---|---|---|
| `lib/tax-engine/divisions/negativeGearing.ts:entityCanOffsetLossesCurrentFy` (311) | **CANONICAL PRODUCER-ADJACENT (entityLossTreatment helper)** | boolean: can this entity type offset losses against other income this FY under this regime |
| `lib/tax-engine/divisions/negativeGearingRegime.ts:deriveNegativeGearingRegime` (147) | **CANONICAL PRODUCER (regime)** | cut-over date + new-build classification, UC fallbacks |
| `lib/tax-engine/position/taxPositionCalculator.ts:calculateTaxPosition` (153) | **PRODUCER (unnamed `netRentalLoss`)** | at `:389`: `negativeGearing = deductionBreakdown.property − incomeBreakdown.rental` → warning string only (gated `rental > 0`) |
| `lib/intelligence/portfolioEngine.ts:generatePortfolioIntelligence` (757) | COMMENT ARTIFACT | the match is the MON-045 tombstone comment at `:796` ("negativeGearingBenefit removed (duplicate loss producer)"). NOTE: the surrounding code still derives per-property `annualProfit` with its own declared-only interest (`:778-783`) — that is the **property cashflow/yield quantity's** problem (T5), not a negative-gearing producer. |
| `lib/calc-audit/engines/decimal-cfo-decision-support.ts:unrealisedCGTFloat` (432) | COMMENT ARTIFACT | MON-045 tombstone at `:490-491` ("negativeGearingBenefitShadow was REMOVED") |
| `lib/cfo/decisionSupport/taxIntegration.ts:calculateUnrealisedCGTDecimal` (440) | COMMENT ARTIFACT | MON-045 tombstone at `:459-465`; the LIVE derivation in this file is at :114 (below), attributed by the census to a different unit |

### The two LIVE `negativeGearingTaxBenefit` producers the census MISSES (highest-value finding)

The census's `nearArith` window is single-line; both sites split identifier and arithmetic across
lines, so **neither is counted** — the seed's `negativeGearing: 6` under-states live producers.

| Site | Tag | Actual arithmetic (in words) |
|---|---|---|
| `lib/cfo/decisionSupport/taxIntegration.ts:114-116` (inside `calculateCFOTaxInsights`) | **DUPLICATE (formula)** | `max(0, taxPosition.deductions.property − taxPosition.income.rental) × (taxPosition.tax.marginalRate / 100)` → CFO `keyTaxMetrics.negativeGearingBenefit`, rendered `/dashboard/cfo` :888-891. Inputs canonical (MON-045's fix), formula inlined. NO `rental > 0` gate — benefit shows even with zero rental income. |
| `lib/tax-engine/position/taxPositionCalculator.ts:483` (inside `generateTaxInsights`) | **DUPLICATE (formula)** | `taxBenefit = (deductions.property − income.rental) × mr` (mr = marginalRate/100, MON-040) → "Negative Gearing Active" recommendation `potentialSavings`, gated `rental > 0`. |

**Same semantic, same formula, two inline sites, one edge divergence** (zero-rental gating: property
deductions with no rental income → CFO shows a benefit, tax-page insight does not). §12.2.1: the
duplication is the defect regardless of both being "correct".

### Consumers (no arithmetic)

- `app/dashboard/cfo/page.tsx:888-891` renders `keyTaxMetrics.negativeGearingBenefit` — CONSUMER.
- `components/wealth/TaxTreatmentBadge.tsx:140` calls `deriveNegativeGearingRegime` for the My Wealth regime badge (§12.14 FW-5) — CONSUMER.
- `lib/ai/tax-advisor/tools/getReformImpactSummaryForUser.ts:185`, `getReformedTaxRegimeStatus.ts:111` — regime CONSUMERS.
- `lib/calc-audit/engines/decimal-tax-engine-loss.ts` — Ring-0 shadow of `applyNegativeGearing{,Decimal}` — test spine.

### MON-045 verification (the history the brief asked to confirm)

Registry MON-045 CLOSED: "four rogue producers deleted; deductible loan interest derived in the ONE
tax engine." **Confirmed at HEAD** by tombstones: `taxIntegration.ts:459-465`
(`calculateNegativeGearingBenefit` Float + Decimal DELETED), `portfolioEngine.ts:187/:240/:483/:796`
(field + "simplified benefit" block removed), `decimal-cfo-decision-support.ts:490-491` (shadow
removed), and by `propertyLoanInterest.ts:7` header (the Σ principal×rate producer superseded). The
benefit now reads canonical inputs — MON-045's own scope is intact. What REMAINS (out of MON-045's
scope, in this contract's): the benefit FORMULA exists twice, and neither instance is a named producer.

**Verdict: regime CLEAN · entityLossTreatment CLEAN-but-DORMANT · netRentalLoss UNNAMED (3 inline sites incl. :389 warning) · negativeGearingTaxBenefit UNNAMED + MULTIPLE (2 formula sites).**

## invariants

1. **MON-045's law:** `negativeGearingTaxBenefit ≤ deductions.total × topMarginalRate` — and specifically the benefit can never exceed the loss: `benefit ≤ netRentalLoss` (rate ≤ 1). The original bug ($157,746 benefit vs $39,554 total deductions) is impossible under either producer today; keep as the permanent test.
2. `netRentalLoss == max(0, deductions.property − income.rental)`, from the SAME tax position both surfaces read.
3. Cross-surface parity: CFO `negativeGearingBenefit` == tax-page insight `potentialSavings` whenever both render (currently falsifiable at zero rental income — the edge divergence above).
4. `benefit == netRentalLoss × (marginalRate/100)` where `marginalRate` is a PERCENT (MON-040 unit contract — 37 means 37%).
5. Pre-reform / grandfathered regime + individual entity: loss offsets other income in full (`entityCanOffsetLossesCurrentFy == true`); trusts/companies: offset == 0, carry-forward == loss.
6. Reform math NEVER applies while `negativeGearingReformCommencementVerified == false` (FW-2; false on all four FY configs at HEAD).

## independentExpectation

- **Loss offset:** ITAA 1997 s8-1 (deduction nexus) + Div 36 (individuals offset; trust losses Sch 2F
  ITAA 1936; company losses Div 165) — cited in `negativeGearing.ts:6-13` header.
- **Benefit arithmetic:** an identity, hand-checkable from the position: benefit = (property deductions
  − rental income) × marginal rate; e.g. deductions $30,000, rent $18,000, MR 37% → loss $12,000,
  benefit $4,440. Independently derivable without reading another screen — **NOT "NONE FOUND"**.
- **Regime:** Phase 41E reform (12 May 2026 Budget), cut-over `REFORM_CUT_OVER_UTC` in
  `reformConstants.ts`; commencement FY27-28 pending Royal Assent (§12.14 measure 1).

## surfaces

| Route | Label |
|---|---|
| `/dashboard/cfo` (My Guide) | "Neg. Gearing Benefit: $X" (keyTaxMetrics, when > 0) |
| `/dashboard/tax` | "Negative Gearing Active" recommendation with `potentialSavings`; "Negative gearing: Property deductions exceed rental income by $X" warning |
| My Wealth property tiles / detail | regime badge (Grandfathered / Post-reform…) via `TaxTreatmentBadge` — enum, not a dollar |
| AI tax advisor (chat) | reform impact / regime status tool outputs |

## expectedMoves

Written BEFORE migration. When Phase B names `netRentalLoss` + `negativeGearingTaxBenefit` and emits
them from the tax-position producer (both existing sites become consumers):

| pathPrefix | Why | Arithmetic |
|---|---|---|
| `/dashboard/cfo` Neg. Gearing Benefit | re-sourcing, identical inputs + formula | **NO movement** — same position fields, same ×MR/100 |
| `/dashboard/tax` NG recommendation | re-sourcing | **NO movement**, EXCEPT the zero-rental edge: if the surviving semantic adopts the `rental > 0` gate, a user with property deductions and $0 rental sees the CFO figure disappear (fall to not-rendered); if it adopts `max(0,…)` without the gate, the tax page gains a recommendation it previously suppressed. **The edge's direction is a decision, not an accident — see decisionsRequired 1.** |
| any surface | wiring `applyNegativeGearing` into the individual position path | **NO movement** for individuals pre-reform (always-offset == current behaviour) — the strongest prediction here; movement only appears for trust/company entities (loss trapping) which the current position path does not model per-entity anyway |

## decisionsRequired

1. **The zero-rental edge (product semantics):** does a property with deductions but NO rental income
   this FY count as "negatively geared" for the benefit figure? CFO says yes (`max(0,…)`), tax page
   says no (`rental > 0`). Options: (a) gate on `rental > 0` (a vacant/pre-rental property shows no
   benefit — conservative, matches "gearing" language); (b) `max(0,…)` ungated (shows the shelter
   effect of any property loss — arguably overstates "negative gearing" for a non-income property whose
   deductions may not even be deductible under s8-1 nexus). Accounting consequence: (b) can claim a
   benefit on deductions with no income nexus. Recommend (a) but **do not choose here** — Reza's call.
2. **Where the named producers live:** emit `netRentalLoss` + `negativeGearingTaxBenefit` (+ Decimal
   twins — currently none exist) from `taxPositionCalculator` (both inputs are its own outputs), or
   from a small `divisions/` helper? Consequence: position-emitted keeps one producer file per D14
   file-partitioning; helper adds an import hop but keeps the position output shape stable.
3. **Dormant `applyNegativeGearing`:** wire it into the per-entity position path now (no movement for
   individuals, correctness for trusts/companies) or explicitly park it until the entity-position
   work? Parking must be recorded so the reform flag flipping true cannot go live with the engine
   still unwired (that combination WOULD move numbers silently).
4. **Census signature fix (tooling, MON-131 Phase A0 follow-up):** the `negativeGearing` signature
   must (a) exclude comment lines, (b) span the two-line benefit assignments — otherwise the ratchet
   guards 3 tombstones and misses both live producers. Re-seed with reason when the signature grows.

## coverageBoundary

- **Verifies:** all 6 census sites + the 2 census-missed producers read and classified at HEAD;
  MON-045 deletion tombstones verified in all four cited files; `applyNegativeGearing` caller sweep
  across `lib/`, `app/`, `components/` (zero production callers — calc-audit only); regime consumer
  sweep; marginalRate unit contract (percent) verified at `incomeTaxCalculator.ts:118` +
  `taxPositionCalculator.ts:455-460`.
- **Does NOT verify:** the correctness of `deductions.property` composition itself (own quantity —
  `deductions`, census 105 sites, T4); `propertyLoanInterest.ts` internals (consumed as canonical per
  MON-045); portfolioEngine's per-property declared-only interest (flagged to the T5
  property-cashflow contract, not judged here); runtime rendered values (Ring 3); trust/company
  entity flows (not wired at HEAD).
- **Stale-anchor report:** MON-045 registry rootCause anchors `taxIntegration.ts:197`/`:213` no longer
  point at the deleted producer (expected — the fix removed it; tombstone now at :459). Census
  `negativeGearing: 6` seed is **misleadingly composed** (3 comment artifacts in, 2 live producers
  out) — report to the census owner; do NOT re-seed in this phase (read-only).

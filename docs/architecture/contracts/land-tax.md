# landTax — Quantity Contract (MON-131 Phase A)

> Census: 8 sites at seed. Verified at HEAD 2026-07-29. State-based (8 jurisdictions), legislated,
> Act-cited per state. Read-only Phase A artefact.

## classification

**DERIVED** — a statutory schedule applied to a FACT (`taxableLandValue`, user-asserted per property)
plus FACT ownership context (state, ownership type, foreign-owner flag, residential flag). The
schedule constants (thresholds, brackets, surcharge rates) are legislated FACTs homed in per-state
`LandTaxConfig` objects inside the producer file — **not** in `TAX_YEAR_CONFIGS` (see decisionsRequired).

## semantic

Two DISTINCT named quantities live under "land tax" — both survive:

1. **`landTaxSingleState`** — one owner, one state, aggregated taxable land value:
   `general progressive brackets (below general threshold → $0)` + `trust surcharge` (non-fixed
   trusts only; NSW v1-simplified to 1.5% × min(value, $1.075M)) + `foreign/absentee surcharge`
   (config rate, residential-only where the state says so). Total = sum of the three legs.
2. **`landTaxCrossStatePortfolio`** — the owner's whole portfolio: parcels are SUMMED WITHIN a state
   and assessed once against that state's scale (two $400k VIC parcels = one $800k assessment),
   then states are assessed INDEPENDENTLY and summed. Consumes quantity 1 per state.

- **Basis:** taxable land value (unimproved/site value per state law — the caller's responsibility;
  PPOR exclusion is the caller's, per NSW s10/Sch 1A note).
- **Window:** assessment year — calendar year for NSW/QLD (CY2025 configs), FY for VIC/SA/WA/TAS/ACT
  (FY24-25 configs). NT = structural zero (no land tax regime).
- **Units:** AUD per assessment year.
- **Exclusions:** multi-state grouping/aggregation provisions (e.g. NSW Pt 4) NOT computed —
  surfaced as `UC-MULTI-STATE-LAND-TAX`/`UC-LAND-TAX-TRUST-SURCHARGE-NUANCE` UNCOMPUTED flags rather
  than guessed (the honest-boundary pattern).

## canonicalHome

- **Quantity 1 (single-state):** `lib/tax-engine/landTax/stateLandTax.ts:374` `calculateLandTax`
  — **Decimal twin** `calculateLandTaxDecimal` at `:576`. Internal bracket helpers `applyBrackets:342`
  / `applyBracketsDecimal:553` (module-private). Per-state configs + Act citations:
  `NSW_LAND_TAX_CY2025:138`, `VIC…:158`, `QLD…:188`, `SA…:211`, `WA…:230`, `TAS…:251`, `ACT…:269`, `NT…:299`.
- **Quantity 2 (cross-state portfolio):** `lib/tax-engine/landTax/crossStateAggregator.ts:105`
  `calculateCrossStateLandTax` — **Decimal twin** `calculateCrossStateLandTaxDecimal` at `:255`.
  A CONSUMER of quantity 1 per state, not a duplicate.

## callSites

All 8 census sites (section `landTax`) at HEAD:

| Census site | Tag | Actual arithmetic (in words) |
|---|---|---|
| `lib/tax-engine/landTax/stateLandTax.ts:calculateLandTax` (374) | **CANONICAL PRODUCER (Q1)** | brackets + trust surcharge + foreign surcharge |
| `…:calculateLandTaxDecimal` (576) | **CANONICAL PRODUCER (Q1 Decimal twin)** | mirror |
| `…:applyBracketsDecimal` (553) | PRODUCER-INTERNAL | progressive bracket walk (Decimal); Float sibling `applyBrackets:342` not separately census-listed |
| `lib/tax-engine/landTax/crossStateAggregator.ts:calculateCrossStateLandTax` (105) | **DIFFERENT-QUANTITY (Q2)** | groups parcels by state, sums values within state, calls Q1 per state, sums states — a legitimately different number (portfolio vs single assessment). SURVIVES with its own name. |
| `…:calculateCrossStateLandTaxDecimal` (255) | **DIFFERENT-QUANTITY (Q2 Decimal twin)** | mirror |
| `…:citationKey` (167) | CONSUMER (unit artifact) | citation-dedup string helper; no arithmetic of the quantity |
| `lib/tax-engine/orchestrator/masterTaxPosition.ts:ingestUncomputed` (406) | CONSUMER (unit artifact) | the orchestrator CONSUMES Q2 at `:259` (Float) / `:603` (Decimal) when `input.landTax` is provided; :406-422 merely ingests its citations/uncomputed flags |
| `app/dashboard/properties/page.tsx:calculateAnnualInterest` (489) | FALSE POSITIVE | the file's only land-tax content is `landTaxDueDate` — a reminder DATE (FACT), no land-tax dollar is computed or shown; the census context regex `/landTax/` matched the field name |

Additional (non-census) consumers verified at HEAD:
- `lib/ai/tax-advisor/tools/getLandTaxPosition.ts:49` → `calculateCrossStateLandTaxDecimal` — CONSUMER
- `lib/ai/tax-advisor/tools/runLandTaxScenario.ts:93/:99` → baseline + hypothetical scenario — CONSUMER
- `lib/calc-audit/engines/tax.ts` / `decimal-tax-engine-state.ts` — Ring-0 fixtures/shadow — CONSUMER (test spine, correct silo per Part 22)

**DUPLICATE count: 0. Verdict: CLEAN (two named quantities, one producer + one Decimal twin each,
zero rogue producers found in `lib/`, `app/`, `components/`).** The census's 8 → effectively
2 producers + 2 twins + 2 internals/artifacts + 1 consumer-artifact + 1 false positive.

## invariants

1. Below the state's `generalThreshold`: general leg == $0 (e.g. NSW value ≤ $1,075,000 → $0 general tax).
2. Bracket continuity: at value V in bracket b, tax == `b.baseAmount + (V − b.min + 1) × b.rate` — recomputable by hand from the config tables (e.g. NSW $2,000,000: $100 + 1.6% × excess over $1.075M per s27 table :138-149).
3. Q2 within-state aggregation: `crossState({A: v1, A: v2}) == singleState(A, v1+v2)` — never the sum of two separate assessments.
4. Q2 across states: `total == Σ per-state totals` (independence).
5. Trust surcharge == 0 for INDIVIDUAL / COMPANY / SMSF / fixed unit trusts (only DISCRETIONARY_TRUST and UNIT_TRUST_NON_FIXED attract it).
6. Foreign surcharge == 0 when `!isForeignOwner`; residential-only states apply it only to residential parcels.
7. NT total == $0 always (structural zero config).
8. Float ≡ Decimal parity per state per input.

## independentExpectation

Legislated, per state, cited IN the config objects (verified at HEAD, `lastReviewed: '2026-05-05'`):
NSW Land Tax Act 1956 s10/s27/s5A/Sch 1A · VIC Land Tax Act 2005 Sch 1/s46IB/s46IC · QLD Land Tax
Act 2010 s32/Sch 1/Sch 3 · SA Land Tax Act 1936 s5/s13 · WA Land Tax Act 2002 s5 · TAS Land Tax Act
2000 s11 · ACT Rates Act 2004 + Land Tax Act 2004 · NT: no regime. The schedule figures themselves
(e.g. NSW CY2025 threshold $1,075,000; top bracket $88,036 + 2% over $6,571,000) are the code's
claims citing those Acts — **this contract did not independently re-confirm each state's current-year
figures against the revenue offices** (see coverageBoundary). An hand-recompute from the config
tables is always possible (invariant 2), so the quantity is NOT unverifiable — but the config-to-law
freshness check is a review-schedule task the file currently lacks (no `reviewSchedule` equivalent).

## surfaces

| Route | Label |
|---|---|
| AI tax advisor (chat, `/dashboard/cfo` advisor) | `getLandTaxPosition` / `runLandTaxScenario` tool outputs (per-state assessment + total, scenario delta) |
| `/api/tax/entity/[entityId]` → `/dashboard/entities/[id]/tax` | `crossCutting.landTax` in the master tax position — **currently INERT: no production caller constructs `input.landTax`** (grep for `landTax:` input construction finds none outside the engine/tests). Dormant capability, not a rendered number. |
| `/dashboard/properties` | `landTaxDueDate` reminder date ONLY — no dollar figure (and none is implied). |

**Finding:** land tax has NO always-on dashboard surface. The only user-reachable dollar figures flow
through the AI advisor tools. A missed-surface risk for the Number Ledger is therefore low, but the
"documented capability never wired" pattern (entity-route `landTax` input) should be recorded in the
gate pack as a dormant-wiring finding, not a bug.

## expectedMoves

**NONE.** No Phase B tranche migrates land tax (it is already single-sourced per quantity). Predicted
movement across all tranches: **zero** on every land-tax figure. Any land-tax delta in a golden-baseline
diff is a defect. `pathPrefixes` expected to move: `[]`.

## decisionsRequired

1. **Where do state-legislated constants live?** D12 says "every legislated constant reads from
   `TAX_YEAR_CONFIGS`", but land-tax schedules are state-based, mixed CY/FY, and 8-way — they live as
   per-state `LandTaxConfig` objects inside `stateLandTax.ts` (Act-cited, single home, registry +
   `getLandTaxConfig`). Options: (a) declare `LandTaxConfig` a RECOGNISED sibling constant-SSOT
   (extend D12's wording to "the canonical config registry for its jurisdiction"); (b) physically move
   the tables under `lib/tax-engine/config/`. Consequence: (a) is zero-risk documentation; (b) moves
   no numbers but churns imports. Either way the rule should stop implying these constants are misplaced.
2. **Review schedule for state schedules:** configs are pinned at CY2025/FY24-25 with
   `lastReviewed 2026-05-05` and no forced review checkpoint (unlike `TAX_YEAR_CONFIGS.reviewSchedule`).
   NSW indexes its threshold annually — CY2026 will differ. Add a `reviewSchedule` to `LandTaxConfig`?
   (Consequence of not: honest-stale drifts to wrong-stale silently at the next indexation.)
3. **NSW trust-surcharge inline literal:** `calculateLandTax` hardcodes `1_075_000 × 0.015`
   (stateLandTax.ts ~:420) rather than reading `config.generalThreshold`/`trustSurchargeRate` — the
   documented v1 simplification. Fold into config in Phase B, or leave until the progressive trust
   scale ships? (No number movement either way at current values.)
4. **Wire or park the entity-route `landTax` input:** the orchestrator supports it; nothing feeds it.
   Wiring it is NEW surface work (MON-136 class), not a MON-131 migration — record which wave owns it.

## coverageBoundary

- **Verifies:** all 8 census sites classified at HEAD; both producers + twins + config tables +
  citations read in source (`stateLandTax.ts` 715 lines skimmed in full structure, bracket/surcharge
  legs read verbatim; `crossStateAggregator.ts` grouping logic read); consumer sweep across `lib/`,
  `app/`, `components/` (`calculateLandTax|CrossStateLandTax` + `landTax` input construction).
- **Does NOT verify:** each state's CURRENT-year statutory figures against the revenue offices (the
  config's own citations are the evidence trail; freshness is decision 2); the correctness of
  `taxableLandValue` FACTs upstream (site-value vs market-value confusion is an intake risk this
  engine cannot see); the ACT's rates-vs-land-tax split nuance; runtime AI-tool rendering (Ring 3).
- **Stale-anchor report:** none — all census anchors resolve at HEAD (two unit-name artifacts and one
  false positive documented per-row above are census-method quirks, not drift).

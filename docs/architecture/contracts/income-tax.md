# income-tax — Quantity Contract (MON-131 Phase A)

> Read-only Phase A contract (brief `docs/issues/handoffs/CODE_BRIEF_MON-131_PHASE_A_quantity-contracts.md` §3).
> All anchors verified at HEAD 2026-07-29. Nothing in this file changes code.

## classification

**DERIVED.** Computed from FACTS (Income/Expense/Loan/DepreciationSchedule rows + HouseholdProfile)
via the ITAA 1997 s4-10 progressive bracket walk. Never stored (audit snapshots excepted, D2).

Three named layers, one lineage — do NOT collapse them to one scalar (D6):

| Layer | Field | Semantic |
|---|---|---|
| `taxOnIncome` | `TaxCalculation.taxOnIncome` | bracket walk on taxable income, PRE-offsets, PRE-Medicare |
| `grossTax` | `TaxCalculation.grossTax` | `taxOnIncome + medicareLevy + medicareSurcharge` |
| `netTax` | `TaxCalculation.netTax` | `grossTax − offsets`; NON-refundable offsets (LITO/SAPTO) capped at grossTax, but REFUNDABLE franking credits subtract WITHOUT a floor (`taxOffsets.ts:434-450`) — netTax CAN be negative when franking credits exceed remaining tax |

## semantic

- **Basis:** Australian FY (1 Jul – 30 Jun), resident individual, tax-free threshold claimed.
  Per-FY brackets read from `TAX_YEAR_CONFIGS` (D12) — FY2026-27 live (15% lowest band,
  Treasury Laws Amendment (More Cost of Living in Every Pocket) Act 2025).
- **Input:** taxable income (see `taxable-income.md` contract — assessable − deductions, ≥ 0).
- **Includes:** base amount of the applicable bracket + rate × dollars into the bracket
  (`incomeInBracket = taxableIncome − bracket.min + 1`, matching ATO "each $1 over $X").
- **Excludes:** Medicare levy/MLS (separate quantity, single-sourced), Div 293 (separate
  add-on, `calculateDivision293TaxAmount`), HECS (not implemented), non-resident scales.
- **Units:** AUD/yr. Float path rounds to cents (`Math.round(tax*100)/100`); Decimal twin
  2 dp HALF_EVEN at the output boundary.
- **Household vs member:** `getUserTaxPosition` returns the household roll-up (all rows, one
  bracket walk — must be LABELLED as roll-up) AND `perMember[]` per-individual positions
  (MON-076: AU tax is per individual). Two named views, same engine.

## canonicalHome

- **Core:** `lib/tax-engine/core/incomeTaxCalculator.ts:21` `calculateIncomeTax`
  **Decimal twin:** same file `:181` `calculateIncomeTaxDecimal`. They migrate together.
- **Position composer:** `lib/tax-engine/position/taxPositionCalculator.ts:153`
  `calculateTaxPosition` / `:714` `calculateTaxPositionDecimal` (Medicare + offsets + PAYG).
- **User-level assembler (the ONE fetch+assemble, MON-020/060):**
  `lib/tax-engine/position/userTaxPosition.ts:86` `getUserTaxPosition` — returns
  `taxPosition` + the exact `engineInputs` so the Decimal twin runs on identical inputs.

## callSites

Verified at HEAD. C = CONSUMER · D = DUPLICATE (re-derives; delete/migrate) ·
DQ = DIFFERENT-QUANTITY (survives under its own name).

| Site | Tag | Actual arithmetic in words |
|---|---|---|
| `app/api/tax/position/route.ts:35-37` | C | `getUserTaxPosition` bundle; Decimal twin on `bundle.engineInputs` (same inputs by construction) |
| `lib/cfo/decisionSupport/taxIntegration.ts:101` | C | CFO/My Guide reads `getUserTaxPosition` (post-MON-020) |
| `app/api/cashflow/intelligence/route.ts:697` + `buildTaxOptimization:431` | C | reads bundle; `estimatedTax = round(netTax)` (`:437`) — but recommendation heuristics hardcode `27500` and `× 0.34` (`route.ts:464`) — D12 debt inside a consumer |
| `lib/services/masterFinancialService.ts:1966` | C | master snapshot `taxSummary` = adapter over `getUserTaxPosition` (feeds Activity Sankey + portal dashboard) |
| `lib/tax-engine/entity/entityTaxRouter.ts:332,762` | DQ | **per-entity tax position** (PERSONAL/SOLE_TRADER wraps the engine; SMSF 15%, company rates differ) — a legitimately different quantity: "entity X's tax", not "the user's personal tax" |
| `lib/tax-engine/orchestrator/masterTaxPosition.ts:245,588` | DQ | household-wide multi-entity roll-up + land tax/stamp duty/GST — different quantity ("master tax position across entities") |
| `app/api/tax/super/optimize/route.ts:85,99,121,254,259` | C⚠ | calls canonical `calculateIncomeTax` but feeds it **gross salary** as taxable income (no deductions) — right formula, wrong-input scenario basis. See decisionsRequired #1 |
| `lib/tax-engine/core/incomeTaxCalculator.ts:127,144` (+Decimal `:245,:266`) | C | `calculateMarginalTax` / `calculateDeductionSavings` = deltas of two canonical calls — consumers, not producers |
| `lib/tax-engine/config/taxYearConfig.ts:531,545` | C | `getMarginalRate`/`getTaxBracket` — bracket LOOKUP from config, no tax derivation. ⚠ default `config = TAX_YEAR_2024_25`, not current FY |
| `components/dashboard/EntityCashflowSummary.tsx:642,693` | **D** | `marginalTaxRate: number = 0.37` default; `taxBenefit = principal × (rate/100) / 12 × 0.37`. Both callers (`app/dashboard/page.tsx:996,1012`) omit the arg → **every user gets a hardcoded 37% marginal rate** on the Home entity-cashflow tile. D12 violation, verified at HEAD |
| `app/dashboard/income/page.tsx:359-360` | **D** | catch-fallback grosses up/down at a flat 30%: `annualAmount / 0.7`, `× 0.7` — invented rate (see payg contract for `:356`) |
| `lib/strategy/analyzers/taxAnalyzer.ts:38-44` | C⚠ | marginal rate via canonical `getMarginalRate` on inferred income; **`0.30` documented fallback** when income unknown (`:44`) — constant typed in a lib |
| `lib/cgt/cgtCalc.ts:312,338` | DQ | CGT tax = discounted gain × marginal rate — different quantity ("CGT on a disposal"), rate should trace to the canonical position's marginal |
| `lib/investments/yield.ts:108` `calculateDividendTax` | DQ | tax on grossed-up dividend − franking credit, at caller-supplied marginal rate — different quantity ("after-tax dividend"), corporate rate constants `0.30/0.25` at `yield.ts:51-52` are legislated constants outside `TAX_YEAR_CONFIGS` (D12) |
| `lib/tax-engine/super/smsfIncomeTax.ts:151,329` | DQ | SMSF fund tax at 15% — different quantity (fund, not individual) |
| `lib/tax-engine/income/salaryProcessor.ts` | C | tax legs via PAYG schedule + Medicare (see payg contract) — salary-preview quantity |

**Census remainder NOT EXAMINED:** the `incomeTax` census section lists 77 heuristic sites;
23 were examined above or are the canonical family itself. The remaining ~54 (e.g.
`formatPercent`, `getAvailableTaxYears`, `mapBankSuppliedCategory`, gst/stampDuty/landTax
`applyBrackets` — different quantities with their own tranche, neobrain prompt builders,
what-if UI ergonomics `what-if/[lever]/page.tsx:415-425` which hardcodes `0.12`/`30_000`
super constants, not income tax) were spot-classified as census false-positives or
other-quantity sites but NOT individually audited. Coverage boundary below.

## invariants

FY2026-27 bracket walk recomputed from `TAX_YEAR_2026_27.brackets`
(`lib/tax-engine/config/taxYearConfig.ts:277-283`) on the live taxable income **$145,426**:

```
bracket: 135,001–190,000, baseAmount 31,020, rate 0.37
incomeInBracket = 145,426 − 135,001 + 1 = 10,426
taxOnIncome     = 31,020 + 10,426 × 0.37 = 31,020 + 3,857.62 = 34,877.62  (≈ $34,878 pre-offsets)
medicareLevy    = 145,426 × 0.02 = 2,908.52                               (≈ $2,909)
netTax          = 34,877.62 + 2,908.52 − 0 (LITO=0 above $66,667) = 37,786.14 (≈ $37,786 golden baseline)
```

Matches `tests/tax/mon106Fy2026_27Config.test.ts:66` (Ring-0 lock) and the golden baseline
(`REFERENCE_NUMBERS_DESIGN.md` §10: tax net $37,786 · Medicare $2,909).

Permanent-test properties: tax(≤18,200)=0 · monotonic non-decreasing in taxable income ·
continuous at every bracket boundary (P0 2026-06-23 regression class: strict `<`, never `<=`) ·
`netTax ≥ −frankingCredits` and `netTax ≥ 0` whenever franking credits are 0 (adversarial
correction 2026-07-29: refundable franking credits subtract UNFLOORED in `applyOffsets`,
`taxOffsets.ts:449-450` — a negative netTax is the refund mechanism, not a bug) ·
`netTax ≤ grossTax` · Float ≡ Decimal within cent tolerance ·
same engine + same inputs on every surface (A3 convergence).

## independentExpectation

ITAA 1997 s4-10 progressive scale, FY2026-27 rates as enacted by the More Cost of Living in
Every Pocket Act 2025 — encoded with citation in `TAX_YEAR_2026_27` (`taxYearConfig.ts:247-283`).
Expectation is the hand bracket-walk above, from the config constants, never from memory.

## surfaces

| Route | Label |
|---|---|
| `/dashboard/tax` | full tax position (via `/api/tax/position`, Decimal render) |
| `/dashboard/cfo` | My Guide taxInsights block (`cfo/page.tsx:836`) |
| `/dashboard/plan` | hero numbers via `/api/cashflow/intelligence` taxOptimization |
| `/dashboard/activity` | Money-flow Sankey "Tax" node (`ConsumerMoneyFlowSankey.tsx:84` ← master `estimatedTaxPayable`) |
| `/dashboard` (Home) | EntityCashflow tile tax-benefit column (currently the 0.37 duplicate) |
| `/dashboard/entities/[id]/tax` | per-entity position (DIFFERENT-QUANTITY surface) |
| `/portal` clients | `ClientCanonicalDashboard.tsx:181` `estimatedTaxPayable` |
| `/dashboard/reports` → Tax-Time report | currently the taxTime DUPLICATE (see deductions contract) |

## expectedMoves

- **NO movement** (strongest prediction): golden-baseline paths under
  `lib/tax-engine/position/userTaxPosition:getUserTaxPosition` — `taxPosition.tax.taxOnIncome`
  ($34,877.62), `tax.medicareLevy` ($2,908.52), `tax.netTax` ($37,786.14), and every consumer
  surface reading them (`/dashboard/tax`, CFO, /plan, Activity Sankey, portal). The migration
  is consumer-repointing; the canonical producer is untouched.
- **MOVES:** Home `/dashboard` EntityCashflow `taxBenefit` per deductible loan — from
  `interest × 0.37` to `interest × (user marginal from canonical position = 0.37 for this
  user at $145,426)` — for Reza's data the VALUE is coincidentally unchanged; for any user
  in another bracket it changes by `interest × (0.37 − trueMarginal)`.
- **MOVES:** income-page catch-fallback preview (`/0.7`,`×0.7`) — replaced by canonical
  call or an honest "estimate unavailable" state; only visible when `/api/tax/salary` fails.

## decisionsRequired

1. **`/api/tax/super/optimize` basis:** it taxes GROSS SALARY with no deductions. Option (a)
   keep as a named scenario quantity "salary-only tax estimate" with a label; option (b)
   migrate to `getUserTaxPosition` marginal-delta math. (b) is more correct for users with
   large deductions (this user: $172K deductions → gross-salary basis overstates savings rate).
2. **EntityCashflowSummary tax-benefit column:** replace 0.37 with the canonical position's
   marginal rate (per owner-member once MON-076 perMember is surfaced), or drop the column?
   Dropping removes an invented per-loan number; keeping requires plumbing the position.
3. **`getMarginalRate`/`getTaxBracket` default config = `TAX_YEAR_2024_25`** (`taxYearConfig.ts:531,545`)
   — silently two FYs stale for any caller omitting the config. Change default to
   `getCurrentTaxYearConfig()`? (Behaviour change: 16% → 15% band for low incomes.)

## coverageBoundary

READ end-to-end: `incomeTaxCalculator.ts`, `taxPositionCalculator.ts`, `userTaxPosition.ts`,
`taxYearConfig.ts`, `taxIntegration.ts` (partial: 355-395 + header), `cashflow/intelligence`
route (420-470 + imports), `masterFinancialService.ts` (1340-1990 excerpts), `taxAnalyzer.ts`
(1-60), `yield.ts` (85-140), EntityCashflowSummary (630-710), income page (330-390),
dashboard page (985-1023), super/optimize (grep only — NOT read end-to-end). NOT examined:
~54 of 77 census-heuristic sites (listed rationale above), `lib/cfo/scenarios/*`,
`lib/neobrain/*` prompt builders, `entityTaxRouter.ts` full body, `masterTaxPosition.ts`
below line 60, all `lib/calc-audit/*` adapters (test infrastructure), portal/practice files.
Per-entity tax and CGT get their own contracts (other agents / MON-136).

## Adversarial review (§7) — 2026-07-29

- **Claims checked: 43** (anchors 31 · arithmetic 8 · negative-claims 4)
- **REFUTED / CORRECTED: 4**
  1. **`netTax` "floored ≥ 0" — REFUTED** (semantic + invariant). `applyOffsets`
     (`lib/tax-engine/core/taxOffsets.ts:434-450`) caps only NON-refundable offsets at grossTax
     (`Math.min(nonRefundableOffsets, grossTax)` :444); refundable franking credits then subtract
     with NO floor (`netTax = taxAfterNonRefundable - refundableOffsets` :450), and
     `calculateTaxPosition` takes the result unfloored (`taxPositionCalculator.ts:351`). netTax
     is negative whenever franking credits exceed remaining tax — that IS the refundable-credit
     mechanism. Layer table + invariant corrected inline. (Golden worked example unaffected:
     franking = 0 on the live data; $37,786.14 recomputation verified against
     `taxYearConfig.ts:277-283`, `tests/tax/mon106Fy2026_27Config.test.ts:66`, and
     `lib/matrix/goldenBaseline.ts:76-77`.)
  2. Anchor drift: the $27,500/×0.34 hardcode is at `app/api/cashflow/intelligence/route.ts:464`,
     not `:465`. Fixed inline (super-cap contract already had :464).
  3. Anchor drift: super/optimize scenario-3 `calculateIncomeTax` calls are at `:254,:259`
     (`:255,:260` are the adjacent `calculateMedicareLevy` calls). Fixed inline. The load-bearing
     claim (gross salary fed as taxable income, no deductions) is VERIFIED (`:85` +
     `taxableIncome: grossSalary` at `:89`).
  4. **callSites under-count — three same-class hardcoded-rate sites the contract missed**,
     found by independent rate-grep:
     - `lib/cfo/decisionSupport/investmentDecisionSupport.ts:297` — `unrealisedCGT += taxableGain * 0.37`
       (invented marginal rate inside the CFO CGT estimate; CGT is a DQ but the RATE input is the
       same invented-0.37 class as the EntityCashflowSummary D).
     - `lib/depreciation/schedule.ts:72` `TAX_RATE_32_5 = 0.325` used at `:145`
       (`taxSavingAt32_5Percent = totalDepreciation × 0.325`) — a STALE rate: the 32.5% band was
       abolished from FY24-25 (config has no 0.325 bracket). Sibling consts `TAX_RATE_37/45`
       (:73-74) are unused/dead. Belongs to the depreciation contract's file scope but is an
       income-tax-rate hardcode; flagged to both.
     - `app/dashboard/tax/page.tsx:749` — inline `deductions.total × (marginalRate/100)` rendered
       as "Tax savings at X% marginal rate" — a linear re-derivation on a surface where the
       canonical `calculateDeductionSavings` (two-bracket-walk delta, `incomeTaxCalculator.ts:144`)
       exists. A DUPLICATE-shape surface site.
- **Could not verify:** the ~54 unexamined census sites (contract's own stated boundary — spot
  hunts above found the three sites listed; no exhaustive audit of the remainder); registry
  MON-020/060/076 entry texts (registry not re-read); FY26-27 Act name against the legislation
  itself (config citation trusted per §19.2 source rule).
- **Verdict impact:** classification/producer map UNCHANGED (canonical home, DQ set, and both
  D findings all verified exact — EntityCashflowSummary `:642` default 0.37 with both callers
  `app/dashboard/page.tsx:996,1012` omitting the arg, and income-page `:359-360` confirmed
  byte-exact at HEAD). The netTax semantic is materially corrected: any Phase B invariant suite
  asserting `netTax ≥ 0` unconditionally would reject legitimate franking refunds. Duplicate
  register grows by the three rate-hardcode sites above.

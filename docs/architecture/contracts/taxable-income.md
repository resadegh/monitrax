# taxable-income — Quantity Contract (MON-131 Phase A)

> Read-only Phase A contract. Anchors verified at HEAD 2026-07-29.

## classification

**DERIVED.** `taxableIncome = max(0, assessableIncome − totalDeductions)` (ITAA 1997 s4-15).
Never stored.

## semantic

- **Basis:** Australian FY, resident individual, household roll-up (plus MON-076 `perMember`
  partitions — per-individual taxable income, the legally assessed unit).
- **Assessable income** (the minuend): every Income row, annualised via `toAnnual` when
  recurring, counted ONCE when `isRecurring === false` (MON-053), `grossAmount` preferred for
  salary; classified by `determineTaxability` (non-assessable `taxCategory` rows → $0, MON-094);
  franking credits GROSSED UP into dividends (s207-20).
- **Deductions** (the subtrahend): see `deductions.md` contract — auto-derived deductible
  property-loan interest + deductible expense rows + depreciation.
- **Floor:** never negative (`Math.max(0, …)` / `Decimal.max(0, …)`).
- **Units:** AUD/yr.

## canonicalHome

Not a standalone exported function — computed INSIDE the position engine:

- `lib/tax-engine/position/taxPositionCalculator.ts:310-311` (Float:
  `taxableIncome = Math.max(0, assessableIncome − deductionBreakdown.total)`)
- **Decimal twin:** same file `:855-856` (`Decimal.max(zero, assessable.minus(total))`)
- **Assembler:** `lib/tax-engine/position/userTaxPosition.ts:86` `getUserTaxPosition`.

Phase B option: whether to extract it as a named export or leave it internal to
`calculateTaxPosition` is a design choice — either way there must be exactly ONE derivation.

## callSites

| Site | Tag | Actual arithmetic in words |
|---|---|---|
| `app/api/tax/position/route.ts:35-37` | C | renders `tax.taxableIncome` from the bundle (Decimal twin on same inputs) |
| `lib/cfo/decisionSupport/taxIntegration.ts:101` | C | reads bundle |
| `lib/services/masterFinancialService.ts:1966` | C | adapter over the bundle |
| `lib/calculations/cashflowOrchestrator.ts:333` (+Decimal `:560`) | **DQ (mislabeled)** | `taxableIncome += monthlyGross × 12` for every `isTaxable !== false` row — **no deductions, no taxability engine, no franking gross-up, no one-off gate**. This is "annualised taxable-FLAGGED gross income", not taxable income. Field name lies. Highest-value flag in this contract |
| `lib/reports/generators/taxTime.ts:21-30` | **D** | report re-derives BOTH sides: `taxableIncome = Σ isTaxable annualAmount`; `netTaxableIncome = that − (Σ deductible + Σ depreciation)` — omits MON-045 auto loan interest, MON-053/037 one-off gates, MON-094 taxability, franking. A parallel position that WILL disagree with `/dashboard/tax`. Migrate to `getUserTaxPosition` |
| `lib/tax-engine/income/salaryProcessor.ts:46` | DQ | `taxable = annualGross − salarySacrifice` — salary-only preview quantity for `/api/tax/salary`; legitimate, needs its own name ("salary taxable estimate") |
| `app/api/tax/super/optimize/route.ts:85-260` | DQ | `taxable = grossSalary − sacrifice` scenario basis (see income-tax contract decision #1) |
| `lib/tax-engine/core/*` (medicare, offsets, incomeTax) | C | take taxableIncome as an INPUT parameter — consumers |
| `lib/tax-engine/super/contributionCalculator.ts:243,272` | C | Div 293 (`:243-248`) / co-contribution (`:272-273`) take taxable income as input. ⚠ adversarial correction 2026-07-29: the previously co-cited `capTracker.ts:297` (`getOptimalContributionStrategy`) takes **gross salary + marginal rate**, NOT taxable income — cite removed |
| `lib/tax-engine/divisions/negativeGearing.ts:152,346` | C/DQ | adjusts taxable income for regime-gated rental-loss offset — **DORMANT at HEAD: zero production callers** (calc-audit fixtures only; see negative-gearing contract). NOT wired into the entity-router path today; a second base derivation it is not, a live transformation step it is not either |
| `app/api/portfolio/snapshot/route.ts:964-970` (+`:1089-1091`) | **D/DQ (found by adversarial pass 2026-07-29)** | the snapshot "TAX EXPOSURE" block re-derives BOTH sides: `taxableIncome = Σ isTaxable toAnnual(amount)` (:964-966), `deductibleExpenses = Σ isTaxDeductible toAnnual(amount)` (:968-970), and serializes `estimatedTaxableIncome = taxableIncome − deductibleExpenses` (:1091) — no taxability engine, no franking gross-up, no one-off gate, no auto loan interest, **no ≥0 floor**. A live parallel taxable-income derivation in `SnapshotV2` |
| `lib/reports/generators/incomeExpense.ts:20-21` | **D (found by adversarial pass 2026-07-29)** | second report generator re-deriving `taxableIncome` (Σ isTaxable annualAmount) + `deductibleExpenses` — same shape as the taxTime DUPLICATE, rendered in the Income & Expense report (`:65`) |

**Census remainder NOT EXAMINED:** census `taxableIncome` section = 38 heuristic sites;
~20 examined/classified above (incl. the whole canonical family). Remainder (~18: calc-audit
adapters, `salarySacrificeToSuper` scenario, `getMedicareSummary`, `testing/exporter`) not
individually audited. ⚠ adversarial correction 2026-07-29: the earlier spot-classification of
the `portfolio/snapshot` census hit as "census false positive — linkage math" was WRONG — the
flagged unit (`calculateLinkageHealth`) is indeed linkage math, but the same file hosts the
live TAX EXPOSURE producer now tabled above.

## invariants

From the golden baseline (`REFERENCE_NUMBERS_DESIGN.md` §10) and the design record:

```
assessableIncome (declared gross)  = $317,751
deductions.total                   = $172,325
taxableIncome = 317,751 − 172,325  = $145,426   ✓ equals the baseline's "taxable $145,426"
```

Permanent-test properties: `taxableIncome === max(0, income.total − deductions.total)` on
every path (additivity is definitional — assert it as a cross-field identity on the result
object) · `taxableIncome ≥ 0` · Float ≡ Decimal · a non-assessable income row changes
taxableIncome by $0 (MON-094 fixture) · a one-off income row stored MONTHLY contributes its
amount ONCE, not ×12 (MON-053 fixture).

## independentExpectation

ITAA 1997 s4-15 (`taxable income = assessable income − deductions`). Arithmetic identity —
checkable without any other screen: sum the engine-input rows by the stated semantic and
subtract the deductions contract's total. Franking gross-up per s207-20 via
`determineTaxability` (`lib/tax-engine/income/taxabilityRules.ts` — not re-read this pass).

## surfaces

| Route | Label |
|---|---|
| `/dashboard/tax` | "Taxable income" line of the position |
| `/dashboard/cfo` | inside taxInsights |
| `/dashboard/activity` | indirectly (Sankey tax node derives from it) |
| `/dashboard/reports` → Tax-Time report | "Net Taxable Income" metric — currently the DUPLICATE derivation |
| `/dashboard/entities/[id]/tax` | per-entity taxable income (different quantity, entity router) |
| `/dashboard/cashflow` (orchestrator consumers) | `CashflowResult.taxableIncome` — the MISLABELED quantity |

## expectedMoves

- **NO movement:** canonical `getUserTaxPosition → tax.taxableIncome` stays $145,426; so do
  `/dashboard/tax`, CFO, master-snapshot consumers.
- **MOVES:** Tax-Time report `Net Taxable Income` when migrated to the bundle — current value
  = Σ(isTaxable annualAmount) − Σ(deductible)+Σ(dep) with no auto-interest/one-off gates;
  post-migration = $145,426. Direction depends on data (auto loan interest missing today
  pushes the report's taxable HIGHER than canonical; raw ×frequency one-offs push it either way).
- **RENAME, no value change:** `cashflowOrchestrator.CashflowResult.taxableIncome` → a
  truthful name (e.g. `annualTaxableFlaggedGross`) — the number itself doesn't move, the
  label stops lying. If instead it is DELETED in favour of the bundle, its consumers move.

## decisionsRequired

1. **`cashflowOrchestrator.taxableIncome`:** rename to its true semantic, or delete and have
   consumers read the canonical position? Renaming preserves a cashflow-context estimate;
   deleting enforces one producer but adds an async dependency to a pure engine. (The engine
   is pure/sync; `getUserTaxPosition` is async+DB — structural fork Reza should pick.)
2. **taxTime report basis:** migrate to `getUserTaxPosition(userId, fy)` (correct, matches
   the tax page) vs keep a "declared-rows" report view (would need explicit labelling).
   Recommend migrate — a tax-filing report that disagrees with the tax page is indefensible.

## coverageBoundary

READ: both derivation blocks in `taxPositionCalculator.ts` (Float+Decimal, full file),
`userTaxPosition.ts` (full), `cashflowOrchestrator.ts:300-360` + grep for Decimal twin,
`taxTime.ts:1-60`, `salaryProcessor.ts:40-110`. NOT read: `taxabilityRules.ts` internals
(taxability classification trusted per MON-094 comments — flag for the adversarial pass),
`negativeGearing.ts` bodies, super contribution calculators beyond grep, calc-audit adapters,
the ~18 unexamined census sites listed above, `entityTaxRouter.ts` per-entity assembly.

## Adversarial review (§7) — 2026-07-29

- **Claims checked: 24** (anchors 15 · arithmetic 4 · negative-claims 5)
- **REFUTED / CORRECTED: 4**
  1. **Missed LIVE duplicate producer — the contract's highest-value miss.**
     `app/api/portfolio/snapshot/route.ts:964-970` + `:1089-1091` re-derives taxable income
     end-to-end (`taxableIncome`, `deductibleExpenses`, `estimatedTaxableIncome = difference`,
     unfloored) inside the snapshot "TAX EXPOSURE" block. The contract's census-remainder note
     had dismissed the `portfolio/snapshot` hit as "census false positive — linkage math"; the
     flagged UNIT was linkage math, but the file hosts this producer. Corrected inline
     (callSites row added, remainder note rewritten).
  2. **Second missed report duplicate:** `lib/reports/generators/incomeExpense.ts:20-21`
     (Σ isTaxable / Σ isDeductible, rendered at `:65`) — same class as the taxTime D the
     contract did catch. Added inline.
  3. **`negativeGearing.ts:152,346` described as "a transformation step in the entity router
     path" — REFUTED.** `applyNegativeGearing` has zero production callers at HEAD (independent
     grep: only `lib/calc-audit/engines/decimal-tax-engine-loss.ts` imports it); it is dormant,
     consistent with the negative-gearing contract. Cross-contract inconsistency resolved in
     favour of the code. Corrected inline.
  4. **`capTracker.ts:297` mis-described:** `getOptimalContributionStrategy(grossSalary,
     currentConcessional, marginalRate, …)` takes gross salary, not taxable income
     (`capTracker.ts:297-301` verified). Cite removed from the Div293/co-contribution row;
     the `contributionCalculator.ts:243-244/:272-273` half of that row is correct.
- **Could not verify:** `taxabilityRules.ts` internals (the contract itself flagged this as
  trusted-not-read; unchanged — franking gross-up behaviour is still asserted from MON-094
  comments, not re-derived); the ~16 remaining unexamined census sites beyond the two the
  hunt surfaced.
- **Verdict impact: YES — material.** The canonical derivation (`taxPositionCalculator.ts:311`
  Float / `:855-856` Decimal, verified byte-exact) stands, and the golden identity
  317,751 − 172,325 = 145,426 reconciles against `goldenBaseline.ts:76-77` and
  REFERENCE_NUMBERS_DESIGN.md §10 (:224). But the quantity is MORE multiple than the contract
  stated: beyond the orchestrator mislabel (verified at `:333`/`:560`) and the taxTime report D
  (verified at `:21-29`), there are TWO further live re-derivations (snapshot route, incomeExpense
  report). Phase B's consumer-repointing list must include both, and the Number Ledger's surface
  list gains the Home/portfolio snapshot consumers and the Income & Expense report.

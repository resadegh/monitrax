# deductions — Quantity Contract (MON-131 Phase A)

> Read-only Phase A contract. Anchors verified at HEAD 2026-07-29.

## classification

**DERIVED.** The FY deductible aggregate feeding taxable income. Inputs are FACTS
(Expense rows with `isTaxDeductible`, Loan rows, DepreciationSchedule rows,
LoanTransaction INTEREST_CHARGED ledger rows). Never stored.

## semantic

The canonical `DeductionBreakdown` (FY, household roll-up; per-member partitions via MON-076):

1. **Auto-derived deductible property-loan interest** (MON-045) — the ONE interest source
   `deductiblePropertyLoanInterest` (`lib/tax-engine/deductions/propertyLoanInterest.ts:71`):
   actuals-first Σ INTEREST_CHARGED ledger rows this FY, else `(principal − offsetBalance) ×
   interestRateAnnual × deductibleFraction`. Deductible ONLY when the owning property's
   `type !== 'HOME'` (rule lives in the engine, never in callers). Loan-linked expense rows
   for auto-derived loans are SKIPPED (de-dup — interest never double-counted).
2. **Deductible expense rows** — `isTaxDeductible === true`, annualised ×frequency when
   recurring, counted ONCE when `isRecurring === false` (MON-037: an $11,385 battery stored
   MONTHLY is $11,385, not $136,620). Bucketed property / investment / other by linkage.
3. **Depreciation** — per schedule via the ONE engine `calculateDepreciationAnnual`
   (MON-026: `rate` is a PERCENTAGE, /100 inside), added to BOTH `depreciation` (display)
   and `property` (the summed bucket).

**Total identity:** `total = workRelated + property + investment + other` — `depreciation`
is NOT a separate addend (it is inside `property`); `workRelated` is currently always 0
(no writer populates it). Units AUD/yr.

## canonicalHome

- **Aggregation:** `lib/tax-engine/position/taxPositionCalculator.ts:238-307` (Float)
  — **Decimal twin** `:791-853`. Internal to `calculateTaxPosition`, like taxable income.
- **Interest producer:** `lib/tax-engine/deductions/propertyLoanInterest.ts:71`.
- **Depreciation producer:** `lib/depreciation` `calculateDepreciationAnnual`
  (consumed at `userTaxPosition.ts:220`).
- **Assembler:** `lib/tax-engine/position/userTaxPosition.ts:86`.

## callSites

| Site | Tag | Actual arithmetic in words |
|---|---|---|
| `app/api/tax/position/route.ts:35-37` | C | renders `deductions.*` from the bundle |
| `lib/cfo/decisionSupport/taxIntegration.ts:101` | C | bundle reader; `identifyMissedDeductions:361` produces gap PROMPTS (booleans/names), not amounts — not a producer |
| `app/api/cashflow/intelligence/route.ts:439` | C | `deductibleExpenses = round(taxPosition.deductions.total)` |
| `lib/services/masterFinancialService.ts:1966` | C | adapter over the bundle |
| `lib/reports/generators/taxTime.ts:24-29` | **D** | `deductibleExpenses = Σ isDeductible annualAmount` + `totalDepreciation = Σ annualDeduction`; omits MON-045 auto interest, MON-037 one-off gate, MON-045 de-dup → report deductions ≠ tax-page deductions on the same data |
| `lib/calculations/expenseAggregator.ts:105` (+Decimal `:239`) | **DQ (mislabeled risk)** | `taxDeductible += toMonthly/toAnnual(amount)` — "run-rate of deductible-FLAGGED expenses" for cashflow/budget context: no depreciation, no auto interest, no one-off gate, monthly basis. A legitimate cashflow-view quantity, NOT the tax deductions aggregate — must never be rendered as "deductions" on a tax surface |
| `lib/calculations/cashflowOrchestrator.ts:358` (+Decimal `:583`) | DQ | same shape: `taxDeductibleExpenses += monthly × 12` — annualised deductible-flagged run-rate, no dep/interest |
| `components/dashboard/EntityCashflowSummary.tsx:687-693` | DQ→see income-tax | classifies loans deductible by `type === 'INVESTMENT' || 'BUSINESS'` — a SECOND deductibility rule diverging from the engine's `propertyType !== 'HOME'` (a HOME-typed loan on a rental property, or vice versa, classifies differently) |
| `lib/tax-engine/divisions/negativeGearing.ts:152,346` | C | consumes property deductions vs rental income for regime gating |
| `lib/cfo/decisionSupport/taxIntegration.ts:440` `calculateUnrealisedCGTDecimal` | DQ | CGT cost-base math, not this quantity |
| `lib/cgt/costBase.ts:108,135` | DQ | CGT cost-base elements (capital, not deductions) |
| `lib/depreciation/div40.ts:210` / `div43.ts:103,214,268` / `schedule.ts:268` | DQ | the depreciation quantity's own producers (Phase A contract "depreciation", D11 — separate agent) |

**Census remainder NOT EXAMINED:** census `deductions` = 105 heuristic sites — the noisiest
of the four (its `nearArith('deduction|deductible')` signature catches UI handlers,
document parsers, folder trees). ~25 classified above; the remaining ~80 (e.g.
`FolderTree`, `downloadBlob`, `getPriorityIcon`, ExpenseWizard/ExpenseDialog form handlers,
intake detectors, onboarding sync, portal fixtures) were spot-checked as census false
positives or writers-of-FACTS (setting `isTaxDeductible` flags — intake concern, not a
derivation) and NOT individually audited.

## invariants

Golden baseline: **deductions.total = $172,325** with taxable $145,426 on assessable
$317,751 (the three reconcile exactly: 317,751 − 172,325 = 145,426).

Permanent-test properties:
- `total === workRelated + property + investment + other` (cross-field identity)
- `property ≥ depreciation` (depreciation folds into property)
- one-off deductible counted once (MON-037 fixture: monthly-stored $11,385 → $11,385/yr)
- an auto-derived loan's linked expense row contributes $0 (MON-045 de-dup fixture)
- HOME-property loan interest contributes $0 (deductibility gate fixture)
- the same DepreciationSchedule yields the same annual figure through every path (100× guard, D11)
- Float ≡ Decimal.

## independentExpectation

ITAA 1997 s8-1 (general deductions), Div 40/43 (depreciation), ATO TR 2000/2
(`deductibleFraction` apportionment for mixed-use borrowings) — the rule set is encoded in
`propertyLoanInterest.ts` + `lib/depreciation` with citations. Arithmetic identity check:
hand-sum the engine-input rows per the semantic above and compare to `deductions.total`.
For a given FY the interest leg is independently checkable as
Σ|INTEREST_CHARGED| ledger rows within FY bounds per loan.

## surfaces

| Route | Label |
|---|---|
| `/dashboard/tax` | deductions breakdown card |
| `/dashboard/cfo` | taxInsights deductions + missed-deduction prompts |
| `/dashboard/plan` | via `/api/cashflow/intelligence` deductibleExpenses |
| `/dashboard/reports` → Tax-Time | "Total Deductions" — currently the DUPLICATE |
| `/dashboard/entities/[id]/tax` | per-entity deductions (entity router — different quantity) |
| `/dashboard/properties/[id]` | property tax card (per-property slice) |

## expectedMoves

- **NO movement:** `getUserTaxPosition → deductions.total` stays $172,325; `/dashboard/tax`,
  CFO, /plan, master consumers unchanged.
- **MOVES:** Tax-Time report "Total Deductions" on migration to the bundle — current value
  omits auto-derived loan interest (report UNDERSTATES deductions for loan-bearing rentals)
  and skips the one-off gate (OVERSTATES when one-off deductibles are stored with a
  frequency). Post-migration = $172,325 for the live data. Both directions possible per user;
  pre-write the per-user arithmetic in the tranche PR.
- **RENAME, no value change:** `expenseAggregator.taxDeductible` and
  `cashflowOrchestrator.taxDeductibleExpenses` → truthful run-rate names, IF Reza keeps them
  as cashflow-context quantities (decision below).

## decisionsRequired

1. **Do the run-rate deductible sums survive as named quantities?** `expenseAggregator:105`
   and `cashflowOrchestrator:358` are cashflow-view estimates, not tax deductions. Options:
   (a) rename (`deductibleFlaggedRunRate`) and keep for budget surfaces; (b) delete and
   surface the canonical `deductions.total` everywhere. (a) preserves a real cashflow view;
   (b) maximises single-sourcing but changes budget-page semantics (annual tax aggregate on
   a monthly cashflow surface is a basis mismatch).
2. **EntityCashflowSummary loan-deductibility rule** (`type === INVESTMENT/BUSINESS`) vs the
   engine's property-type rule — collapse to the engine rule (requires property linkage on
   the tile's data) or drop the deductible flag from the tile?
3. **`workRelated` bucket is structurally always $0** — no writer categorises into it.
   Delete the bucket, or add a categorisation path? (Dead field today; the CFO "missed
   work-related deductions" prompt exists precisely because it's always empty.)

## coverageBoundary

READ: full deduction blocks in `taxPositionCalculator.ts` (Float + Decimal),
`userTaxPosition.ts` (full), `propertyLoanInterest.ts` header + signature (`:71` verified;
body NOT line-by-line audited — its worked-example verification belongs to the §19.2 pass),
`expenseAggregator.ts:60-110` + Decimal grep, `taxTime.ts:1-60`, `taxIntegration.ts:355-395`.
NOT read: `lib/depreciation/*` engine bodies (own contract, D11), ExpenseWizard/Dialog
writers (FACT intake), the ~80 unexamined census sites above, `entityTaxFactsAssembler.ts`,
`rentalReconciliation.ts:303` context, per-property tax card assembly.

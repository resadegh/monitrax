# propertyCashflow — per-property actuals-first cashflow

> MON-131 Phase A Quantity Contract. Census key: `propertyCashflowYield` (6 formula-shape sites — the
> census key bundles cashflow + yield; **yield is a genuinely different quantity and has its own
> contract**, `property-rental-yield.md`). READ-ONLY audit at HEAD `2f9f2e16`, 2026-07-29.

## classification

**DERIVED** (D1). Computed from FACT rows (`Income`, `Expense`, `Loan`) + FACT transactions
(`UnifiedTransaction`), one producer, never stored.

## semantic

- **Definition (headline):** `annualCashflow = annualRent − annualExpenses − annualLoanRepayment`
  (cash basis, P&I). Sibling: `annualTaxCashflow = annualRent − annualExpenses − annualLoanInterest`
  (interest-only — the deductible figure). Both are returned by the same engine call; they are two
  named outputs of one quantity family, never two producers.
- **Basis:** ACTUALS-FIRST per §19.1, via `monthlyResolver`: each money line is a true monthly figure
  read from reconciled transaction dates; the declared `amount × frequency` is the fallback only when
  transactions are insufficient to read cadence.
- **Window:** trailing 12 months — `propertyActualsWindowStart()` at
  `lib/calculations/propertyActualsWindow.ts:28` (`PROPERTY_ACTUALS_WINDOW_MONTHS = 12`, MON-035
  DECISION 2). All fetch sites import this ONE window.
- **Rent:** resolved at the PROPERTY-STREAM level — all rental transactions pooled across the
  property's `RENT`/`RENTAL` income rows (`propertyCashflow.ts:232-242`), so a rental fragmented into
  several Income records counts once. Rent is paid in advance (`isAdvance: true`).
- **Managed gross-up (Phase 59 / Wall B3):** when `rentalMode === 'MANAGED'` and rent ACTUALS drove
  the figure, the net agent payouts are grossed back up by the stream's derived recurring fee run-rate
  (`propertyCashflow.ts:254-271`); the fee is subtracted exactly once, in the expense loop. Declared
  amounts are already gross — no add-back.
- **Inclusions/exclusions:** one-off expenses (`isRecurring === false`) excluded from the run-rate
  (`propertyCashflow.ts:282`, MON-037; only an explicit `false` excludes). Loan cost per record via
  `resolveLoanMonthlyCost` (`propertyCashflow.ts:195`): actuals → declared `minRepayment`
  (cadence-normalised) → interest floor `principal × rate ÷ 12` — never silently $0.
- **Units:** AUD; monthly mirrors (`monthlyX`) and annual (`annualX = monthlyX × 12`).
  `Loan.interestRateAnnual` is a DECIMAL fraction (0.0649 = 6.49%) — stated at
  `propertyCashflow.ts:74`.
- **Basis flag:** output `basis ∈ {'actual','declared','mixed'}` + per-leg `usedActuals`; cadence
  contradiction surfaced via `rentCadenceSuspect` (MON-093/MON-096), never silently corrected.

## canonicalHome

`lib/calculations/propertyCashflow.ts:219` — `computePropertyCashflow(input): PropertyCashflow`.
Pure (no DB/fetch/mutation). Modelled in the Neomatrix (`engine.propertyCashflow.computePropertyCashflow`).

**Decimal twin: NOT ESTABLISHED.** No Decimal sibling of `computePropertyCashflow` exists (verified:
no `Decimal` import in the file; no `computePropertyCashflowDecimal` anywhere). If Phase B introduces
one it must migrate with the Float per design rule §7.4; today there is nothing to migrate.

**Canonical input assemblers (data-access services, not second producers):**
- `lib/services/propertyActuals.ts:121` `enrichPropertiesWithActuals` — batched trailing-12 fetch
  (window applied at `:132`), attaches `linkedTransactions`. Feeds detail route, list, portfolio
  snapshot, risk radar.
- `lib/services/masterFinancialService.ts:776` — same window applied to the master snapshot's own
  transaction fetch.
- `lib/services/loanCosts.ts:45` `resolveLoanCostsForUser` — loan-leg feed outside the property
  engine (loan-cost quantity, contract owned by MON-130/T2 — noted for the shared window only).

## callSites

All engine call sites at HEAD are **CONSUMER** — the migration to one producer for this quantity is
substantially **already done** (MON-002/009/035/036 lineage). Verified:

| Site | Tag | What it does |
|---|---|---|
| `lib/services/masterFinancialService.ts:1087` (`adjustPropertyRentalIncome`) | CONSUMER | pools rental income via the engine's `monthlyRent` into a synthetic MONTHLY income row for aggregate/tax dedup |
| `lib/services/masterFinancialService.ts:1256` (`buildPropertyMetrics`) | CONSUMER | per-property rent/expenses/loan/cashflow read straight from engine outputs |
| `app/api/portfolio/snapshot/route.ts:723` | CONSUMER | property snapshots (Home tile) from engine outputs |
| `app/dashboard/properties/page.tsx:472` (`cashflowOf`) | CONSUMER | list tiles: cashflow, loan repayment, interest from engine |
| `app/dashboard/properties/[id]/page.tsx:169` (`cashflowOf`) | CONSUMER | detail page KPIs from engine |
| `lib/cfo/riskRadar.ts:410` | CONSUMER | low-yield / negative-cashflow risks from engine outputs |
| `components/properties/PropertyExpensesCard.tsx:112` | CONSUMER | expenses-only decomposition — header total + rows from ONE call (`expenseLines`) |
| `app/api/properties/[id]/route.ts:69` (comment; route passes `linkedTransactions` through) | CONSUMER (feed) | detail route serializes engine inputs incl. transactions (MON-028 fix) |
| `lib/calculations/propertyCashflow.ts:195` `resolveLoanMonthlyCost` | DIFFERENT-QUANTITY | the loan-cost quantity's canonical producer, co-located in this file; consumed by the loan loop. Owned by the loan-cost contract (T2/MON-130) — do not treat as a duplicate of cashflow |

**Sibling inline aggregates on the same pages (NOT this quantity, noted so Phase B doesn't collide):**
`properties/page.tsx:452-465` (per-property LVR/equity — `propertyEquity` + `lvrGearing` quantities;
equity already delegates to `calculateEquity`), `properties/[id]/page.tsx:154-163` (`computeEquity`,
`computeLvr` — local re-derivations belonging to the `propertyEquity`/`lvrGearing` contracts).

## invariants

Checkable properties (several already locked by tests — `tests/calculations/propertyCashflow.test.ts`,
`tests/golden/properties.engines.test.ts`, `tests/golden/ring2.calcSsotWall.test.ts`):

1. `annualCashflow == annualRent − annualExpenses − annualLoanRepayment` (same basis, same call).
2. `annualTaxCashflow == annualRent − annualExpenses − annualLoanInterest`.
3. `Σ expenseLines[].annual == annualExpenses` and `Σ loanLines[].monthly == monthlyLoanRepayment`
   (by construction — same loop).
4. `annualX == monthlyX × 12` for rent/expenses/repayment.
5. An interest-only loan (`minRepayment` null/0, rate > 0, no actuals) contributes
   `principal × rate ÷ 12`, never $0 (`flooredToInterest = true`).
6. A one-off expense (`isRecurring === false`) contributes 0 to the run-rate.
7. `basis` is `'declared'` iff no contributing line used actuals, `'actual'` iff all did.
8. Cross-surface parity: list tile == detail page == Home tile == master snapshot per-property
   cashflow for the same property (same engine + same window + same feed — MON-035/036 parity tests).
9. A declared-vs-detected rent cadence contradiction sets `rentCadenceSuspect`, never silently
   re-annualises (MON-093).

## independentExpectation

**Arithmetic identity** (invariants 1–4) — checkable without reading another screen. For the rent leg,
the worked example of record: Broadbeach loan floor `228,000 × 0.0669 / 12 = 1,271.10`; linked
repayments `(2,426 / 62) × 30.4375 = 1,190.97/mo` actuals win (CHANGELOG_2026_07_17, Ring-2 test
`tests/golden/ring2.calcSsotWall.test.ts:78`). The actuals-first *policy* itself (trailing-12,
advance/arrears handling) is a Reza decision (MON-035 DECISION 2), not independently derivable — the
window choice is verified against the decision record, not against legislation.

## surfaces

| Route | Label |
|---|---|
| `/dashboard/properties` | per-tile "Cashflow" + hero aggregates (list page, engine via `cashflowOf`) |
| `/dashboard/properties/[id]` | KPI row cashflow / loan repayment / interest; Expenses card header + rows |
| `/` Home dashboard (property tile via `/api/portfolio/snapshot` `propertySnapshots[].propertyCashflow`, `monthlyCashflow`) | property cashflow on the Home tile |
| `/dashboard/cfo` (risk radar) | "Low yield: {name} … cash-flow negative" risk copy uses `annualCashflow` |
| Master snapshot consumers (`/api/master-snapshot` → `propertyMetrics[].monthlyCashflow`) | any surface reading master per-property metrics (not exhaustively traced — see coverageBoundary) |

## expectedMoves

- **NO MOVEMENT predicted** for list/detail/Home/master/riskRadar cashflow numbers from this
  contract: all sites are already consumers of the one engine over the one window. The strongest
  prediction this contract makes is that Phase B has nothing to migrate for the cashflow number
  itself.
- Movement WILL occur on these numbers if **MON-001** (fortnightly rent stored as monthly, FIXING) is
  fixed at the FACT layer: declared-fallback properties (no reconciled rent transactions) will see
  rent roughly ×2.17 (fortnightly→monthly correction). `pathPrefix`:
  `masterSnapshot.propertyMetrics[*]`, `portfolioSnapshot.propertySnapshots[*]`, properties
  list/detail KPIs — but only for `basis: 'declared'` rentals. Actuals-driven properties: no
  movement (the resolver already reads cadence from dates).

## decisionsRequired

None new for the cashflow number itself (D8's principal-as-wealth-transfer labelling applies to the
household cashflow quantity, not this per-property engine — confirm during T6 that the per-property
headline stays P&I-cash-basis as decided 2026-07-03).

## wrong-inputs (FACT trustworthiness — brief §6 / MON-001)

- **MON-001 (FIXING):** `Income.amount`+`frequency` for rent may be fortnightly stored as monthly.
  **Engine actuals path is trustworthy** (resolver reads true cadence from transaction dates and
  flags contradictions via `rentCadenceSuspect`); **declared-fallback path is NOT trustworthy** until
  MON-001 closes. Any consumer of `basis: 'declared'` rent inherits the ~54% error.
- `Loan.interestRateAnnual` decimal-fraction convention verified in the type contract
  (`propertyCashflow.ts:74`); the interest floor is only correct if writers respect it (not re-audited
  here — loan-cost contract territory).

## coverageBoundary

READ: `propertyCashflow.ts` (full), `propertyActualsWindow.ts` (full), `propertyActuals.ts` (full),
`loanCosts.ts:1-60`, `masterFinancialService.ts:1050-1303` + `:776`, `portfolio/snapshot/route.ts:700-760`,
`properties/page.tsx:440-500`, `properties/[id]/page.tsx:150-290`, `riskRadar.ts:385-430`,
`PropertyExpensesCard.tsx` (header only). NOT READ: `app/api/properties/[id]/route.ts` full body,
`app/api/properties/route.ts` (list serialization), downstream renderers of master
`propertyMetrics` (reports, balances), tax-position consumers of `annualTaxCashflow`. Anchors: all
cited lines verified at HEAD `2f9f2e16`; **no drift found** against the register row
(`REFERENCE_NUMBERS.md:56`).

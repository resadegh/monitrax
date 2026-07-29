# propertyRentalYield — gross rental yield per property

> MON-131 Phase A Quantity Contract. Census key: `propertyCashflowYield` (yield half — cashflow has
> its own contract, `property-cashflow.md`). READ-ONLY audit at HEAD `2f9f2e16`, 2026-07-29.
> Census listed 6 formula-shape sites; 2 of the 6 are regex false positives ("current" contains
> "rent") — detailed below.

## classification

**DERIVED** (D1). `annualRent` is itself the DERIVED actuals-first output of `computePropertyCashflow`;
`Property.currentValue` is a FACT.

## semantic

- **Definition:** `grossRentalYield = (annualRent ÷ propertyValue) × 100`, guarded to `0` when
  `propertyValue <= 0`.
- **Basis of the numerator:** the canonical actuals-first `annualRent` from `computePropertyCashflow`
  (trailing-12 window, stream-pooled, managed gross-up) — NOT declared income. This is the settled
  MON-036 semantic ("the rogue 3rd yield value" was a declared-income calc).
- **Basis of the denominator:** `Property.currentValue` (FACT), no purchase-price fallback.
- **Units: PERCENT (0–100).** Callers needing a fraction divide by 100 explicitly
  (`riskRadar.ts:416-417` documents this). The percent-vs-fraction convention is this quantity's
  rate-unit contract (the D11 class); one producer of the divergent fraction form survives today —
  see callSites.
- **Window/inclusions:** inherited entirely from the property-cashflow contract (trailing-12
  actuals-first rent; gross rent — expenses are NOT netted; this is gross yield, not net yield. No
  net-yield quantity exists in the code today — if one is ever rendered it is a NEW named quantity).

## canonicalHome

`lib/utils/calculations.ts:43` — `calculateRentalYield(annualRent, propertyValue): number`.

**Decimal twin: NOT ESTABLISHED.** No `calculateRentalYieldDecimal` exists (the Q-DEC section of the
same file has Decimal siblings only for effective-principal / interest-for-period / PI-repayment).
Note: `lib/calculations/loanAggregator.ts:305` `calculateLVRDecimal` is the LVR quantity's twin, not
yield's.

Calc-audit fixture exists: `lib/calc-audit/engines/property.ts:80` exercises the canonical function
(Neo Inventory reconciliation intact for this quantity).

## callSites

| Site | Tag | Actual arithmetic in words |
|---|---|---|
| `lib/utils/calculations.ts:43` | **CANONICAL** | `annualRent / value × 100`, `0` when `value <= 0` |
| `lib/services/masterFinancialService.ts:1275` | CONSUMER | `calculateRentalYield(cf.annualRent, property.currentValue)` — engine rent, canonical formula |
| `app/api/portfolio/snapshot/route.ts:742` | CONSUMER | same call, Home-tile snapshot |
| `lib/cfo/riskRadar.ts:417` | CONSUMER | canonical call `÷ 100` to a labelled fraction for threshold comparison |
| `app/dashboard/properties/page.tsx:479-482` (local `calculateRentalYield`) | **DUPLICATE** | re-types the formula inline: `cashflowOf(property).annualRent / currentValue × 100` with the same `<= 0` guard. Same inputs, same arithmetic — should import the canonical. Predicted move: NONE |
| `app/dashboard/properties/[id]/page.tsx:289` (census attributed to `PropertyDetailPage:195` — the unit start; arithmetic is at 289) | **DUPLICATE** | `currentValue > 0 ? (cf.annualRent / currentValue) × 100 : 0` inline. Same inputs, same arithmetic. Predicted move: NONE |
| `lib/strategy/analyzers/propertyAnalyzer.ts:61-65` (`analyzeRentalYield`) | **DUPLICATE (divergent basis — the highest-risk site)** | `(property.rentalIncome ‖ 0) × 12 ÷ (currentValue ‖ purchasePrice)` as a FRACTION. Diverges on all three axes: declared `rentalIncome` treated as monthly (MON-001-exposed), purchase-price fallback for the denominator, fraction not percent. Migrating it MOVES numbers |
| `lib/health/metricAggregation.ts:407-413` (in `calculatePropertyMetrics:390`) | **DIFFERENT-QUANTITY** | `Σ(p.monthlyIncome × 12 over INVESTMENT properties) ÷ Σ(currentValue) × 100` — a PORTFOLIO-AVERAGE yield, not per-property. A legitimate distinct quantity (**name it `portfolioAverageRentalYield`**) — but its numerator is declared `monthlyIncome`, not the canonical actuals-first rent: DIFFERENT-QUANTITY with a flagged non-canonical feed (the MON-028 "same formula, different inputs" class) |
| `lib/cfo/decisionSupport/investmentDecisionSupport.ts:169` (census attribution; real yield code at `:450` `calculateDividendYield`) | **DIFFERENT-QUANTITY / census false positive here** | `:169` `calculateAllocationAnalysis` is allocation-percent arithmetic (regex matched "cur-RENT"). The file's real yield producer, `calculateDividendYield:450-459`, is DIVIDEND yield — a different quantity (investmentReturns family) — and it **invents** its estimate (assume 4% franked / 2% unfranked). Flagged for the invented-number register; not a rental-yield producer |
| `lib/strategy/analyzers/investmentAnalyzer.ts:129` (`analyzeRebalancing:154`) | **FALSE POSITIVE** | `currentValue / totalValue` allocation percent — "cur-RENT-Value / total-VALUE" matched the census regex. No yield computed |

Producer count for the per-property gross-rental-yield semantic at HEAD: **1 canonical + 3 duplicates**
(2 same-arithmetic inline, 1 divergent-basis) — census count 6 decomposes as 4 real + 1
different-quantity-in-file + 1 false positive.

## invariants

1. `yield == annualRent / propertyValue × 100` exactly, with `annualRent` taken from the SAME
   `computePropertyCashflow` call that renders the page's cashflow (numerator parity with the
   cashflow contract).
2. `propertyValue <= 0 → yield == 0` (never negative, never Infinity/NaN).
3. Cross-surface parity: list tile Yield == detail page Yield == Home tile `rentalYield` == master
   snapshot `propertyMetrics[].rentalYield` for the same property.
4. Unit invariant: every rendered value is percent 0–100; every threshold comparison in fraction
   space divides the canonical percent by 100 (no site may re-derive the fraction from raw inputs).
5. Yield is gated to income-producing properties in the UI (detail page gates on `isInvestment`,
   MON-022) — a PRIMARY_RESIDENCE never renders "Yield 0.00%".

## independentExpectation

**Arithmetic identity:** `annualRent ÷ currentValue × 100` — checkable from the two inputs without
reading another screen; `annualRent` is independently checkable via the property-cashflow contract's
worked-example discipline. The *choice* of gross (not net) and of `currentValue` (not cost) is a
definition, not derivable — recorded here as the named semantic.

## surfaces

| Route | Label |
|---|---|
| `/dashboard/properties` | tile KPI "Yield" (investment/rental tiles) |
| `/dashboard/properties/[id]` | MiniKpi "Yield" (`page.tsx:476`, violet tint, gated `isInvestment`) |
| `/` Home dashboard property tile (via `/api/portfolio/snapshot` `propertySnapshots[].rentalYield`) | property yield on Home |
| `/dashboard/cfo` | risk radar "Low yield: {name} … gross yield of X%" copy |
| Strategy findings (`/strategy` page via analyzers) | "Low Rental Yield: {address} … only X%" — currently produced by the DIVERGENT propertyAnalyzer producer |
| Health (LONG-TERM/property category, internal) | `rentalYieldPerformance` metric — currently the `portfolioAverageRentalYield` different-quantity |

## expectedMoves

- Migrating `properties/page.tsx:479` and `properties/[id]/page.tsx:289` to import
  `calculateRentalYield`: **NO movement** (identical arithmetic + guard). Strongest prediction here.
- Migrating `propertyAnalyzer.ts:61` to canonical (engine rent, currentValue-only, percent):
  **MOVES** — `pathPrefix: strategy.findings[PROPERTY_LOW_YIELD]`. Arithmetic: declared
  `rentalIncome×12` → actuals-first `annualRent` (delta = whatever the resolver corrects, incl. the
  MON-001 fortnightly class); properties with `currentValue == 0` but a `purchasePrice` flip from a
  yield-on-cost figure to `0` (or the finding disappears) — this specific flip needs the D-Y2
  decision below before Phase B.
- Re-founding `metricAggregation.ts:411` `averageYield` on Σ engine `annualRent`: **MOVES** the
  health `rentalYieldPerformance` metric wherever declared `monthlyIncome` ≠ actuals rent.
- MON-001 fix at the FACT layer: declared-basis yields move ~×2.17 on affected rentals (same
  prediction as the cashflow contract).

## decisionsRequired

- **D-Y1 — portfolio-average yield feed.** `portfolioAverageRentalYield` (health) currently sums
  declared `monthlyIncome`. Options: (a) re-found on canonical engine rent — health score input
  moves, honest basis; (b) keep declared and LABEL it declared — no movement, documented divergence.
  Consequence: (a) changes the health score; (b) leaves a surface whose yield disagrees with the
  property pages for the same portfolio.
- **D-Y2 — yield-on-cost.** `propertyAnalyzer`'s `currentValue ‖ purchasePrice` fallback silently
  blends two metrics. Options: (a) drop the fallback (yield undefined without a valuation); (b) name
  a separate `rentalYieldOnCost` quantity if the adviser lens wants it. Consequence: (a) may
  suppress findings for unvalued properties; (b) adds a quantity that must then be labelled
  distinctly everywhere.
- **D-Y3 — invented dividend yield.** `calculateDividendYield`'s 4%/2% assumption is an invented
  number rendered as a stat (investmentReturns family — out of this contract's scope but discovered
  here). Needs its own contract/issue; flagged so it is not lost.

## wrong-inputs

- **MON-001 (FIXING):** poisons every declared-basis numerator (`propertyAnalyzer` directly; the
  canonical path only via `basis: 'declared'` fallback). Actuals-driven canonical yields are
  trustworthy.
- `Property.currentValue` staleness is un-guarded (a FACT the user may not have updated) — yield is
  only as current as the valuation; no code issue, an intake-quality note.

## coverageBoundary

READ: all 6 census sites (2 to false-positive resolution), `lib/utils/calculations.ts` (full),
`riskRadar.ts:385-430`, `metricAggregation.ts:386-430`, `propertyAnalyzer.ts:40-95`,
`investmentAnalyzer.ts:110-170`, `investmentDecisionSupport.ts:150-210` + yield grep,
`calc-audit/engines/property.ts` (imports only). NOT READ: renderers of strategy findings, the
health-report UI path for `rentalYieldPerformance`, `PropertyTile.tsx` yield display internals.
Anchors: verified at HEAD `2f9f2e16`; census attribution drift noted for
`properties/[id]/page.tsx` (unit start 195 vs arithmetic 289) and `investmentDecisionSupport.ts`
(169 vs real yield code 450) — regex artefacts, not registry drift.

# Reference-Numbers Scoreboard — producers per quantity, before and after

> **GENERATED — do not edit by hand.** `npm run refnums:scoreboard` rewrites this file;
> `npm run refnums:check` fails if it is stale. A hand-maintained version of this table
> would drift the moment a tranche landed, and a stale scoreboard reads as progress that
> did not happen (CLAUDE.md §22.2.4 — coverage is a build output, never a claim).

**Sources joined:** `.audit/producer-census.json` (counts + dated history) · `docs/financial-logic/graph/financial-graph.json` (Neomatrix) · `docs/architecture/contracts/`

## How to read the Δ column — the part that matters

**A negative Δ is NOT the same as deleted duplication.** Two different things move this number:

1. **Real reconciliation** — a duplicate producer was deleted and its surface repointed at the
   canonical engine. T1 deleted five legacy income producers this way.
2. **Measurement correction** — the count itself was wrong and got fixed. The compare relays
   under `app/api/admin/matrix/**` were being counted as producers; excluding them dropped
   `expenseRunRate` 81→79, `incomeRunRate` 128→126, `payg` 56→54, `grossIncome` 38→36,
   `netIncome` 34→33, `emergencyMonths` 15→14 and `deductions` 106→105 **without deleting a
   single duplicate**. Recorded in `docs/implementation/MON-131_TRANCHE_LEDGER.md` §3 (T2).

This table cannot separate the two mechanically — the census records counts, not causes. The
ledger is where the cause of each movement is written down, and it is the honest reading.

## The headline

- **40 quantities** tracked · **1250 producing sites** across `lib/`, `app/api/`, `app/dashboard/`, `components/`
- **5/40** join to a Neomatrix `semanticKey`; **35 do not**
- **13/40** have a same-named quantity contract
- **`loanCost` is at 30** — T2 is the tranche that takes it to one. That single number is the fairest test of the programme so far.

> **The mapping gap is a real finding, not a rendering artefact.** The census names 40
> quantities; the Neomatrix models 16 `semanticKey`s. They are two vocabularies for the same
> architecture and they do not reconcile — which is exactly the NI-1→NI-4 reconciliation
> Part 22 exists to close. This generator joins only on an EXACT key match and reports the
> rest as unmapped, rather than fuzzy-matching names and inventing a coverage figure.

## Movement since the census was seeded

| Quantity | Seed | Now | Δ |
|---|---:|---:|---:|
| `payg` | 64 | 54 | -10 |
| `incomeRunRate` | 135 | 126 | -9 |
| `medicareLevy` | 26 | 20 | -6 |
| `expenseRunRate` | 84 | 79 | -5 |
| `cashflow` | 59 | 57 | -2 |
| `loanCost` | 32 | 30 | -2 |
| `incomeTax` | 77 | 76 | -1 |

Quantities tracked from the seed that have not moved: 
`depreciation` (15) · `emergencyMonths` (14) · `netWorth` (7) · `propertyEquity` (11) · `savingsRate` (30) · `superCap` (10)

## Every quantity

| Quantity | Producers now | Seed | Δ | Neomatrix | Contract |
|---|---:|---:|---:|---|---|
| `assetsLiabilitiesBreakdown` | 24 | — | — | **not modelled** | `assets-liabilities-breakdown.md` |
| `budgetVariance` | 20 | — | — | **not modelled** | `budget-variance.md` |
| `cashflow` | 57 | 59 | -2 | **not modelled** | — |
| `cgt` | 98 | — | — | **not modelled** | — |
| `deductions` | 105 | — | — | **not modelled** | `deductions.md` |
| `depreciation` | 15 | 15 | 0 | **not modelled** | `depreciation.md` |
| `div293` | 4 | — | — | **not modelled** | — |
| `emergencyMonths` | 14 | 14 | 0 | **not modelled** | — |
| `expenseRunRate` | 79 | 84 | -5 | **not modelled** | — |
| `forecastFlows` | 69 | — | — | **not modelled** | — |
| `freedomHorizon` | 6 | — | — | **not modelled** | — |
| `fteIeeElections` | 13 | — | — | **not modelled** | — |
| `grossIncome` | 36 | — | — | **not modelled** | — |
| `gst` | 15 | — | — | **not modelled** | — |
| `healthScore` | 19 | — | — | modelled | — |
| `incomeRunRate` | 126 | 135 | -9 | **not modelled** | — |
| `incomeTax` | 76 | 77 | -1 | **not modelled** | `income-tax.md` |
| `insuranceAdequacy` | 15 | — | — | **not modelled** | — |
| `investmentReturns` | 22 | — | — | **not modelled** | — |
| `landTax` | 8 | — | — | **not modelled** | `land-tax.md` |
| `liquidCash` | 58 | — | — | `tests/calculations/liquidCash.test.ts + tests/golden/ring2.liquidCashParity.test.ts + tests/golden/ring2.liquidCashParity.accountCard.test.ts` | — |
| `loanAmortisation` | 8 | — | — | **not modelled** | — |
| `loanCost` | 30 | 32 | -2 | **not modelled** | — |
| `lvrGearing` | 39 | — | — | **not modelled** | — |
| `medicareLevy` | 20 | 26 | -6 | **not modelled** | `medicare-levy.md` |
| `moneyStoryMargin` | 6 | — | — | modelled | — |
| `negativeGearing` | 7 | — | — | **not modelled** | `negative-gearing.md` |
| `netIncome` | 33 | — | — | **not modelled** | — |
| `netWorth` | 7 | 7 | 0 | modelled | `net-worth.md` |
| `payg` | 54 | 64 | -10 | **not modelled** | — |
| `propertyCashflowYield` | 6 | — | — | **not modelled** | — |
| `propertyEquity` | 11 | 11 | 0 | **not modelled** | `property-equity.md` |
| `propertyValuationGrowth` | 6 | — | — | **not modelled** | — |
| `psiAttribution` | 11 | — | — | **not modelled** | — |
| `savingsRate` | 30 | 30 | 0 | modelled | `savings-rate.md` |
| `stampDuty` | 4 | — | — | **not modelled** | — |
| `superCap` | 10 | 10 | 0 | **not modelled** | `super-cap.md` |
| `superProjection` | 3 | — | — | **not modelled** | — |
| `taxOffsetsFranking` | 48 | — | — | **not modelled** | — |
| `taxableIncome` | 38 | — | — | **not modelled** | `taxable-income.md` |

_Seed `—` means the quantity was added to the census after the seed snapshot, so it has no
before-value. It is not a zero and must not be read as one._

## Census snapshots

| Quantity | 2026-07-29#1 | 2026-07-29#2 | 2026-07-30 | 2026-07-31#4 | 2026-07-31#5 | 2026-08-03 | now |
|---|---:|---:|---:|---:|---:|---:|---:|
| `assetsLiabilitiesBreakdown` | — | 24 | 24 | 24 | 24 | 24 | 24 |
| `budgetVariance` | — | 21 | 21 | 20 | 20 | 20 | 20 |
| `cashflow` | 59 | 59 | 59 | 57 | 57 | 57 | 57 |
| `cgt` | — | 98 | 98 | 98 | 98 | 98 | 98 |
| `deductions` | — | 105 | 107 | 106 | 105 | 105 | 105 |
| `depreciation` | 15 | 15 | 15 | 15 | 15 | 15 | 15 |
| `div293` | — | 4 | 4 | 4 | 4 | 4 | 4 |
| `emergencyMonths` | 14 | 14 | 15 | 15 | 14 | 14 | 14 |
| `expenseRunRate` | 84 | 84 | 87 | 81 | 79 | 79 | 79 |
| `forecastFlows` | — | 70 | 70 | 69 | 69 | 69 | 69 |
| `freedomHorizon` | — | 6 | 6 | 6 | 6 | 6 | 6 |
| `fteIeeElections` | — | 13 | 13 | 13 | 13 | 13 | 13 |
| `grossIncome` | — | 43 | 47 | 38 | 36 | 36 | 36 |
| `gst` | — | 15 | 15 | 15 | 15 | 15 | 15 |
| `healthScore` | — | 19 | 19 | 19 | 19 | 19 | 19 |
| `incomeRunRate` | 135 | 135 | 141 | 128 | 126 | 126 | 126 |
| `incomeTax` | 77 | 77 | 77 | 76 | 76 | 76 | 76 |
| `insuranceAdequacy` | — | 15 | 16 | 15 | 15 | 15 | 15 |
| `investmentReturns` | — | 22 | 22 | 22 | 22 | 22 | 22 |
| `landTax` | — | 8 | 8 | 8 | 8 | 8 | 8 |
| `liquidCash` | — | 58 | 58 | 58 | 58 | 58 | 58 |
| `loanAmortisation` | — | 8 | 8 | 8 | 8 | 8 | 8 |
| `loanCost` | 32 | 32 | 32 | 31 | 31 | 30 | 30 |
| `lvrGearing` | — | 39 | 39 | 39 | 39 | 39 | 39 |
| `medicareLevy` | 26 | 26 | 26 | 20 | 20 | 20 | 20 |
| `moneyStoryMargin` | — | 6 | 6 | 6 | 6 | 6 | 6 |
| `negativeGearing` | — | 6 | 7 | 7 | 7 | 7 | 7 |
| `netIncome` | — | 45 | 46 | 34 | 33 | 33 | 33 |
| `netWorth` | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| `payg` | 64 | 64 | 73 | 56 | 54 | 54 | 54 |
| `propertyCashflowYield` | — | 6 | 6 | 6 | 6 | 6 | 6 |
| `propertyEquity` | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| `propertyValuationGrowth` | — | 6 | 6 | 6 | 6 | 6 | 6 |
| `psiAttribution` | — | 11 | 11 | 11 | 11 | 11 | 11 |
| `savingsRate` | 30 | 30 | 30 | 30 | 30 | 30 | 30 |
| `stampDuty` | — | 4 | 4 | 4 | 4 | 4 | 4 |
| `superCap` | 10 | 10 | 10 | 10 | 10 | 10 | 10 |
| `superProjection` | — | 3 | 3 | 3 | 3 | 3 | 3 |
| `taxOffsetsFranking` | — | 50 | 50 | 48 | 48 | 48 | 48 |
| `taxableIncome` | — | 38 | 41 | 38 | 38 | 38 | 38 |

## What this scoreboard does NOT tell you

- **It does not say a quantity is correct.** A count of 1 means one producer, not a right answer.
  Correctness lives in the quantity contracts, the calc-audit fixtures and the Ring-3 runs.
- **It does not attribute a Δ to a cause.** See the reading note above; the ledger holds causes.
- **It does not cover quantities the census does not detect.** The census counts deriving
  functions by pattern; a producer written in a shape no pattern matches is invisible to it.
  That is a known limit of the instrument, not a claim of completeness.


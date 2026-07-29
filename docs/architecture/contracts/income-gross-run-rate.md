# incomeGrossRunRate (gross income run-rate)

> Phase A Quantity Contract — MON-131 / MON-128 (T1). READ-ONLY census at HEAD `fa392b9a`, 2026-07-29.
> Every anchor below was verified by reading the file at HEAD.

## classification

**DERIVED** (D1). Inputs are FACT rows (`Income.amount` + `frequency` + salary FACT columns
`grossAmount`/`netAmount`/`paygWithholding`). The run-rate itself must never be stored.

## semantic

- **basis:** DECLARED `Income` rows (not transactions). Pre-tax.
- **window:** run-rate (steady-state monthly or annual), not a calendar window.
- **inclusions:** every income row of every type; for `type='SALARY'` with `salaryType='NET'`
  and `grossAmount != null`, the stored **already-ANNUAL** `grossAmount` is the gross
  (÷12 for monthly target). All other rows: `amount` × frequency conversion
  (`toMonthly`/`toAnnual`, Weekly ×52/12).
- **exclusions:** **NONE today — this is the gap.** No one-off gate exists:
  `IncomeInput` (lib/calculations/incomeAggregator.ts:19-39) does not even carry
  `isRecurring`, and the aggregation loop at :160 annualises every row ×frequency.
  Target semantic per REFERENCE_NUMBERS.md T1 row: *declared recurring income, one-off
  gated, pre-tax* (re-founded on the `monthlyRunRate` gate pattern).
- **units:** AUD/month or AUD/year per `targetFrequency` param. **Unit contract on the FACT
  columns: `grossAmount`, `netAmount`, `paygWithholding` are ALREADY-ANNUAL** (schema
  prisma/schema.prisma:1930-1933; writer app/dashboard/income/page.tsx:327-348 sends annual).
  `amount` is per-`frequency`. This asymmetry is the #1 unit trap (see callSites — the
  orchestrator violates it).

**UNNAMED split found:** "gross income" is at least two semantics today —
(a) grossAmount-aware gross (aggregator, portfolio snapshot), and
(b) `amount`-only gross that ignores `grossAmount` for NET-entered salaries
(income page `totalGrossMonthly`), which under-states gross. Flagged below.

## canonicalHome

`lib/calculations/incomeAggregator.ts:getGrossAmount` (:72) via `aggregateIncome` (:143)
— **plus Decimal twin** `getGrossAmountDecimal` (:239) via `aggregateIncomeDecimal` (:286).
Canonical **after T1 adds the one-off gate** (REFERENCE_NUMBERS.md row "Income run-rate
(gross)"). Until the gate ships, the home is the designated survivor, not yet conformant.

## callSites

Census heuristic lists 43 `grossIncome` + 135 `incomeRunRate` candidate sites (many false
positives). Sites examined and classified:

| file:line | tag | what it actually computes |
|---|---|---|
| lib/calculations/incomeAggregator.ts:72 `getGrossAmount` | CANONICAL (survivor) | grossAmount(annual)/12 for NET salary; else amount×freq. No one-off gate. |
| lib/calculations/incomeAggregator.ts:239 `getGrossAmountDecimal` | CANONICAL twin | same, Decimal. |
| lib/services/masterFinancialService.ts:1119-1130 `buildIncomeBreakdown`→`aggregateIncome` | CONSUMER | `mapIncome` DROPS `isRecurring` (not in IncomeInput) — gate impossible here today. Feeds `income.monthly.all.grossTotal`. |
| lib/services/masterFinancialService.ts:1858/1865 `adjustPropertyRentalIncome` | CONSUMER (pre-processor) | pools fragmented rental rows to ONE synthetic monthly gross row via `computePropertyCashflow` before aggregation. |
| app/api/portfolio/snapshot/route.ts:37 `getGrossIncomeAmount` | DUPLICATE | same semantic, annual-only re-implementation (grossAmount for NET salary, else toAnnual). Delete → read aggregator. |
| app/dashboard/income/page.tsx:741 `totalGrossMonthly` | DUPLICATE (divergent) | `convertToMonthly(i.amount, i.frequency)` — ignores `grossAmount` for NET-entered salary → gross = net for those rows. Under-states gross. |
| lib/calculations/cashflowOrchestrator.ts:131 `calculateIncomeAmounts` (:147) | DUPLICATE (**WRONG-INPUT units**) | NET salary branch: `toMonthly(item.grossAmount, item.frequency)` — treats ANNUAL `grossAmount` as a per-frequency amount. For a FORTNIGHTLY row this reads gross ×26/12 ≈ 2.17× annual per month. Decimal twin same bug at :505. |
| lib/cashflow/incomeNormalizer.ts:87 `normalizeIncomeStream` (:96-98) | DUPLICATE | `grossMonthlyAmount = grossAmount/12` (annual convention honoured); per-stream, monthly-only. Decimal twin :340. |
| lib/health/buildHealthInput.ts:37 `getNetMonthlyIncome` | DIFFERENT-QUANTITY (net; see income-net contract) | uses `amount` as gross for SALARY regardless of salaryType. |
| lib/tax-engine/position/taxPositionCalculator.ts:180-184 | DIFFERENT-QUANTITY | assessable-income assembly (grossAmount-first, one-off-counted-once, taxCategory-aware) — see income-taxable-input contract. |
| lib/income/unmatchedDeclaredIncome.ts:30 | DIFFERENT-QUANTITY | declared-only annual income with no matched actuals (MON-043 explainer) — legitimately its own quantity. |
| lib/calculations/rentalReconciliation.ts:141/:192/:243 | DIFFERENT-QUANTITY | per-stream managed-rental gross reconstruction from net deposits — its own quantity (Phase 59). |
| remaining census candidates (calc-audit fixtures, cfo/*, strategy/*, reports/*, plan page, EntityCashflowSummary, onboarding wizard, etc.) | NOT EXAMINED | see coverageBoundary. |

## invariants

1. `grossTotal ≥ netTotal` (shared with the net contract), Float and Decimal.
2. One-off gate (post-T1): a fixture with one recurring row + one large one-off — the
   one-off contributes **0** to monthly and annual gross run-rate on every migrated producer.
3. Unit invariant: for a NET-entered salary, `monthlyGross === grossAmount/12` exactly —
   never `toMonthly(grossAmount, frequency)` (kills the :147/:505 class).
4. `aggregateIncome(rows,'annual').grossTotal === aggregateIncome(rows,'monthly').grossTotal × 12`
   (within Float tolerance; exact in Decimal).
5. Float ≡ Decimal parity on identical inputs.
6. Rental dedup: a rental fragmented into N rows contributes ONE stream's gross (the
   `adjustPropertyRentalIncome` pooling), never N×.

## independentExpectation

Arithmetic identity: gross run-rate = Σ over recurring rows of
`annualised(amount, frequency)` with the documented grossAmount override — hand-computable
from the raw `Income` table. No legislation applies (pre-tax declared figure). For any
fixture: expected value derivable by hand per §19.2.

## surfaces

| route | label (verified render site) |
|---|---|
| /dashboard/income | gross column + totals row (page.tsx:741 `totalGrossMonthly`, table ~:1347); per-item "Gross" in detail dialog (:2386-2389); salary preview "Gross" (:1977) |
| /dashboard (Home) | via /api/dashboard/insights (route.ts:282 reads the sibling netTotal; gross feeds ratios) |
| /dashboard/tax | declared gross feeds the tax page via the tax-input side (see income-taxable-input contract) |
| /dashboard/cashflow, /api/cashflow, /api/cashflow/summary | orchestrator `monthlyGrossIncome`/`annualGrossIncome` (cashflowOrchestrator.ts:390-400) |
| /dashboard/cfo/what-if/[lever] | salary-sacrifice lever gross inputs (census hit :326/:716 — NOT EXAMINED in depth) |

Exhaustive surface enumeration was NOT completed — see coverageBoundary.

## expectedMoves

Golden-baseline capture tree prefix: `lib/services/masterFinancialService.ts:getMasterFinancialSnapshot`.

| pathPrefix | prediction | arithmetic |
|---|---|---|
| `…getMasterFinancialSnapshot.income.monthly.all.grossTotal` | MOVES DOWN iff any `Income.isRecurring=false` row exists | new = old − Σ annualised(one-off amount)/12 per one-off row; pre-computable from the DB before merge |
| `…getMasterFinancialSnapshot.income.annual.*` (if captured) | same ×12 | — |
| `…quickMetrics.monthlyIncome` | NO MOVEMENT from THIS contract (it reads netTotal — see income-net contract) | — |
| all non-income subtrees | **NO MOVEMENT** — consumer migration only | strongest prediction; any move = defect |

If zero one-off income rows exist in Reza's data, the T1 gate itself predicts **NO movement
anywhere** for the gross quantity.

## decisionsRequired

1. **Gate basis for gross:** T1 adds the one-off gate to gross run-rate (design record).
   Confirm the gate value is 0 in the RUN-RATE while the tax side still counts the one-off
   ONCE (they diverge by design — see income-taxable-input). Consequence if not confirmed:
   the tax base silently loses one-off receipts.
2. **`grossAmount` staleness rule:** when a user edits `amount` on a NET salary, the stored
   `grossAmount` FACT is not re-derived (no re-sync found in app/api/income/route.ts PUT —
   NOT fully examined). Decide: re-derive on write, or clamp/ignore stale grossAmount on
   read. Consequence: stale grossAmount silently mis-states gross (and can invert net≤gross).
3. **Income-page gross column:** conform :741 to the grossAmount-aware rule (it currently
   under-states gross for NET-entered salaries) — cosmetic-looking but changes a rendered
   number; needs an expectedMoves row of its own in Phase B.

## coverageBoundary

- Read end-to-end: `incomeAggregator.ts`, `incomeNormalizer.ts`, `netIncomeCalculator.ts`
  (lib/income/), orchestrator :1-200/:290-400/:491-533, masterFinancialService :1050-1170 +
  :1845-1880 + :2090-2140 + grep-verified anchors, portfolio snapshot :25-60, income page
  :320-370/:555-570/:720-760, buildHealthInput :25-60, taxPositionCalculator :140-230 +
  gate greps, schema Income model, goldenBaseline.ts header.
- NOT examined: the ~30 remaining census candidate sites tagged NOT EXAMINED above
  (cfo/*, strategy/*, reports/*, forecasting, onboarding wizard, EntityCashflowSummary,
  plan page, calc-audit fixtures); `app/api/income/route.ts` PUT path; whether any importer
  writes `Income.grossAmount` at non-annual basis.
- Rendered dollar values ($317,751 declared gross) could NOT be reproduced read-only (no DB
  access) — code mechanics verified, data values not.

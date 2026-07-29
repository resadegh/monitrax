# monthlyRecurringRunRate

> MON-131 Phase A Quantity Contract (READ-ONLY census artefact, 2026-07-29, HEAD `2f9f2e16`).
> Type specimen value at census: **$1,482/mo** (design record §3.1). Tranche 3 (MON-129).

## classification

**DERIVED** — computed from declared `Expense` FACT rows (amount + frequency + `isRecurring`).
Never stored.

## semantic

- **Basis:** DECLARED `Expense` rows only. Never transactions.
- **Window:** none — a run-rate is a point-in-time forward-looking rate, not a period sum.
- **Inclusions:** every `Expense` row with `isRecurring !== false` (undefined/null/true = recurring),
  essential AND discretionary.
- **Exclusions:** one-off rows (`isRecurring === false`) contribute **exactly 0** — never
  `amount × frequency` (MON-037/082 semantics, frequencies.ts:34-44 header). Loan repayments are
  NOT part of this quantity (see `monthly-committed.md`). Transactions are not part of this quantity.
- **Units:** AUD/month. Annual sibling = ×12 exactly.
- **Formula per row:** `isRecurring === false ? 0 : amount × {WEEKLY:52, FORTNIGHTLY:26, MONTHLY:12,
  QUARTERLY:4, HALF_YEARLY:2, ANNUAL:1}[frequency] / 12`. Unknown frequency falls through
  `toAnnual`'s default branch and returns the raw amount (frequencies.ts:21-22) — a documented
  hazard, UPPERCASE enum required (expenseAggregator.ts:67-74 contract note).

## canonicalHome

- **The gate (per-row converter):** `lib/utils/frequencies.ts:45` `monthlyRunRate()` ·
  `lib/utils/frequencies.ts:55` `annualRunRate()`. Verified at HEAD.
- **The aggregate (household total):** `lib/services/masterFinancialService.ts:906`
  `buildExpenseBreakdown()` → `recurring` slice at `:924-927` → surfaced as
  `quickMetrics.monthlyExpenses` at `:2105`. Verified at HEAD.
- **Decimal twin: NOT ESTABLISHED.** `toMonthlyDecimal`/`toAnnualDecimal` exist
  (frequencies.ts:143/:115) but carry **no one-off gate** — there is no `monthlyRunRateDecimal`.
  `aggregateExpensesDecimal` (expenseAggregator.ts:212) is likewise ungated.
- **Structural note (two implementations of one gate):** the gate exists in two forms that produce
  the same number: (a) `monthlyRunRate()` per-row; (b) `filter(isRecurring !== false)` +
  ungated `aggregateExpenses` (master :925). T3 should collapse to ONE form.

## callSites

Census family `expenseRunRate` = **84 heuristic sites** (`node scripts/census/producers-census.mjs
--list`). Examined and classified below: 14. **NOT EXAMINED: ~70** (heuristic list includes many
false-positive frequency-conversion hits, e.g. income normalisation, loan repayment conversion).

| Site | Tag | Arithmetic in words |
|---|---|---|
| `lib/utils/frequencies.ts:45,55` | **CANONICAL** | the one-off gate itself |
| `lib/calculations/expenseAggregator.ts:76` `aggregateExpenses` (+ `:212` Decimal, `:124`/`:257` byCategory) | **CONSUMER-with-precondition / latent DUPLICATE** | ungated `toMonthly` sum over whatever rows it is handed. Correct ONLY over pre-filtered recurring rows (as master does). Any caller feeding unfiltered rows produces the all-rows quantity — a different, unnamed figure |
| `lib/services/masterFinancialService.ts:924-927` (`recurring`), `:938-946` (essential/discretionary, MON-023), `:958-961` (byCategory, MON-126) | CONSUMER | filter `isRecurring !== false` then ungated aggregate — gate via filter |
| `lib/services/masterFinancialService.ts:922` (`all` slice) + `:929-932` (`nonRecurring`) | **DIFFERENT-QUANTITY** | "total declared expenses incl. one-offs" and "one-offs counted once" — legitimate display quantities, not run-rates |
| `lib/services/masterFinancialService.ts:1919-1925` | CONSUMER | recurring filter feeding `calculateCashflow` (MON-011) |
| `lib/calculations/cashflowOrchestrator.ts:187` `calculateMonthlyCashflow` (raw `toMonthly` loop ≈:205) + `:302` `calculateCashflow` | **CONSUMER-with-precondition / latent DUPLICATE** | ungated; correct only because master pre-filters. Other callers of the orchestrator not all examined |
| `app/api/cashflow/route.ts:177` | **DUPLICATE — WRONG basis** | raw `toMonthly` reduce over ALL expense rows, **no one-off gate** — includes one-offs in a monthly figure |
| `app/api/cashflow/summary/route.ts:73` | CONSUMER | `monthlyRunRate` per row |
| `app/api/budget-analysis/generate/route.ts:168,175,179,200,235,252` | CONSUMER | `monthlyRunRate` over recurring-filtered rows (MON-125) |
| `app/dashboard/expenses/page.tsx:569` | CONSUMER (surface) | `monthlyOf = monthlyRunRate` |
| `lib/tie/analytics.ts`, `lib/calculations/actualCashflow.ts`, `lib/calculations/moneyStoryTrend.ts` | **DIFFERENT-QUANTITY** | actual-transaction spend — see sibling contracts |

## invariants

1. A one-off (`isRecurring === false`) contributes **0** to every monthly AND annual run-rate,
   on every producer (the §8 permanent test of the design record).
2. `annualRunRate(row) === 12 × monthlyRunRate(row)` exactly.
3. On the master basis: `recurring.total === essential.total + discretionary.total` (MON-023) and
   `Σ byCategory === recurring.total` (MON-126).
4. **NOT an invariant:** `recurring run-rate ≤ trailing actual spend`. Tempting ("actuals include
   one-offs so must be bigger") but false: a user whose declared bills have not yet appeared in a
   sparse/new transaction window, or who pays declared bills from an unimported account, has
   run-rate > actuals. The two quantities are different bases; neither bounds the other.
5. **NOT an invariant:** Float ≡ Decimal on the gated path — the Decimal path has no gate yet
   (see canonicalHome). Becomes an invariant only after T3 ships `monthlyRunRateDecimal`.

## independentExpectation

Arithmetic identity over raw `Expense` table rows: hand-list every row with
`isRecurring !== false`, convert each by the frequency table, sum. No legislation involved;
verifiable without reading any other screen.

## surfaces

- `/dashboard/expenses` → "Total outgoings" (recurring basis; one-offs captioned "counted once")
- Home `/dashboard` → tiles reading `quickMetrics.monthlyExpenses` (via master snapshot)
- `/dashboard/budget-analysis` → essential/discretionary breakdowns
- `/api/cashflow/summary` → declared side of plan-vs-actual
- `/api/cashflow` → COE input (currently on the WRONG ungated basis, :177)
- Surface list is NOT exhaustive — see coverageBoundary.

## expectedMoves

- **NO movement** predicted for `quickMetrics.monthlyExpenses`, `cashflow.monthlyExpenses`,
  budget-analysis committed/discretionary totals — already gated (strongest prediction).
- **DOWN** at `pathPrefix /api/cashflow` (route.ts:177 basis) by exactly
  `Σ toMonthly(one-off rows)` when migrated to the gate — the arithmetic is the sum of the
  user's `isRecurring === false` rows converted at their stored frequency.
- **⛔ MON-135 blocks this contract's migration (Tranche 3).** Verified at HEAD:
  `lib/bank/aiCategorisation.ts:90, :203, :249, :365` stamp `isRecurring: false` unconditionally
  (a default, not a finding; `:390` passes through a learned value). Post-T3, any declared Expense
  row originating from AI categorisation evaluates the gate to 0 → recurring costs silently
  vanish from every run-rate, and the golden baseline would absorb it as an expected T3 downward
  move. Brief anchors NOT drifted.

## decisionsRequired

- None new — D6 (named quantities) settled. T3 execution choice (not a product decision): collapse
  the two gate forms (per-row `monthlyRunRate` vs filter-then-aggregate) to one, and ship the
  Decimal gate twin in the same PR (standing rule 4).

## coverageBoundary

Examined: the canonical gate + aggregator (Float + Decimal) end-to-end; master snapshot
buildExpenseBreakdown + quickMetrics assembly; budget-analysis generate route; cashflow +
cashflow/summary routes' expense reduces; expenses page gate usage; aiCategorisation stamp lines.
NOT examined: ~70 of the 84 census sites (incl. all of `lib/cfo/*`, `lib/health/*`,
`lib/intelligence/*`, `lib/reports/*`, `lib/strategy/*`, onboarding wizard, and component-level
hits); Decimal consumers; tests other than those cited. This contract verifies the semantic and
the named anchors; it does NOT verify that every unexamined site conforms.

## Adversarial review (§7) — 2026-07-29

- Claims checked: 31 (anchors 21 · arithmetic 8 · negative-claims 2)
  - Anchors re-verified at HEAD `72b15268`: frequencies.ts:45/:55 (`monthlyRunRate`/`annualRunRate`, gate `isRecurring === false → 0`), :21-22 default-branch hazard, :34-44 header, :115/:143 Decimal converters; expenseAggregator.ts:76/:124/:212 (Decimal byCategory :257 ≈ :261, within tolerance) + :67-74 contract note; masterFinancialService.ts:906/:922/:924-927/:929-932/:938-946/:958-961/:1919-1925/:2105; cashflowOrchestrator.ts:187 (raw `toMonthly` loop at ≈:205, ungated)/:302; app/api/cashflow/route.ts:177 (confirmed: `expenses.reduce(toMonthly…)`, no gate, `isRecurring` not even selected — in the `type='lite'` branch); cashflow/summary:73 (`monthlyRunRate` per row); budget-analysis generate :168/:175/:179/:200/:235/:252; expenses page :569; aiCategorisation.ts:90/:203/:249/:365 (`isRecurring: false` stamps) + :390 (learned passthrough).
  - Arithmetic: per-row formula matches `toAnnual`'s table exactly (52/26/12/4/2/1, ÷12); MON-023/MON-126 filter bases confirmed in code comments + filters; annual = 12 × monthly exact (:60).
  - Negative claims independently attacked: `monthlyRunRateDecimal` — repo-wide grep over `lib/`, `app/`, `scripts/`: **zero hits** (claim holds); census family `expenseRunRate` = **84** confirmed at `.audit/producer-census.json:5`.
- REFUTED / CORRECTED: **none**.
- Could not verify: the ~70 unexamined census sites (contract already declares this boundary); runtime dollar values (no DB access, per phase rules).
- Verdict impact: none. Canonical-home, DUPLICATE (:177 wrong basis), DIFFERENT-QUANTITY (`all`/`nonRecurring` slices, actuals engines) and the MON-135 block all stand. **PASS — contract survives unchanged.**

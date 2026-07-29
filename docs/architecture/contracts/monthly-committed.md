# monthlyCommitted

> MON-131 Phase A Quantity Contract (READ-ONLY census artefact, 2026-07-29, HEAD `2f9f2e16`).
> Type specimen value at census: **$14,261/mo** (design record §3.1; D4: "$1,482 bills +
> $12,779 loans"). Tranche 3 / feeds MON-132 (T6).

## classification

**DERIVED** — composed from two derived quantities: an expense run-rate slice + the resolved
loan monthly cost. Currently ALSO persisted inside `BudgetAnalysis.recurringBreakdown`
(see decisionsRequired — D2 tension).

## semantic

⚠️ **Two non-identical definitions are on record — see decisionsRequired D-A before Phase B.**

- **As implemented** (`app/api/budget-analysis/generate/route.ts:184`):
  `committedMonthly = essentialMonthly + loanRepaymentsMonthly` where
  - `essentialMonthly` (:174) = Σ `monthlyRunRate(e)` over rows with `isRecurring !== false`
    AND `isEssential === true` — the **essential-recurring** slice only;
  - `loanRepaymentsMonthly` (:150) = Σ resolved monthly loan cost from
    `resolveLoanCostsForUser` (actuals-first: linked repayments → declared `minRepayment` →
    interest floor; an interest-only loan never $0 — MON-125/130).
- **As registered** (`REFERENCE_NUMBERS.md` row `monthlyCommitted`): "recurring run-rate +
  canonical loan cost" — i.e. **ALL recurring** (essential + discretionary) + loans.
- The two coincide on the census data ($1,482 + $12,779 = $14,261) **only if** every recurring
  row is essential there; in general they differ by the discretionary-recurring subtotal.
- **Basis:** declared expenses (one-off gated) + actuals-first loan resolution. **Window:** none
  (run-rate). **Units:** AUD/month.
- **Exclusions:** one-offs (contribute 0 via the gate); AI variable estimates; discretionary
  recurring rows (under the implemented definition).
- **`Loan` has no `isRecurring` field (schema-verified per design record T2) — the one-off gate
  is never applied to loans.**

## canonicalHome

**NOT ESTABLISHED as a named engine.** Today the quantity is computed **inline** in one route:
`app/api/budget-analysis/generate/route.ts:184` (`committedMonthly`, verified at HEAD), from:
- expense side: `lib/utils/frequencies.ts:45` `monthlyRunRate` (canonical gate);
- loan side: `lib/services/loanCosts.ts` `resolveLoanCostsForUser` (canonical resolver, its own
  MON-130 contract — trailing-12-month actuals window per loanCosts.ts:16,42).
**Decimal twin: NOT ESTABLISHED** (neither side has a gated Decimal path wired here).
D3+D4 (survival runway, MON-132) will need this exact quantity as its denominator input —
a named `lib/` home should be created in T3/T6, not a second inline copy.

## callSites

| Site | Tag | Arithmetic in words |
|---|---|---|
| `app/api/budget-analysis/generate/route.ts:184` | **PRODUCER (inline, the only live computation)** | essential recurring run-rate + Σ resolved loan monthly |
| `app/api/budget-analysis/generate/route.ts:276,312,316,393-423,468-503` | CONSUMER | persists `committedTotal` and scenario totals built on it into `BudgetAnalysis` rows |
| `app/api/budget-analysis/latest/route.ts:86,:98` | CONSUMER (of the STORED value) | reads `breakdown.committedTotal` back from the DB blob — the live surface shows a stored derived value, refreshed only on regeneration |
| `app/dashboard/budget-analysis/page.tsx:173,245,351` | CONSUMER (surface) | renders committed from the API payload |
| `app/dashboard/plan/page.tsx:364` | CONSUMER (surface) | "value: budget.committedTotal" money-out band |
| Design record D4 / MON-132 (future) | CONSUMER (planned) | survival-runway denominator: essential incl. loan repayments |

No second producer of this composed quantity was found in the files examined (the components of
it have many producers — see the sibling and MON-130 contracts). NOT EXAMINED: whether any CFO /
safety-net surface re-composes "essential + loans" inline (see coverageBoundary).

## invariants

1. `committed === essentialExpensesTotal + loanRepaymentsTotal` (the blob stores all three —
   additivity is checkable on every stored analysis).
2. Every loan contributes its resolved cost; an interest-only loan with `minRepayment = 0`
   contributes its interest floor, never $0 (§8 permanent test).
3. `committed ≤ totalRealisticBudget` (committed is the minimum scenario, :401-405).
4. A one-off expense row contributes 0 to committed.
5. **NOT an invariant:** `committed ≤ monthly net income` — the route deliberately flags rather
   than clamps this (`incomeSanity`, :268-269); a true over-commitment must display, not vanish.

## independentExpectation

Arithmetic identity from raw rows: Σ essential recurring `Expense` rows converted by frequency
+ per-loan resolution hand-computed (linked repayment actuals over the trailing-12-month window,
else declared `minRepayment` converted, else `principal × rate / 12`). No legislation.

## surfaces

- `/dashboard/budget-analysis` → "Committed" total + committed breakdown (incl. per-loan basis label)
- `/dashboard/plan` → money-out "Committed" band (:364)
- (future, MON-132) Safety Net survival-runway denominator per D3+D4

## expectedMoves

- **NO movement** predicted from T3 for the expense side — the route is already gated (MON-125,
  GENERATOR_VERSION 2). Loan side already canonical.
- **Cached-value caveat:** stored analyses only recompute on regeneration; any T3-era semantic
  change moves the surface **only after** the next generate (the `generatorVersion < 2`
  auto-regeneration does not fire on read — design record T7 note). A version bump must
  accompany any basis change.
- If decision D-A below resolves to "all recurring + loans": committed moves **UP by exactly the
  discretionary-recurring run-rate subtotal**; minimum scenario and plan band move with it.
- **MON-135 exposure is LIVE TODAY on this quantity** (not just post-T3): the route filters
  `isRecurring !== false` at :130-132, so an essential bill mis-stamped `isRecurring: false` by
  `aiCategorisation.ts` (:90/:203/:249/:365, verified) is ALREADY excluded from committed now.

## decisionsRequired

- **D-A (product):** is `monthlyCommitted` = **essential**-recurring + loans (as implemented) or
  **all**-recurring + loans (as the REFERENCE_NUMBERS.md row reads)? Consequence: whether
  recurring discretionary subscriptions count as "must pay"; changes the budget minimum scenario,
  the plan page band, and the future D3/D4 survival-runway burn. D4's own wording ("$1,482 bills")
  suggests essential-only, but §3.1 names $1,482 as the FULL recurring run-rate — the register and
  the implementation cannot both be right in general. Do not migrate until named.
- **D-B (architecture):** `committedTotal` is a stored derived value read back as live
  (`latest` route :86). Is this the permitted D2 audit-snapshot exception (an analysis is a
  dated artefact) or a MON-080-class violation to re-derive on read? Options: (a) keep stored,
  label with analysis date; (b) recompute on read, store only for history. Do not choose here.

## coverageBoundary

Examined: the full generate route end-to-end, the latest route's read-back, both dashboard
surfaces' field usage, loanCosts.ts header contract, D2–D8 register rows. NOT examined:
`lib/budget-analysis/aiPrompt.ts` internals beyond its census note (ABS benchmark is reference,
not budget — T7 scope); whether safety-net / CFO / health code re-composes essential+loans inline
(the 84-site census family and the `emergencyMonths` family were not swept for this composition);
Decimal paths. Verifies the named anchors and the semantic fork; does NOT verify absence of an
inline re-composition elsewhere.

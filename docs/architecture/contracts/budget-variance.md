# budgetVariance (budgeted vs actual)

> **Quantity Contract — MON-131 Phase A (brief §3).** READ-ONLY at HEAD `fa392b9a`,
> 2026-07-29. Census count: **21 sites** (`.audit/producer-census.json:41`, regex family
> `variance|overspend|underspend|overBudget` in budget context). This contract answers the
> brief's conditional: *"budget variance IF the census's sites reveal a real user-facing
> quantity."* **Verdict: YES — it is real and user-facing** (a rendered glass tile on
> /cashflow and the Gemini cashflow narrative), **but it is not one quantity: four distinct
> semantics share the name**, with conflicting sign conventions and three different
> definitions of both "budgeted" and "actual". Producing separate named contracts per
> semantic is the §3 `name` rule applied.

## classification

**DERIVED** (D1), all four semantics. Never stored except inside the cached
`cashflowSummary` blob (an existing snapshot-cache, not a live read-back violation — but
note it caches semantic V2 below).

## semantic

Four genuinely different quantities currently answering to "budget variance":

| id | name proposed | budgeted side | actual side | sign convention | window |
|---|---|---|---|---|---|
| **V1** | `declaredEntryVariance` (expense + income twins) | each `Expense`/`Income` row's **declared amount** (`toMonthly(entry.amount)`) — "budget = what the user expects" | current-calendar-month **linked transactions** where present, else the declared amount (zero-variance filler) | `variance = budgeted − actual`; **positive = under budget** | current calendar month |
| **V2** | `realisticBudgetTotalVariance` | the BudgetAnalysis `totalRealisticBudget` (committed + discretionary + AI/benchmark variable) | declared expense **run-rate** (`monthlyRunRate` over all Expense rows) — NOT transactions | `variance = actual − budgeted`; **positive = over budget** | run-rate vs static plan (no window) |
| **V3** | `perCategoryBudgetComparison` | per-category amounts from the BudgetAnalysis `variableBreakdown` + `recurringBreakdown` blobs | per-category **actual outflow** from the canonical actuals engine | `variance = actual − budgeted`; positive = over; status OVER/WARNING/ON_TRACK/UNDER | current period of the intelligence engine |
| **V4** | `bankBudgetTargetComparison` | `BudgetTarget` rows (Phase 18 bank module) | categorised `UnifiedTransaction` OUT rows for a YYYY-MM month, transfers excluded | `percentUsed` thresholds; variance −actual when no budget | selected month |

V1's status thresholds: ±5% → under/over/on_track. V1 counts every entry as "having a
budget" (`entriesWithBudget++` unconditionally) — the declared amount doubles as the budget;
`Expense.budgetedAmount` / `Income.budgetedAmount` (schema :1953/:2052) are **not read** by
V1 at HEAD. V2 and V3 both treat a possibly-benchmark-contaminated "budget" as authoritative
(see `abs-benchmark-variable-expense-estimate.md` — laundering).

## canonicalHome

**NOT ESTABLISHED as one quantity — and it must not be forced into one** (the four answer
different questions, the D13 pattern). Per-semantic homes at HEAD:

- **V1:** `lib/services/masterFinancialService.ts:983` `calculateExpenseBudgetVariance`
  (+ income twin `:1160` `calculateIncomeBudgetVariance`; interface `:110`; produced at
  `:964` and `:1150`). No Decimal twin. **Produced but has NO web consumer** — no component
  or page reads `budgetVariance` off the master snapshot (verified by repo-wide grep;
  only the mobile API contract docs and a CFO test fixture reference it).
- **V2:** `app/api/cashflow/summary/route.ts:181-182` — **inline in a route handler**
  (a §12.3 violation as written; no lib home).
- **V3:** `app/api/cashflow/intelligence/route.ts:260` `buildBudgetComparison` — **inline
  in a route file** (function defined in the route module, not `lib/`).
- **V4:** `lib/bank/budgetComparison.ts` (`compareBudget` family; status helper :37-46;
  no-budget rows variance `−actual` at :142).

## callSites

All anchors verified at HEAD 2026-07-29.

| file:line | tag | note |
|---|---|---|
| `lib/services/masterFinancialService.ts:983` | V1 producer | expense variance, current-month actuals-first with declared filler. |
| `lib/services/masterFinancialService.ts:1160` | V1 producer (twin) | income variance, same shape. |
| `lib/services/masterFinancialService.ts:1653,1660` | V1 CONSUMER (internal) | `blankBudgetVariance()` empty states. |
| `app/api/cashflow/summary/route.ts:181-182` | **DIFFERENT-QUANTITY (V2)** | `monthlyExpenses − totalRealisticBudget`; opposite sign to V1; run-rate actuals not transactions. |
| `lib/cashflow-intelligence/geminiSummary.ts:58,156-158,297` | V2 CONSUMER | renders V2 into the Gemini narrative as "Budget Status: $X over/under budget" — an AI-grounding surface. |
| `app/api/cashflow/intelligence/route.ts:260-330` | **DIFFERENT-QUANTITY (V3)** | per-category actual−budgeted; own OVER/WARNING/UNDER status scale. |
| `app/api/cashflow/intelligence/route.ts:386-409` | V3 CONSUMER | 'BUDGET'-source insights ("over budget in {category}"), actionUrl `/dashboard/budget-analysis`. |
| `app/(dashboard)/cashflow/page.tsx:651-658` | V3 CONSUMER (surface) | `GlassBudgetTile` — totalBudgeted / totalActual / totalVariance / overallStatus rendered to the user. |
| `lib/bank/budgetComparison.ts:37-46,142,197,338` | **DIFFERENT-QUANTITY (V4)** | Phase 18 engine against `BudgetTarget` rows. |
| `app/api/budget/health/route.ts:161` | V4 CONSUMER | `budgetComparison: budgetReport` in the health report payload. **No frontend fetch of `/api/budget/health` found** — route + V4 engine appear DEAD from the web app (candidate §12.1). |
| `lib/utils/reconciliation.ts:387` `calculateBudgetVariance`, `:422` `calculateAggregatedBudgetVariance` | **DUPLICATE — DEAD** | exported, **zero call sites repo-wide** (their `BudgetVariance` interface at `:73` is a 5-field sibling of master's 7-field one). Delete candidates in Phase B, citing this entry. |

Census reconciliation: the 21 regex sites include the above producers/consumers plus
pattern hits in adjacent families (leak detection `lib/cashflow-intelligence/leakDetector.ts:226`
"category overspending vs benchmarks", CFO `overspend` action type `lib/cfo/types.ts:563`,
risk modelling) — those are *spending-anomaly* quantities, not budgeted-vs-actual variance,
and are out of this contract's scope (noted so the census denominator stays honest).

## invariants

1. Per semantic: `variance ≡ budgeted − actual` (V1) / `actual − budgeted` (V2, V3) — the
   **sign convention must be stated in the type name or field docs**; today
   `geminiSummary.ts:58` documents "positive = over budget" while master's `:115` documents
   "positive = under budget" for the same field name. A convergence test asserting one
   convention across surfaces would rightly FAIL at HEAD — that is the finding.
2. V1: `entriesReconciled ≤ entriesWithBudget`; entries without transactions contribute
   exactly zero variance (filler property — checkable fixture).
3. V3: `totalVariance === Σ category variances`; a category present on only one side
   appears as budgeted-but-not-spent or spent-but-not-budgeted, never dropped (documented
   contract in the route comment).
4. V4: `percentUsed = actual/budgeted × 100`; status thresholds monotonic.
5. Cross-quantity: no surface may present V2 (plan-vs-declared-run-rate) as if it were
   transactions-vs-plan — the Gemini narrative currently implies actual-spend deviation
   while its actual side is the declared run-rate (wrong-input class finding).

## independentExpectation

**Arithmetic identity per semantic** — each is a subtraction of two independently-known
figures, hand-computable once its two sides are pinned (no legislation involved;
`NONE FOUND` for any external authority). The two *sides* inherit their own contracts'
verifiability: V2/V3's budgeted side is UNVERIFIABLE-by-proxy where benchmark-contaminated
(see the benchmark contract), and V1's income twin inherits MON-128's broken net income.
A variance can be arithmetically perfect and still meaningless if either side is the wrong
quantity — the expectation is therefore identity + side-provenance, never a bare number.

## surfaces

| route | label | semantic |
|---|---|---|
| `/dashboard/cashflow` (route group `(dashboard)`) | GlassBudgetTile: "budget vs actual" totals + per-category statuses | V3 |
| Gemini cashflow narrative (cards fed by `/api/cashflow/summary`) | "Budget Status: $X over/under budget" | V2 |
| `/dashboard/cashflow` intelligence insights | "over budget in {category}" insight rows | V3 |
| Master snapshot API (`/api/master-snapshot`) | `expenses.budgetVariance` / `income.budgetVariance` fields | V1 — **no web UI renders it**; planned mobile surface only (`docs/mobile/api/01_MOBILE_API_CONTRACT.md:102`). |
| `/api/budget/health` | `budgetComparison` payload | V4 — no known caller. |

## expectedMoves

- **T7 direct scope:** V2 and V3's *budgeted side* moves when the budget stops being the
  benchmark-contaminated `totalRealisticBudget` and becomes committed + a remainder
  allocation (see `budget-remainder.md`). Arithmetic: V2 moves by exactly the delta between
  old `totalRealisticBudget` and the new budget definition; direction depends on Reza's
  allocation-mode decision — **cannot be pre-signed until that decision lands** (recorded
  as a decision-gated move, not an unknown).
- V1 values move in **T1** (income twin, when MON-128 re-founds net income) and are
  otherwise **expected NOT to move** in T7 (declared amounts and linked transactions are
  untouched by the remainder work) — a falsifiable no-move prediction.
- V4 and `reconciliation.ts:387/:422`: zero movement — deletion candidates (dead code
  produces no numbers). Any Phase B deletion cites this contract's callSites rows.
- Consolidation moves (Phase B proposals, Reza-gated): V2 out of the route handler into a
  named lib producer; V3's `buildBudgetComparison` into `lib/`; one documented sign
  convention across V1-V3 (a rename/negate refactor — values unchanged, field meaning
  unified).

## decisionsRequired

1. **Do the four semantics all survive?** Recommendation-shaped options (not chosen):
   keep V1 (entry-level, mobile-bound) + V3 (category-level, rendered) under distinct
   names; fold V2 into V3's totals (they answer "am I over my plan?" at two granularities
   from different actual bases — two bases is the drift bug); delete V4 + the reconciliation
   pair as dead. Consequence of folding V2→V3: the Gemini narrative's budget line changes
   basis from declared run-rate to transaction actuals — a semantics change Reza must sign.
2. **One sign convention** — "positive = over" (V2/V3, matches user intuition of
   "overspend") vs "positive = under" (V1, accounting-style favourable variance). Pick one
   app-wide; the other renames.
3. **Should `Expense.budgetedAmount`/`Income.budgetedAmount` (schema :1953/:2052) become
   V1's budgeted side** where set, instead of the declared amount? Consequence: "budget"
   stops meaning "declared amount" for entries the user explicitly budgeted — closer to the
   field's documented intent, but changes V1 wherever budgetedAmount ≠ amount.

## coverageBoundary

**Verifies:** every producer/consumer listed, by reading the four producer implementations
and their call paths end-to-end at HEAD; the dead status of `reconciliation.ts:387/:422`
and `/api/budget/health` by repo-wide caller search (`app/`, `components/`, `lib/`,
excluding tests/docs); sign conventions from the code, not comments alone.
**Does NOT verify:** the 21-site census list item-by-item against this enumeration (the
census is regex-based; adjacent anomaly-detection hits were classified out by family, not
individually); runtime variance values (no DB); mobile app code (out of repo); whether
`cashflowSummary` cache rows in prod hold stale V2 values.

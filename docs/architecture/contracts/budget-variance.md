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
| **V3** | `perCategoryBudgetComparison` | per-category amounts read from the BudgetAnalysis `variableBreakdown` + `recurringBreakdown` blobs (see §7 review: the read is shape-mismatched at HEAD — `Object.entries` over the whole blob treats TOP-LEVEL blob keys as categories) | per-category **actual outflow** from the canonical actuals engine | `variance = actual − budgeted`; positive = over; status OVER/ON_TRACK/UNDER at ±10% (no WARNING tier — corrected §7) | current period of the intelligence engine (month start → now) |
| **V4** | `bankBudgetTargetComparison` | `BudgetTarget` rows (Phase 18 bank module) | categorised `UnifiedTransaction` OUT rows for a YYYY-MM month, transfers excluded | `percentUsed` thresholds; variance −actual when no budget | selected month |

V1's status thresholds: ±5% → under/over/on_track. V1 counts every entry as "having a
budget" (`entriesWithBudget++` unconditionally) — the declared amount doubles as the budget;
`Income.budgetedAmount` (schema :1953) / `Expense.budgetedAmount` (schema :2052) are **not read** by
V1 at HEAD (anchor pairing corrected §7 — :1953 is inside `model Income`, :2052 inside `model Expense`). V2 and V3 both treat a possibly-benchmark-contaminated "budget" as authoritative
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
| `app/api/cashflow/intelligence/route.ts:260-330` | **DIFFERENT-QUANTITY (V3)** | per-category actual−budgeted; own OVER/UNDER/ON_TRACK (±10%) status scale (:310/:322 — no WARNING; corrected §7). |
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
3. **Should `Income.budgetedAmount`/`Expense.budgetedAmount` (schema :1953/:2052) become
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

## Adversarial review (§7) — 2026-07-29

- Claims checked: 24 (anchors 16 · arithmetic 3 · negative-claims 5)
  - Anchors re-verified at HEAD `72b15268`: V1 master :983 (`calculateExpenseBudgetVariance` — budget = `toMonthly(entry.amount)`, actuals-map else zero-variance filler, `variance = budgeted − actual`, ±5% thresholds, `entriesWithBudget++` unconditional — all confirmed line-by-line) + :1160 income twin (def ≈:1156) + interface :109-119 ("positive = under budget" comment confirmed) + :1653/:1660 blanks; V2 summary route :181-182 (`monthlyExpenses − totalRealisticBudget`, actual side = the gated `monthlyRunRate` reduce at :71-75 — declared run-rate, NOT transactions ✓); V3 intelligence :260-330 (union-of-categories, one-side rows kept, `totalVariance = totalActual − totalBudgeted` :314 → invariant 3 holds by construction); V4 `lib/bank/budgetComparison.ts` :37-46 (OVER/WARNING/ON_TRACK/UNDER thresholds — the WARNING tier lives HERE) /:142 (`variance: -actual` no-budget rows) /:197/:338; geminiSummary :58 ("positive = over budget") /:156-158/:297 — the V1-vs-V2 sign-convention contradiction is real and verbatim in both comments; budget/health :161. Census `budgetVariance: 21` confirmed at `.audit/producer-census.json:41` (exact line).
  - **Dead-code claims independently re-attacked, all three CONFIRMED at HEAD:** (a) `reconciliation.ts:387/:422` — repo-wide grep (`lib/`, `app/`, `components/`, `tests/`, `scripts/`) finds zero callers outside the defining file; (b) `/api/budget/health` — zero fetches outside the route itself; (c) master's `budgetVariance` — zero reads in `components/` or any dashboard page (mobile contract doc only).
  - V1 does NOT read `budgetedAmount` — confirmed (the columns are selected into RawExpense/RawIncome but never touched by the variance functions).
- REFUTED / CORRECTED: 3 —
  1. **V3 status scale (semantic table + callSites row): REFUTED as written.** The contract claimed "status OVER/WARNING/ON_TRACK/UNDER" for V3; `buildBudgetComparison` has **no WARNING tier** — per-category and overall statuses are `OVER / UNDER / ON_TRACK` at ±10% (route :310/:322). The four-tier scale belongs to V4 only. Fixed inline.
  2. **V3 budgeted side is a shape-mismatched read (new finding, wrong-input class):** the contract described it as "per-category amounts from the `variableBreakdown` + `recurringBreakdown` blobs", but at HEAD those blobs are NOT flat category→number maps — `variableBreakdown` stores the whole `VariableExpenseResponse` (`{categories:{…}, total, scenarios, assumptions, explanation}`, generate :389/:473) and `recurringBreakdown` stores `buildBreakdownBlob` (`{generatorVersion, committedTotal, committedBreakdown, …, categories, total}`, generate :274-293). `buildBudgetComparison` runs `Object.entries()` over each blob and treats **top-level blob keys as category names**, adding non-numeric values as if they were amounts (route :268-283). The intended semantic and the executing code diverge; the rendered GlassBudgetTile budget side is therefore built from blob metadata keys, not expense categories. Noted inline in the semantic table; tag unchanged (still DIFFERENT-QUANTITY) — but Phase B must treat V3's budgeted side as broken input, not merely laundered input.
  3. **Schema anchor pairing swapped:** :1953 is `Income.budgetedAmount` (model Income :1902) and :2052 is `Expense.budgetedAmount` (model Expense :2021) — the contract paired them the other way. Fixed inline in both places.
- Could not verify: runtime variance values; the 21 census sites item-by-item (family-level classification accepted, as the contract itself discloses); mobile consumers.
- Verdict impact: **the four-semantics split, all V1-V4 tags, and the dead-code deletion candidates stand unchanged.** The V3 refutation narrows V3's status vocabulary and adds a wrong-input finding on its budgeted side; decision #1's "fold V2 into V3" option should now also weigh that V3's budgeted side needs re-plumbing regardless. No DUPLICATE↔DIFFERENT-QUANTITY reclassification.

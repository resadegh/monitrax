# budgetRemainder (variable-spending allocation base)

> **Quantity Contract — MON-131 Phase A (brief §3), tranche T7 (MON-127).**
> READ-ONLY specification at HEAD `fa392b9a`, 2026-07-29. No production code was changed.
> Registry context: MON-127 (OPEN) — *"budget remainder is never computed as
> monthlyNetIncome − committed; the ABS household benchmark stands in as the budget and is
> mislabelled 'Variable (AI Est.)'"*. MON-125/126 fixed the committed side (VERIFIED at
> VR-041: committed $14,261 · loans $12,779 · recurring $1,482).

## classification

**DERIVED** (D1). Computed from two other DERIVED quantities (`monthlyNetIncome`,
`monthlyCommitted`), which are in turn computed from FACTs. Never stored (D2).

## semantic

```
budgetRemainder = monthlyNetIncome − monthlyCommitted
```

- **basis** — declared run-rate, monthly, AUD.
- **minuend** — `monthlyNetIncome`: the canonical after-tax monthly income (MON-128's
  quantity — see *expectedMoves* for the hard dependency).
- **subtrahend** — `monthlyCommitted`: recurring essential expense run-rate (one-off gated,
  `monthlyRunRate`) **plus** canonical loan cost (`resolveLoanCostsForUser`, actuals-first,
  IO loans never $0). This is the register's `monthlyCommitted` ($14,261 at VR-041), already
  single-sourced by MON-125/126 on the budget-generate path.
- **window** — current run-rate (no trailing window; it is a plan number, not an actuals number).
- **inclusions/exclusions** — one-offs excluded from both sides (gated); transfers not
  applicable (declared basis); discretionary tracked spending and AI/benchmark variable
  estimates are explicitly **NOT** part of committed — they are candidate *allocations OF*
  the remainder, never inputs to it.
- **meaning** — the money the user actually has left each month after unavoidable
  obligations; the ONLY legitimate base for variable-spending allocation. The three
  allocation modes (see *decisionsRequired*) allocate **this** number. Today nothing does.

## canonicalHome

**NOT ESTABLISHED.** Verified at HEAD: **no function in `lib/`, `app/api/`,
`app/dashboard/`, or `components/` computes `monthlyNetIncome − monthlyCommitted`.**
This is a capability gap, not a multiplicity problem — the finding is the absence.

- `calculateBenchmarkExpenses` (`lib/budget-analysis/aiPrompt.ts:311`, verified at HEAD —
  anchor NOT drifted) takes `(params: BenchmarkParams, trackedCategories)` — household
  composition only. **Income is not in its signature and not in its scope.** The budget
  generator therefore produces a "budget" whose variable component is income-blind.
- The closest existing computations subtract the *whole realistic budget* (which already
  contains the benchmark/AI variable estimate), not *committed* — a different quantity with
  a circularity: the budget total being subtracted was itself built from the benchmark.

Proposed home (Phase B, for Reza's gate — not created in this phase): a pure function in
`lib/budget-analysis/` (or `lib/calculations/`) taking `{ monthlyNetIncome, monthlyCommitted }`
and returning the remainder + its allocation under a chosen mode. Decimal twin required if a
Decimal income/committed producer exists at build time (D14 / §7 rule 4).

## callSites

No producer exists, so every site below is a **DIFFERENT-QUANTITY** neighbour or an input
consumer. All anchors verified at HEAD 2026-07-29.

| file:line | tag | what it actually computes |
|---|---|---|
| `app/dashboard/debt-planner/page.tsx:343` | DIFFERENT-QUANTITY | `remainingCashflow = monthlyIncome − totalBudget` where `totalBudget = userFinalBudget ?? totalRealisticBudget` (committed + discretionary + variable). Not the remainder: subtrahend includes the AI/benchmark variable estimate. Income side is `/api/calculate/cashflow → output.monthlyNetIncome` (its own producer). |
| `app/dashboard/debt-planner/page.tsx:344` | DIFFERENT-QUANTITY + **WRONG-INPUT** | `availableForDebt = remainingCashflow − totalLoanRepayments`. Post-MON-125, `totalRealisticBudget`/`userFinalBudget` **already contain loan repayments inside committed**, so loans are subtracted **twice** (~$12,779/mo understatement) for any analysis generated at `GENERATOR_VERSION ≥ 2`. Feeds `availableForExtraRepayments` into the debt plan at `page.tsx:466`. |
| `app/api/ai/debt-analysis/route.ts:194` | DIFFERENT-QUANTITY | `monthlySurplus = monthlyNetIncome − monthlyExpenses` where `monthlyExpenses = userFinalBudget` when a confirmed budget exists. Same shape as :343, server-side, with its **own local net-income producer** at :166–184 (a third income implementation on this path alone). |
| `app/api/ai/debt-analysis/route.ts:206` | DIFFERENT-QUANTITY + **WRONG-INPUT** | `calculatedAvailable = max(0, monthlySurplus − totalLoanRepayments)` — same post-MON-125 loan double-subtraction as `page.tsx:344`. |
| `app/api/budget-analysis/generate/route.ts:266-269` | CONSUMER (of the remainder's inputs) | `incomeSanity`: fetches `snapshot.quickMetrics.monthlyIncome` and flags `total > monthlyNetIncome`. Reads both inputs the remainder needs but only produces a boolean; the remainder itself is never computed or shown. |
| `app/api/budget-analysis/generate/route.ts:401-423` (and benchmark twin :481-503) | DIFFERENT-QUANTITY | The minimum/recommended/comfortable **scenarios**. These are today's de-facto "allocation modes" but they allocate the **AI/benchmark variable estimate** on top of committed+discretionary — they never see income. Under the target semantic the three modes allocate the remainder instead. |

## invariants

Checkable properties that become permanent tests (Ring 0/2) once the producer exists:

1. `budgetRemainder === monthlyNetIncome − monthlyCommitted` (arithmetic identity, exact).
2. `budgetRemainder + monthlyCommitted === monthlyNetIncome` (reconstruction identity).
3. Any allocation mode's parts sum to ≤ the remainder: `Σ allocations ≤ budgetRemainder`
   (an allocation exceeding the remainder must carry an explicit over-allocation flag — the
   `incomeSanity.exceedsIncome` pattern, never silent).
4. The remainder may legitimately be **negative** (committed > net income). A negative
   remainder must surface as a deficit, never clamped to 0 — note
   `app/api/ai/debt-analysis/route.ts:206` clamps with `max(0, …)` today, which hides deficits.
5. Sign/parity: computed with the same `monthlyNetIncome` figure on every surface (same
   `semanticKey` → same engine, Neomatrix A3).

## independentExpectation

**Arithmetic identity** — verifiable without reading any other screen: take the canonical
`monthlyNetIncome` and `monthlyCommitted` figures and subtract. At the VR-041 census values,
`monthlyCommitted = $14,261`; the income side is **currently unverifiable** (see MON-128:
`quickMetrics.monthlyIncome` = $41,303/mo labelled net-of-PAYG against declared gross
$317,751/yr = $26,479/mo — net exceeds gross, so no honest worked example is possible until
T1 lands). Once MON-128 fixes income, the worked example is
`remainder = monthlyNetIncome − 14,261` and is exact.

## surfaces

Routes that would render it / today render the stand-in. (The remainder itself renders
**nowhere** today — that is MON-127.)

| route | label today | note |
|---|---|---|
| `/dashboard/budget-analysis` | "Variable (AI Est.)" card (`page.tsx:562`) | **The mislabel.** The card shows the AI or ABS-benchmark variable estimate — an income-blind reference — standing where a remainder-derived allocation belongs. The page never reads the generate route's `usedAI`/`fallbackReason` (returned at `generate/route.ts:438` and :510-511), so a benchmark fallback still displays as "AI Est."; the only disclosure is buried in `aiExplanation` free text. |
| `/dashboard/budget-analysis` | "Total Realistic" / scenario cards | committed + discretionary + variable — would become committed + allocated-remainder under the target semantic. |
| `/dashboard/debt-planner` | "Available for Debt" card (`page.tsx:626-627`), "Income − budget − loans" band | renders the DIFFERENT-QUANTITY neighbours above, currently with the loan double-subtraction. |

## expectedMoves

Written BEFORE migration (brief §3 rule). **The remainder cannot be computed correctly
until MON-128 (T1, net income) is merged** — this contract's producer must NOT be built on
`quickMetrics.monthlyIncome` as it stands (net > gross). Hard dependency, stated per the
brief's precondition-hunting mandate (§4.7):

- `pathPrefix: app/dashboard/budget-analysis` — a NEW number appears (the remainder);
  existing committed/discretionary figures **do not move** (their producers are already
  canonical post-MON-125/126). The "Variable" figure moves only if Reza selects an
  allocation mode that departs from the AI/benchmark estimate (decision below).
- `pathPrefix: app/dashboard/debt-planner` — `availableForDebt` moves **upward by the
  resolved monthly loan cost (~$12,779/mo at VR-041)** for post-v2 confirmed budgets when
  the double-subtraction is removed; arithmetic: `netIncome − budget − loans` →
  `netIncome − budget` (loans already inside budget), or re-founded directly on the
  remainder. Requires MON-128 first or the figure moves twice.
- `pathPrefix: app/api/ai/debt-analysis` — same movement, same arithmetic; also deletes the
  local income producer at :166-184 (T1 scope).
- **Precondition found (save-choice composition bug, verified at HEAD):**
  `app/api/budget-analysis/save-choice/route.ts:93` sets `minimum` choice to
  `recurringExpensesTotal + minimumScenario.total` = **2× committed** post-MON-125 (both
  terms are `committedMonthly`); `:99` (`comfortable`) double-counts committed the same way;
  `:136` (custom adjustments) drops discretionary. Any remainder built downstream of
  `userFinalBudget` inherits these. Must be fixed or bypassed before T7 verification.
- **Precondition (stale-analysis serve):** `/api/budget-analysis/latest/route.ts:26-32`
  serves the newest analysis with **no `generatorVersion` check** — the v<2 regeneration
  gate exists only inside POST `/generate` (`route.ts:93-103`), which the budget page calls
  only when no analysis exists or the user clicks Regenerate. A user who only ever loads the
  page keeps seeing a v1 (contaminated-committed) analysis. T7 verification on live data
  must first confirm the analysis on screen is v≥2.

## decisionsRequired

**The three allocation modes — the decision space, NOT chosen here (brief §3.1 rule 6).**
Once the remainder exists, it can be handed to the user in three ways; each is a product
philosophy with different behavioural consequences:

1. **Benchmark-shaped allocation** — split the remainder across variable categories in the
   proportions of the ABS benchmark (the benchmark supplies *shape*, income supplies *size*).
   Consequence: every category budget scales with income; a low-income household never sees
   category budgets that sum beyond its means; the benchmark survives as a reference, not a
   budget.
2. **Benchmark-capped allocation** — allocate variable categories at the benchmark's dollar
   estimates, capped so the total never exceeds the remainder; surplus remainder is shown
   explicitly as unallocated ("left to save / to debt"). Consequence: category numbers stay
   recognisable ("groceries ≈ what a household like yours spends") and the gap between
   remainder and benchmark total becomes a visible savings/deficit signal.
3. **User-directed allocation** — present the remainder as one number and let the user
   allocate it across categories themselves, with the benchmark shown alongside each
   category purely as a "typical household" reference line. Consequence: maximum ownership,
   most honest, highest effort; needs the strongest empty-state design.

Also required from Reza: (a) whether a **negative remainder** blocks budget confirmation or
only warns; (b) whether the debt-planner's "available for debt" becomes
`remainder − variable allocation` or stays a separate named quantity.

## coverageBoundary

**Verifies:** the absence of any `monthlyNetIncome − committed` producer (symbol + pattern
search over `lib/`, `app/api/`, `app/dashboard/`, `components/`); the exact semantics and
line anchors of every neighbouring computation listed above; the save-choice and latest-route
behaviours by reading those files end-to-end at HEAD.
**Does NOT verify:** runtime values (no DB access this phase — the loan double-subtraction
is proven from code composition, not from a rendered number; magnitude ~$12,779/mo is the
VR-041 figure, not re-measured); `/api/calculate/cashflow`'s internal income semantics beyond
its orchestrator field names; mobile-app consumers (docs-only at HEAD); whether any historical
BudgetAnalysis rows in prod are v1 vs v2.

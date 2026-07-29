# absBenchmarkVariableExpenseEstimate

> **Quantity Contract — MON-131 Phase A (brief §3), tranche T7 (MON-127).**
> READ-ONLY specification at HEAD `fa392b9a`, 2026-07-29.
> **This is the classic DIFFERENT-QUANTITY of the T7 tranche:** an ABS-derived household
> expenditure *reference* that today stands in as the user's budget and is displayed under
> an AI label. It is a legitimate quantity that survives under its own name — it is
> **never the budget** (design record §4 T7: *"keep the ABS benchmark as a reference,
> never as the budget. Label what actually produced the number."*).

## classification

**DERIVED** (D1) — but derived from **household-composition FACTs plus hardcoded benchmark
constants**, not from the user's financial FACTs. No income, no expenses, no transactions
enter it. It is a *demographic reference estimate*, the same species as "72% of households
like yours" — informative, never authoritative about this user's money.

## semantic

- **producer** — `calculateBenchmarkExpenses(params, trackedCategories)`.
- **basis** — per-category monthly AUD estimates from the `BASE_COSTS` table
  (`lib/budget-analysis/aiPrompt.ts:289-302`, header comment: *"Australian Bureau of
  Statistics household expenditure benchmarks (2023-24)"*) scaled by household composition
  (adults, children with a ≥13 teen split, pets by type, cars) and a lifestyle multiplier
  (`LIFESTYLE_MULT` :305-309 — FRUGAL 0.7 / MODERATE 1.0 / COMFORTABLE 1.35).
- **window** — none; a static monthly estimate.
- **inclusions** — 12 variable categories (GROCERIES … MISCELLANEOUS), each gated: a
  category is skipped when the matching tracked category exists (`trackedCategories` set) —
  the anti-double-counting contract. DINING_OUT / CLOTHING / MEDICAL / GIFTS /
  HOME_MAINTENANCE / MISCELLANEOUS are **unconditional** (no gate) at HEAD.
- **exclusions** — everything tracked as recurring (rent, utilities, insurance,
  subscriptions, loan repayments); the user's actual income and spending.
- **scenarios** — `minimum = 0.75×total`, `recommended = 1.0×total`,
  `comfortable = 1.3×total` (:474-487). Note the multiplier asymmetry with the sibling AI
  path and with `LIFESTYLE_MULT` (0.7/1.0/1.35) — three similar-but-different scaling
  triples exist around this quantity.
- **units** — AUD/month, rounded per category and at the total.
- **identity rule** — the number must always be labelled as what it is: an
  Australian-household benchmark estimate. Displaying it as "AI Est." or as "your budget"
  is identity laundering.

## canonicalHome

`lib/budget-analysis/aiPrompt.ts:311` — `calculateBenchmarkExpenses`
(**anchor verified at HEAD — NOT drifted; matches the brief's cited line exactly**).
Single producer; no Decimal twin exists (none required at its precision — flag for D14
review only if a Decimal budget path is created in Phase B). Producer-multiplicity verdict:
**CLEAN (1 producer)** — the problem with this quantity is not multiplicity, it is
**labelling and role** (it impersonates two other quantities downstream).

## callSites

All anchors verified at HEAD 2026-07-29.

| file:line | tag | note |
|---|---|---|
| `app/api/budget-analysis/generate/route.ts:355` | CONSUMER | fallback when the AI response fails validation. |
| `app/api/budget-analysis/generate/route.ts:449` | CONSUMER | fallback when Gemini is not configured or throws. |
| `app/api/budget-analysis/generate/route.ts:472-477, 393-397` | CONSUMER → **identity laundering point** | the benchmark result is persisted into fields named `aiVariableEstimate` / `variableBreakdown` / `missingVariableExpenses` and summed into `totalRealisticBudget`. From this point downstream the provenance (AI vs benchmark) is recoverable only from `aiConfidence` (0.5 vs 0.75) and the `explanation` free text — no structured flag is stored. |
| `lib/budget-analysis/aiPrompt.ts:471-494` | (self) | scenario scaling + the honest `explanation` string ("…as AI service was unavailable"). |
| `app/dashboard/budget-analysis/page.tsx:562` | CONSUMER (mislabelled surface) | renders as **"Variable (AI Est.)"** regardless of provenance; the page ignores the `usedAI`/`fallbackReason` response fields (`generate/route.ts:438, 510-511`). |
| `app/api/cashflow/summary/route.ts:181-182` | CONSUMER (laundered) | consumes `totalRealisticBudget` (benchmark-contaminated when fallback ran) as "the budget" for a variance fed to the Gemini narrative. |
| `app/api/cashflow/intelligence/route.ts:267-283` | CONSUMER (laundered) | `buildBudgetComparison` treats `variableBreakdown` (possibly benchmark) as the per-category *budget* side. |
| `app/api/ai/debt-analysis/route.ts:190-193` | CONSUMER (laundered) | `userFinalBudget` (benchmark-contaminated via scenarios/save-choice) becomes `monthlyExpenses` in the debt-analysis prompt. |
| `VARIABLE_EXPENSE_ESTIMATION_PROMPT` (`aiPrompt.ts:18-112`) | DIFFERENT-QUANTITY (sibling) | the **AI-estimated** variable expense quantity — same shape and same downstream fields, different producer (Gemini, grounded by `groundVariableExpenseTotal` :264-272). The stored fields conflate the two; under the one-name-per-semantic rule they are two provenances of one quantity and the stored record must say which produced it. |

## invariants

1. `total === Σ categories[*].estimate` — holds by construction (accumulator); keep as a
   Ring-0 fixture so refactors can't break it. (The AI sibling needs
   `groundVariableExpenseTotal` for the same guarantee; the benchmark does not.)
2. `scenarios.minimum.total ≤ scenarios.recommended.total ≤ scenarios.comfortable.total`
   (0.75 ≤ 1.0 ≤ 1.3 of a non-negative total).
3. **Never exceeds its gates:** a category present in `trackedCategories` under a gated key
   (FOOD, TRANSPORT, ENTERTAINMENT, PERSONAL) contributes 0 — checkable per category.
   (Stated precisely: only these four keys are gated at HEAD; an invariant claiming "never
   overlaps ANY tracked category" would be false — the 6 ungated categories can double-count
   against unconventionally-categorised tracked expenses. That gap is a finding for Phase B,
   not an invariant.)
4. Deterministic: same `params` + same `trackedCategories` → identical output (pure
   function, no I/O, no Date) — safe for golden-baseline diffing.
5. **Role invariant (the MON-127 rule, testable at the surface):** wherever this number
   renders, the label must attribute it to the benchmark ("typical Australian household"),
   never to AI and never as "your budget". Ring-3 checkable via the provenance flag once one
   is stored.

## independentExpectation

**UNVERIFIABLE against law or source — stated honestly (`NONE FOUND` for external
verification).** The `BASE_COSTS` constants claim ABS 2023-24 household expenditure data but
carry **no citation, no series ID, no retrieval date**; ABS HES is not legislation and the
mapping from HES categories to these 12 app categories is unstated. There is no independent
authority against which $400/adult groceries can be *proven*. What CAN be verified
independently: the internal arithmetic (composition × constants × multiplier — hand-computable
worked example: 2 adults, 0 children, 0 pets, 2 cars, MODERATE, no tracked categories →
GROCERIES 800 + FUEL 500 + ENTERTAINMENT 300 + DINING_OUT 200 + PERSONAL_CARE 160 +
CLOTHING 160 + MEDICAL 80 + GIFTS 100 + HOME_MAINTENANCE 100 + MISC 150 = **$2,550/mo**),
and the scenario multiples. Per the brief, this quantity is recorded **UNVERIFIABLE** in the
Number Ledger for its external claim; its internal identities get fixtures.

## surfaces

| route | label | honesty |
|---|---|---|
| `/dashboard/budget-analysis` | "Variable (AI Est.)" summary card (`page.tsx:562`) | **WRONG when fallback ran** — benchmark displayed under an AI label; `usedAI:false` / `fallbackReason` are returned by the API and dropped by the page. Only disclosure is the `aiExplanation` sentence inside "How We Calculated This" (`page.tsx:835-849`). |
| `/dashboard/budget-analysis` | "Your tracked expenses are missing ~$X/month" warning (`page.tsx:590-607`); scenario cards; "Adjust Variable Expenses" editor (AI-shaped: `confidence` badges on benchmark rows read as AI confidence) | benchmark values presented in AI clothing. |
| `/dashboard/debt-planner` | "Budget" line `(recurring + variable)` (`page.tsx:611-613`) | laundered via `userFinalBudget`/`totalRealisticBudget`. |
| `/dashboard/cashflow` (route group `app/(dashboard)/cashflow/page.tsx:651-658`) | GlassBudgetTile budget side | laundered via `variableBreakdown`+`recurringBreakdown` per-category blobs. |
| Gemini cashflow narrative (`lib/cashflow-intelligence/geminiSummary.ts:156-158`) | "Budget Status: $X over/under budget" | laundered via `totalRealisticBudget`. |

## expectedMoves

- **This quantity's own values move nowhere in T7** — the producer is untouched; the
  strongest prediction (brief §3: no-movement is the easiest to falsify). What changes is
  its **role and label**: it stops being stored/displayed as the budget and survives as a
  named reference (`absBenchmarkVariableExpenseEstimate`) shown alongside the remainder
  allocation.
- `pathPrefix: app/dashboard/budget-analysis` — the "Variable (AI Est.)" card label changes
  to attribute provenance (AI vs benchmark vs remainder-allocation per the MON-127 decision);
  the underlying dollar figure moves only if Reza's allocation-mode decision replaces the
  estimate with a remainder allocation (see `budget-remainder.md` decisionsRequired).
- A structured provenance field (`source: 'AI' | 'ABS_BENCHMARK'`) must be stored at
  generate-time for the label to be honest — a schema/blob addition, flagged for Phase B.
- Dependency ordering: label-honesty fixes are independent of MON-128; role change
  (reference vs budget) depends on the remainder existing, hence on MON-128 → T7.

## decisionsRequired

1. **Where does the benchmark appear once demoted to a reference?** Options: (a) a
   per-category reference line inside the variable editor ("typical: $X"); (b) a single
   comparison row ("typical household like yours: $Y/mo total"); (c) hidden entirely unless
   AI is unavailable. Behavioural consequence: (a) normalises without shaming (Part 0.1
   psychologist lens) but adds density; (c) loses the normalisation benefit.
2. **Cited constants** — replace the uncited `BASE_COSTS` with a cited, dated benchmark
   table (ABS HES series + retrieval date) or keep and label as internal heuristics.
   Consequence: without citation the app is quoting numbers it cannot trace (Part 0.3 "the
   financial adviser lens never invents a number").
3. **Ungated categories** — should the 6 unconditional categories gain tracked-category
   gates? Consequence: current behaviour can double-count (e.g. tracked "Dining"
   under a custom category + DINING_OUT estimate).

## coverageBoundary

**Verifies:** the full text of `lib/budget-analysis/aiPrompt.ts` and
`app/api/budget-analysis/generate/route.ts` at HEAD; the surface labels on
`app/dashboard/budget-analysis/page.tsx`; the laundering paths into cashflow summary /
intelligence / debt-analysis by reading those handlers; anchor `aiPrompt.ts:311` confirmed
exact.
**Does NOT verify:** the external truth of any `BASE_COSTS` figure (declared UNVERIFIABLE);
Gemini's actual runtime behaviour on the AI sibling path; whether real stored analyses in
prod carry benchmark or AI provenance (needs DB/Ring-3); mobile consumers.

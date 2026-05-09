# Phase 43.2 — Spending Pareto Lens

> **Status:** 🟡 **SHIPPING IN THIS PR** (`claude/phase-43-2-spending-pareto-MG8mr`).
> **Scope:** A typography-led analytical card on `/dashboard/expenses` that surfaces the *vital few* spending categories driving ~80% of monthly outgoings. No new calc engine. No `quickMetrics` changes. One thin endpoint.
> **Estimated effort:** ~half day end-to-end (delivered).
> **Last updated:** 2026-05-09 — Reza + Claude.
> **Predecessor:** Phase 43.1 (Hidden Wealth Lens) — PR [#738](https://github.com/resadegh/monitrax/pull/738), merged 2026-05-09.

---

## 1. Strategic positioning

Second deferred follow-on from the Stark Naked Numbers translation (PHASE_43_MONEY_STORY.md §8 named four; this is #2). Andrew's Principle 3 includes the controversial advice:

> *"Fire your worst 20% of customers."*

Inverted for personal finance: **don't cut 20% of your spending categories — focus your attention on the 20% (or fewer) that drive 80% of your outgoings.** This is the personal-finance application of the Pareto principle (Vilfredo Pareto, 1896 — *80% of effects come from 20% of causes*) made concrete: a quarterly review of the top ~4 spending lines moves more money than reviewing all 30.

**The behavioural barrier this addresses:** when users open `/dashboard/expenses` today, they see a complete list (recurring + one-off + by-category + by-merchant) — useful for the data, useless for the *decision*. The cognitive cost of "where do I start?" is so high (Mani et al. 2013 — financial stress depletes 13 IQ points) that the user closes the page without action. The Pareto lens collapses 30 lines into 4 — *here's where your attention earns the most return*.

---

## 2. The Pareto cut

```
Sort categories by monthly spend descending.
Walk the list, accumulating cumulative percentage.
The "vital few" = every category up to and including the one that
  pushes cumulative ≥ 80% of total spend.
The "trivial many" = everything after.
```

**Two guardrails on the route, not the lens:**

| Guardrail | Why |
|---|---|
| `MAX_VITAL_FEW = 8` | If 80% is spread across 30+ categories, the user doesn't have a Pareto problem to focus on — they have a budget shape that's already balanced. False precision on the "top 8" is worse than admitting the Pareto principle doesn't help here. |
| `vitalFew = []` when `totalMonthlySpend === 0` | A new user with no spending data gets silence (lens self-hides), not a placeholder. |

---

## 3. Architectural decisions

| # | Decision | Rationale |
|---|---|---|
| **D-43.2-1** | **Zero new calc engines.** The Pareto cut reads `snapshot.expenses.monthly.byCategory` (already canonically computed by `aggregateExpensesByCategory` in `expenseAggregator.ts`). Sorting + cumulative-percentage walk happens in the route. | CLAUDE.md §6.1 + §12.2 SSOT. The Pareto cut is presentation-layer logic; doesn't belong in `lib/calculations/` (which is pure-data engines). |
| **D-43.2-2** | **No new fields on `quickMetrics`.** Same rule as Phase 43.1 — promote-on-second-use, not on speculation. | If a second surface (e.g. a mobile widget) needs the vital few in the future, *then* promote. |
| **D-43.2-3** | **New thin endpoint** `/api/dashboard/spending-pareto`. Returns `{vitalFew, vitalFewTotal, vitalFewPct, trivialManyCount, trivialManyAmount, trivialManyPct, totalMonthlySpend, totalCategoryCount}`. `withPermission('report.read')`. | Same family as Phase 43.1's `/api/dashboard/hidden-wealth`. Tiny payload; the lens consumes it directly without re-derivation. |
| **D-43.2-4** | **Categories, not merchants, at v1.** Andrew's "fire your customers" framing maps more naturally to merchants (each transaction has a payee). But the current snapshot exposes only `byCategory`, and merchants are coarser-grained per-transaction data. Categories give a cleaner, more actionable surface (the user can act on "Housing" — they can't act on "Coles" without breaking food into discrete decisions). | Future **Phase 43.2.1** could add a merchant-level variant if signal demands it. Out of scope for v1. |
| **D-43.2-5** | **Typography-led card, no glass.** Same family as `HiddenWealthLens` — subtle border + faint background. The page already has its own existing tile vocabulary; introducing a glass card would clash. | Apple/Linear/Stripe restraint. |
| **D-43.2-6** | **No red anywhere, even at 50% concentration.** Even a category at 50% of monthly spend is rendered in slate; the framing is "where to focus" never "where you've failed". | Loss aversion (Kahneman & Tversky). The Pareto principle is a *focus aid*, not a verdict. |
| **D-43.2-7** | **Locus-of-control closing copy.** *"A quarterly check on these 4 categories is the highest-leverage spending review you can do."* The user is the actor, the lens just points at the leverage. Never prescriptive ("you should cut X by Y%"). | Behavioural-psychology warm-words rule (CLAUDE.md §14.3). The lens identifies *where*; the user decides *what*. |

---

## 4. Data flow

```
masterFinancialService.getMasterFinancialSnapshot()
    │
    └── expenses.monthly.byCategory     [ { category: string, amount: number }, ... ]
            │
            ▼
GET /api/dashboard/spending-pareto      ── thin wrapper, withPermission('report.read')
    │  sort desc → walk → cut at ≥ 80% cumulative or MAX_VITAL_FEW
    │  returns { vitalFew, vitalFewTotal, vitalFewPct, trivialMany*, totalMonthlySpend, totalCategoryCount }
    │
    ▼
/app/dashboard/expenses/page.tsx        ── one fire-and-forget fetch added
    │
    ▼
<SpendingParetoLens ... />              ── pure presentational, computes nothing
```

No new calc engine. No new derived fields on `quickMetrics`. No duplicate aggregation.

---

## 5. Visualisation

```
┌──────────────────────────────────────────────────────────────────┐
│  WHERE 80% OF YOUR SPENDING GOES                $5,920 / month   │
│                                                                  │
│  4 categories handle $4,820 — 81% of your monthly spend.         │
│                                                                  │
│  1   Housing                                $1,950               │
│      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓     33%  │
│  2   Food & groceries                         $980               │
│      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                              17%   │
│  3   Transport                                $920               │
│      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                 16%   │
│  4   Utilities                                $970               │
│      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                  16%   │
│                                                                  │
│  ─── 12 more categories make up the other 19% · $1,100 ─────    │
│                                                                  │
│  A quarterly check on these 4 categories is the highest-         │
│  leverage spending review you can do.                            │
└──────────────────────────────────────────────────────────────────┘
```

### Mini-bar scaling

Each row's mini-bar width is `pct ÷ maxPct × 100` — i.e. the #1 category fills 100% of its row's bar; everything else scales proportionally to it. This makes the visual rank honest without forcing any row to look "small" relative to a normalised scale.

### Behavioural-psychology rules (NON-NEGOTIABLE — registered in `06_UI_UX_FOUNDATION.md`)

| Principle | Citation | How the lens answers |
|---|---|---|
| **Cognitive ease** | Kahneman, *Thinking Fast and Slow* | 4 numbered lines vs 30. The list is sequenceable + concrete. |
| **No red anywhere** | Kahneman & Tversky, loss aversion | Even Housing at 33% is slate, not amber/red. The framing is focus, not failure. |
| **Locus-of-control** | Bandura, self-efficacy + Rotter | *"the highest-leverage spending review you can do"* — the user is the actor, the lens points at the leverage. |
| **Concreteness** | Heath & Heath, *Made to Stick* | Numbered list (1, 2, 3, 4) + dollar amounts + percentages — three concrete handles per row. |
| **Pareto framing as opportunity, not verdict** | Pareto principle (1896) | Even when the vital few hit 95% (extreme concentration), the closing copy stays neutral. *The lens identifies where; the user decides what.* |

---

## 6. Acceptance criteria

- [x] Lens renders on `/dashboard/expenses` between `<PageHeader>` and the search/filter bar.
- [x] Lens self-hides when `vitalFew.length === 0` OR `totalMonthlySpend ≤ 0` OR the API fetch failed.
- [x] Pareto cut walks sorted-by-spend-desc, stops at cumulative ≥ 80% OR `MAX_VITAL_FEW = 8`, whichever first.
- [x] Inline mini-bar per row scales proportionally to the #1 category's `pct`.
- [x] No red anywhere — Pareto is a focus aid, not a verdict.
- [x] Lens reads from `/api/dashboard/spending-pareto` only — no inline math, no client-side aggregation.
- [x] Endpoint is `withPermission('report.read')`.
- [x] No new fields on `MasterFinancialSnapshot.quickMetrics` (D-43.2-2).
- [x] Inline JSDoc on `SpendingParetoLens.tsx` covering composition rules + behavioural-psychology citations (CLAUDE.md §16.4).
- [x] `npx tsc --noEmit` clean.

---

## 7. What's NOT in this PR

| Follow-on | Where | Why deferred |
|---|---|---|
| **Phase 43.2.1 — Merchant-level Pareto** | Same lens, swap data source from `byCategory` to a per-merchant aggregation of `unified_transactions`. | Out of scope for v1. Would need a new aggregator + endpoint variant. Promote only if usage signal demands it. |
| **Margin Trend** on `/dashboard/budget-analysis` | Savings-rate sparkline as first-class metric. Andrew's GP-margin direction-matters principle. | Phase 43.3 — queued. |
| **Tighter `enoughHistory` gate** for the Money Story Hero | ≥90-day transaction history check via `linkageHealthService`. | Phase 43.4 — queued. |
| **SurfaceDescriptor registration** | `lib/calc-audit/surfaces/dashboardExpensesSpendingPareto.ts` | Gated on Phase 41i.6a registry foundation shipping. Contract: each rendered $-amount traces to its source path (`snapshot.expenses.monthly.byCategory[i].amount`). |

---

## 8. References

- Pareto, V. (1896). *Cours d'économie politique* — the original 80/20 observation.
- Andrew, J. (2018). *Stark Naked Numbers* — Principle 3 (Supercharge Your Cash Flow), customer-profitability section.
- Mani, A., Mullainathan, S., Shafir, E., & Zhao, J. (2013). *Poverty Impedes Cognitive Function.* Science 341(6149), 976–980.
- Kahneman, D. & Tversky, A. (1979). *Prospect Theory: An Analysis of Decision under Risk.*
- Bandura, A. (1977). *Self-efficacy: Toward a unifying theory of behavioral change.*
- Heath, C. & Heath, D. (2007). *Made to Stick.*
- `docs/blueprint/PHASE_43_MONEY_STORY.md` — original architect-mode synthesis; this is follow-on #2 of four.
- `docs/blueprint/PHASE_43_1_HIDDEN_WEALTH.md` — predecessor; same SSOT + thin-endpoint + typography-led-card pattern.
- CLAUDE.md §0 (Advisory Mindset), §6.1 + §12.2 (SSOT), §14 (TRAIL framework + warm-words rule), §16 (Doc-sync protocol).
- `docs/architecture/06_UI_UX_FOUNDATION.md` — registers `SpendingParetoLens` as a canonical typography-led analytical card pattern (same family as `HiddenWealthLens`).

# Phase 43.3 — Margin Trend Lens

> **Status:** 🟡 **SHIPPING IN THIS PR** (`claude/phase-43-3-margin-trend-MG8mr`).
> **Scope:** A typography-led analytical card on `/dashboard/budget-analysis` that surfaces savings-rate trend over the last 6 months as a sparkline + delta-from-last-month. Direction is the load-bearing insight; the absolute number is context.
> **Estimated effort:** ~half day end-to-end (delivered).
> **Last updated:** 2026-05-09 — Reza + Claude.
> **Predecessor:** Phase 43.2 (Spending Pareto Lens) — PR [#739](https://github.com/resadegh/monitrax/pull/739), merged 2026-05-09.

---

## 1. Strategic positioning

Third deferred follow-on from the Stark Naked Numbers translation (PHASE_43_MONEY_STORY.md §8 named four; this is #3). Andrew's Principle 2 is **Maximize Your Margins** — but the harder, more important rule embedded in it is *"the direction of your GP margin matters more than the absolute"*. A 28% margin trending down is a worse position than a 22% margin trending up. The book argues this because compound effects are slope-driven: small consistent improvements compound dramatically; large absolute numbers without direction stagnate.

**Personal-finance translation:** the existing `/dashboard/budget-analysis` page is an AI-generated *one-shot estimate* — useful for planning, useless for *progress*. The user has no way to answer *"am I actually getting better at this over time?"* from anywhere on the dashboard today. The Margin Trend lens does, in **one big number + one curve**:

- The big number is the current month's savings rate.
- The pill anchors the user to direction (up / down / flat).
- The sparkline shows 6 months of history.
- The closing copy reframes any single month against the slope.

This is the Bandura self-efficacy principle (visible progress reinforces capability) operating on a Stark-Naked-Numbers metric.

---

## 2. Computation

```
For each of the last 6 calendar months (UTC, current month inclusive):
  monthlyIncome  = sum(UnifiedTransaction.amount where direction=IN
                       AND !isTransfer AND !isInvestmentContribution)
  monthlyExpense = sum(...where direction=OUT...)
  netCashflow    = monthlyIncome − monthlyExpense
  savingsRate    = (netCashflow / monthlyIncome) × 100  (0 when income=0)

Trend direction (sliding window):
  recentAvg = avg(savingsRate of last 3 months)
  priorAvg  = avg(savingsRate of prior 3 months)
  delta     = recentAvg − priorAvg
  trend     = 'up'   if delta ≥  +2pp
              'down' if delta ≤  −2pp
              else 'flat'

Self-hide gate:
  enoughHistory = monthsWithIncome ≥ 3
```

The 2pp threshold is the noise floor below which trend talk would be misleading on transactional data. The sliding-window average (3-vs-3) is more stable than month-on-month deltas, which swing on a single big bill.

---

## 3. Architectural decisions

| # | Decision | Rationale |
|---|---|---|
| **D-43.3-1** | **Read `prisma.unifiedTransaction` directly** for monthly historicals. The master snapshot's frequency-based income/expense aggregation (current point-in-time view) cannot answer "what was my margin in March 2026?" — it would extrapolate current rates backwards, producing a flat line. UnifiedTransaction is the only honest source for actual historical margin. | CLAUDE.md §6.1 + §12.2 SSOT — but with a scope note: there is no canonical "monthly historical" calc engine yet. If a future surface needs the same time series, promote into `lib/calculations/marginTrend.ts` (D-43.3-3). |
| **D-43.3-2** | **No new field on `quickMetrics`.** Trend is a *time series*, not a point-in-time number. Adding `monthlyHistoricals: MarginTrendMonth[]` to `quickMetrics` would invert the abstraction (quickMetrics is for "what's true right now", not "what was true 5 months ago"). | Same promote-on-second-use rule as Phase 43.1 + 43.2. |
| **D-43.3-3** | **No new calc engine in `lib/calculations/`.** The bucketing-by-month + trend-direction logic lives in the route. v1 has only one consumer (this lens); promoting to `lib/calculations/marginTrend.ts` waits for a second consumer. | Premature abstraction is more expensive than copy-paste-then-promote. |
| **D-43.3-4** | **6-month window, not 12.** Long enough to show direction reliably, short enough that the sparkline reads at small sizes (320×72 viewBox). 12 months would crowd the tick labels and require a smaller stroke. | Apple/Linear sparkline restraint. |
| **D-43.3-5** | **Pure-SVG sparkline, no chart library.** The line + faint area fill encode trend visually with ~60 lines of pathbuilding code. Recharts / Chart.js / D3 would be 200KB+ of bundle for the same visual. | Apple-restraint + bundle hygiene. The whole MoneyStoryHero / HiddenWealth / Pareto / MarginTrend stack adds < 5KB gzipped because none of them pulls a chart library. |
| **D-43.3-6** | **Down trend = amber, never red.** Same loss-aversion-safe palette discipline as the rest of the Stark-Naked-Numbers stack (Phase 43 Money Story Bar; Phase 43.1 Hidden Wealth; Phase 43.2 Pareto). | Kahneman & Tversky loss aversion — red on a *trend* is panic-inducing on a number that swings 5pp month-on-month. |
| **D-43.3-7** | **Direction-over-absolute closing copy.** *"A few months of upward trend compounds dramatically over decades."* The user is anchored to the slope, not the intercept. Down-trend copy is stoic: *"a temporary dip is not a verdict. The direction is what to watch."* | Andrew's principle made explicit. The lens is named *Margin Trend* not *Margin* for exactly this reason. |
| **D-43.3-8** | **`enoughHistory` self-hide at < 3 months with income.** Drawing trend lines on 1-2 months is dishonest — every fluctuation looks like a trend. | False-precision guardrail consistent with Phase 43 (`enoughHistory`), Phase 43.1 (`totalAssets ≤ 0`), Phase 43.2 (`vitalFew.length === 0`). |

---

## 4. Data flow

```
prisma.unifiedTransaction.findMany({ userId, date >= 6mo ago,
                                     !isTransfer,
                                     !isInvestmentContribution })
    │
    ▼
GET /api/dashboard/margin-trend       ── thin endpoint, withPermission('report.read')
    │  bucket by UTC year-month → income/expense sums → net + savingsRate
    │  → sliding-window trend (recent3 vs prior3, ±2pp threshold)
    │  → enoughHistory = monthsWithIncome ≥ 3
    │
    ▼
/app/dashboard/budget-analysis/page.tsx     ── one fire-and-forget fetch
    │
    ▼
<MarginTrendLens ... />                ── pure presentational; pure-SVG sparkline
```

No new calc engine. No new fields on `quickMetrics`. No chart library.

---

## 5. Visualisation

```
┌──────────────────────────────────────────────────────────────────┐
│  HOW YOUR MARGIN IS TRENDING        6 months · 5 with income     │
│                                                                  │
│   31%  kept this month                       [↑ trending up]     │
│  +3 points vs last month · +$420 in net cashflow                 │
│                                                                  │
│      ╭──────╮                                                    │
│      │      ╲────╮          ╭───╯                                │
│      │           ╲──────╯  ╱                                     │
│      │                 ╲  ╱                                      │
│      ─                  ─╯                                       │
│   Nov   Dec   Jan   Feb   Mar   Apr                              │
│                                                                  │
│  A few months of upward trend compounds dramatically over        │
│  decades.                                                        │
└──────────────────────────────────────────────────────────────────┘
```

### Trend palettes (NON-NEGOTIABLE)

| Trend | Headline + dot | Pill | Sparkline | Why |
|---|---|---|---|---|
| `up` | emerald-700 | emerald-50 / emerald-700 | emerald-500 stroke + emerald-500/10 fill | Bandura victory tone; reaching upward direction *is* the small win. |
| `down` | amber-700 | amber-50 / amber-700 | amber-500 stroke + amber-500/10 fill | **No red.** Loss-aversion-safe (Kahneman & Tversky). A down month should reframe, not alarm. |
| `flat` | slate-700 | slate-100 / slate-700 | slate-500 stroke + slate-500/10 fill | Neutral. Steady is honest; not bad, not good. |

### Behavioural-psychology rules (registered in `06_UI_UX_FOUNDATION.md`)

| Principle | Citation | How the lens answers |
|---|---|---|
| **Direction-over-absolute framing** | Andrew, Stark Naked Numbers (Principle 2) | The pill is the load-bearing insight; the percentage is context. Closing copy reframes *every* single-month snapshot against the slope. |
| **Loss aversion** | Kahneman & Tversky | No red. Down trend = amber. The lens never tells the user they've failed. |
| **Self-efficacy** | Bandura | Visible progress on the sparkline reinforces the user's belief that they can keep improving. The dot at the line's end anchors the eye to "you are here". |
| **Locus of control** | Rotter, Bandura | Closing copy makes the user the actor (*"the direction is what to watch"*). Never prescriptive (*"you should reduce X by Y%"*). |
| **Narrative-fallacy resistance** | Kahneman | Up-trend copy is *measured*, not celebratory. *"Compounds dramatically over decades"* is true; *"You're crushing it!"* would be false-confidence on small samples. |
| **Concreteness** | Heath & Heath | Dual-axis honesty (savings-rate points + net cashflow dollars) gives the user two concrete handles for the same direction. Same direction can look different in $ vs %. |

---

## 6. Acceptance criteria

- [x] Lens renders on `/dashboard/budget-analysis` between `<PageHeader>` and the existing AI-estimate / scenario sections.
- [x] Lens self-hides when `enoughHistory === false` (`monthsWithIncome < 3`).
- [x] Sparkline is pure SVG, no chart library.
- [x] Sliding-window trend computation: avg savings-rate last 3 vs prior 3 months; ±2pp threshold separates `up` / `flat` / `down`.
- [x] No red anywhere — down trend uses amber, never `red-*`.
- [x] Reduced-motion-safe — path-draw + area-fade + last-point-pop animations all suppress under `prefers-reduced-motion`; the line still renders.
- [x] Lens reads from `/api/dashboard/margin-trend` only — no client-side aggregation.
- [x] Endpoint is `withPermission('report.read')`.
- [x] No new fields on `MasterFinancialSnapshot.quickMetrics` (D-43.3-2).
- [x] No new calc engine in `lib/calculations/` (D-43.3-3 — promote on second consumer).
- [x] Inline JSDoc on `MarginTrendLens.tsx` covering composition rules + behavioural-psychology citations (CLAUDE.md §16.4).
- [x] `npx tsc --noEmit` clean.

---

## 7. What's NOT in this PR

| Follow-on | Why deferred |
|---|---|
| **Phase 43.4 — Tighter `enoughHistory` gate for Money Story Hero** (≥90-day check via `linkageHealthService`) | Final Stark-Naked follow-on. Smaller scope. Could bundle with 43.3 but the user merging cadence has been one-PR-at-a-time, which works. |
| **Promote computation into `lib/calculations/marginTrend.ts`** | D-43.3-3. v1 has one consumer; promote on second. |
| **Quarterly / annual trend window switcher** | Out of scope — 6-month window is honest at this granularity. Year-over-year would need ≥ 24 months of data, rare for our user base. |
| **Tooltip on hover showing exact monthly values** | Restraint. The dot on the last point + the tick labels under the chart are enough at this size. Future iteration if signal demands. |
| **SurfaceDescriptor registration** | `lib/calc-audit/surfaces/dashboardBudgetAnalysisMarginTrend.ts` — gated on Phase 41i.6a. Each rendered savings-rate trace must map to its `prisma.unifiedTransaction` query path. |

---

## 8. References

- Andrew, J. (2018). *Stark Naked Numbers* — Principle 2 (Maximize Your Margins).
- Bandura, A. (1977). *Self-efficacy: Toward a unifying theory of behavioral change.*
- Kahneman, D. & Tversky, A. (1979). *Prospect Theory: An Analysis of Decision under Risk.*
- Kahneman, D. (2011). *Thinking, Fast and Slow* — narrative-fallacy + small-sample warnings.
- Mani, A. et al. (2013). *Poverty Impedes Cognitive Function* — Science 341(6149).
- Heath, C. & Heath, D. (2007). *Made to Stick.*
- `docs/blueprint/PHASE_43_MONEY_STORY.md` — the original architect-mode synthesis; this is follow-on #3 of four.
- `docs/blueprint/PHASE_43_1_HIDDEN_WEALTH.md` + `PHASE_43_2_SPENDING_PARETO.md` — predecessor lenses (same SSOT + thin-endpoint + typography-led-card pattern).
- CLAUDE.md §0 (Advisory Mindset), §6.1 + §12.2 (SSOT), §14 (TRAIL framework + warm-words rule), §16 (Doc-sync protocol).
- `docs/architecture/06_UI_UX_FOUNDATION.md` — registers `MarginTrendLens` as a canonical typography-led analytical card pattern (same family as `HiddenWealthLens` + `SpendingParetoLens`).

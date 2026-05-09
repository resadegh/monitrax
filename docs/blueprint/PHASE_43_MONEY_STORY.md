# Phase 43 — Your Money Story (the Personal P&L scoreboard)

> **Status:** 🟡 **SHIPPING IN THIS PR** (`claude/monitrax-architecture-analysis-MG8mr`).
> **Scope:** A single hero tile on `/dashboard` (Home). Three lines: **Earned → Kept → Free today**. No new endpoints, no new calc engine.
> **Estimated effort:** ~1 day end-to-end (delivered).
> **Last updated:** 2026-05-09 — Reza + Claude.

---

## 1. Strategic positioning

Reza brief 2026-05-09:

> "I want you to read Stark Naked Numbers book and provide a comprehensive analysis on Monitrax architecture and design and methodology and how they can align and being incorporated into the app."

The architect-mode synthesis (this session) translated Jason Andrew's central thesis — *"Revenue is vanity, Profit is sanity, Cash is reality"* — into the personal-finance idiom and proposed a **3-line scoreboard hero** as the One Next Best Action. This phase delivers that hero.

Andrew's brevity rule (3 lines, brutally hierarchical) is the same brevity rule behavioural psychology demands when the user opens Monitrax already short on cognitive bandwidth (Mani et al. 2013 — financial stress costs 13 IQ points). The book validates the architecture Monitrax already has; it doesn't ask the product to change course. The hero is the surface where the two traditions meet and become legible to the user.

---

## 2. The translation (Stark Naked → personal finance)

| Stark Naked Numbers (SME) | Personal-finance translation | TRAIL stage anchor |
|---|---|---|
| Revenue (vanity) | **Earned** — monthly gross income (pre-tax) | T (Track) |
| Gross Profit / Net Profit (sanity) | **Kept** — monthlyNetIncome − essential expenses | R (Reduce) |
| Cash (reality) | **Free today** — liquid cash, expressed in days of life | A (Anchor) |

Three deliberate departures from the book:

1. **Tone.** Andrew is brutal ("your accountant's profit is fake", "fire your worst 20% of customers"). Monitrax is warm by doctrine. We borrow the *hierarchy*, never the *tone*. No row is ever labelled "vanity" — that framing belongs to the book, not to the product.
2. **Days-of-life precision.** Andrew leaves cash as a dollar amount. We add the runway-in-days framing because it's the personal-finance question users actually ask ("how long can I survive?"). Per-day display is gated when transaction history is too thin (`enoughHistory: false`) — a misleading "0 days" is worse than a missing number.
3. **Stage-matched emphasis.** Andrew's scoreboard is static for SME owners. Monitrax's is stage-aware: which line gets the prominent gradient headline rotates with the user's TRAIL stage (Track → Earned, Reduce → Kept, Anchor / Invest / Live → Free today). All three values always render. **Guided, not gated** (CLAUDE.md §14.3).

---

## 3. Architectural decisions

| # | Decision | Rationale |
|---|---|---|
| **D-43-1** | **Zero new calc engines.** All four derived values (`monthlyGrossIncome`, `keptAfterEssentials`, `keptMargin`, `freeCashDays`) live in the existing `MasterFinancialSnapshot.quickMetrics` block — read-through of values already computed by `cashflowOrchestrator`, `expenseAggregator`, and the master-snapshot synthesis point. | CLAUDE.md §6.1, §12.2 SSOT. Reza directive 2026-05-09: *"don't duplicate functions and stick to claude.md design principles. SSOT and single calc engines."* |
| **D-43-2** | **Zero new HTTP fetches on the Home dashboard.** The existing `/api/dashboard/insights` endpoint already calls `getMasterFinancialSnapshot()`; the four new values are exposed through a new `moneyStory` block on its existing response. No third fetch added. | CLAUDE.md §12.10 (dashboards should need 1–2 API calls, not 5+). |
| **D-43-3** | **Compose existing shell primitives.** The hero composes `<GlassHero>` + `<GlassHeroEyebrow>` + `<GlassHeroHeadline>` + `<GlassHeroKpiCell>` from `components/shell/`. No local re-implementation of `appleEase`, the rounded-28px glass surface, or the mesh atmosphere. | CLAUDE.md §16, `06_UI_UX_FOUNDATION.md` §15.10 — reviewers MUST reject local re-implementations of these primitives. |
| **D-43-4** | **Hero is purely presentational.** Component takes 6 props (`earned`, `kept`, `keptMargin`, `freeToday`, `freeDays`, `enoughHistory`, `trailStage?`) and renders. No data-fetching, no business logic, no derived math beyond rounding for display. | Testability + reuse. The same component can be dropped into the adviser drill-in view by passing client props (Phase 32B `voiceContext`). |
| **D-43-5** | **`enoughHistory` gate.** When `monthlyExpenses === 0`, the `freeDays` display is replaced with "Truly liquid right now" (no day count). | False-precision guardrail. Showing "0 days of life" to a user who simply hasn't recorded expenses yet is misinformation, not insight. |
| **D-43-6** | **Defer the supporting three.** The architect-mode synthesis identified three follow-on lenses (Hidden Wealth on `/dashboard/balances`, Pareto subscription audit on `/dashboard/expenses`, Margin Trend on `/dashboard/budget-analysis`). All three are queued in `IMPLEMENTATION_PLAN.md` but explicitly **not** in this PR. Ship the hero, watch a week of usage signal, then sequence. | Andrew's brevity principle applied to the build plan, not just the UI. Don't bundle. |

---

## 4. Data flow

```
masterFinancialService.getMasterFinancialSnapshot()
    │
    ├── quickMetrics.monthlyGrossIncome      = cashflow.monthlyGrossIncome
    ├── quickMetrics.keptAfterEssentials     = monthlyIncome.all.netTotal − monthlyExpenses.essential.total
    ├── quickMetrics.keptMargin              = (keptAfterEssentials / monthlyGrossIncome) × 100
    └── quickMetrics.freeCashDays            = liquidCash / (monthlyExpenses.all.total / 30)
            │
            ▼
/api/dashboard/insights  ── adds `moneyStory` block to its response
            │
            ▼
/app/dashboard/page.tsx  ── reads insights.moneyStory + computes trailStage from existing data
            │
            ▼
<MoneyStoryHero ... />   ── pure presentational, 3 lines, stage-rotated emphasis
```

No new endpoint. No new calculation. No duplicate aggregation.

---

## 5. Stage-emphasis behaviour

| TRAIL stage | Atmosphere | Headline (gradient) | Secondary copy (warm) |
|---|---|---|---|
| **T (Track)** | `amber` | **Earned** | "Most people never see this number written down. You now do." |
| **R (Reduce)** | `sky` | **Kept** | "31% kept this month. The AU household average is around 24%." (or "above the AU household average — quietly excellent." when ≥ 24%) |
| **A (Anchor)** | `emerald` | **Free today** | "47 days of runway — every week added is the safety net widening." (varies by `freeDays`) |
| **I (Invest)** | `violet` | **Free today** | "Your foundation's solid — what's next is making the surplus work." |
| **L (Live)** | `emerald` | **Free today** | "The whole story working as designed. This is what TRAIL stage 5 reads like." |

The 24% AU-household-savings-rate figure is used as a comparative-not-judgemental normalising frame (RBA / ABS national-accounts proxy). When the user is below it, the copy never shames; when above, the copy quietly recognises without manipulation. This is the warm-words rule (CLAUDE.md §14.3) operating on a Stark-Naked metric.

---

## 6. Surface descriptor (Phase 41i.6 — pending)

Once Phase 41i.6 (Surface-Level Numerical Audit) ships its registry at `lib/calc-audit/surfaces/`, the MoneyStoryHero MUST register a `SurfaceDescriptor` with:

```ts
// pseudocode — final shape lives in PHASE_41I_6_SURFACE_AUDIT.md
{
  id: 'dashboard.home.moneyStoryHero',
  surface: '/dashboard',
  fields: [
    { name: 'earned',     readsFrom: 'quickMetrics.monthlyGrossIncome' },
    { name: 'kept',       readsFrom: 'quickMetrics.keptAfterEssentials' },
    { name: 'keptMargin', readsFrom: 'quickMetrics.keptMargin' },
    { name: 'freeToday',  readsFrom: 'quickMetrics.liquidCash' },
    { name: 'freeDays',   readsFrom: 'quickMetrics.freeCashDays' },
  ],
  governance: 'HR-3 surface-rendering drift',
}
```

Until 41i.6a registry ships, the contract is documented here and enforced by code review. **Reviewers MUST reject any change that adds inline math to `MoneyStoryHero` instead of routing through `quickMetrics`.**

---

## 7. Acceptance criteria

- [x] Hero renders on `/dashboard` Home below the empty-state branch (only when data is loaded + non-empty).
- [x] Hero self-hides when `insights.moneyStory` is missing (older cached responses, graceful degradation).
- [x] All three lines (`Earned`, `Kept`, `Free today`) render at all stages — emphasis rotates, content does not disappear.
- [x] When `monthlyExpenses === 0`, the day count is replaced with "Truly liquid right now" instead of "0 days of life".
- [x] Hero composes only `components/shell/*` primitives — no local glass / motion / atmosphere redefinition (CLAUDE.md §16).
- [x] No duplicate calc logic: every derived value is read from `snapshot.quickMetrics` (CLAUDE.md §12.2 SSOT).
- [x] `npm run build` passes.

---

## 8. What's NOT in this PR (explicitly deferred)

| Follow-on | Where | Why deferred |
|---|---|---|
| **Hidden Wealth lens** — split Net Worth into *Liquid Today / Accessible in 90 days / Locked Until Retirement* on `/dashboard/balances`. | New `HiddenWealthBreakdown` component on Balances. | Andrew's "balance sheet is where all the cash is hiding" insight, deferred so we don't bundle. Queued in `IMPLEMENTATION_PLAN.md`. |
| **Spending Pareto** — top 20% of merchants by spend on `/dashboard/expenses`. | Extension to existing `SpendingByCategory` widget. | Customer-profitability principle inverted. Half-built (recurring detection exists in `lib/intelligence/`); needs the visual. |
| **Margin Trend** — savings-rate sparkline as first-class on `/dashboard/budget-analysis`. | New widget on Budget Analysis. | Andrew's GP-margin direction-matters-more-than-absolute rule applied. Currently the savings-rate score is buried inside the health-score breakdown. |
| **≥90-day history gate** for `freeDays` precision. | Tighten `enoughHistory` in `/api/dashboard/insights`. | v1 uses the cheap gate (`monthlyExpenses > 0`). Tighter gate depends on `linkageHealthService` exposing transaction-history depth. |
| **Surface descriptor registration.** | `lib/calc-audit/surfaces/dashboardHomeMoneyStory.ts`. | Gated on Phase 41i.6a (registry foundation) shipping. Contract documented in §6 above; enforced by code review until then. |

---

## 9. References

- [Stark Naked Numbers — Goodreads](https://www.goodreads.com/book/show/43887582-stark-naked-numbers)
- [SBO Financial — book summary](https://sbo.financial/stark-naked-numbers/)
- CLAUDE.md §0 (Advisory Mindset — four lenses), §12.2 (SSOT), §14 (TRAIL framework), §16 (Doc-sync protocol)
- `docs/blueprint/TRAIL_FRAMEWORK.md` §6 (3-line scoreboard pattern)
- `docs/architecture/06_UI_UX_FOUNDATION.md` §15.10 (shared shell layer — primitives the hero composes)
- `docs/blueprint/PHASE_41I_6_SURFACE_AUDIT.md` (pending registry; surface-descriptor contract in §6 above)

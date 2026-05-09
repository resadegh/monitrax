# Phase 43.1 — Hidden Wealth Lens

> **Status:** 🟡 **SHIPPING IN THIS PR** (`claude/phase-43-1-hidden-wealth-MG8mr`).
> **Scope:** A single typography-led analytical card on `/dashboard/balances`. Three buckets (Liquid Today · Accessible · Locked Long-Term) splitting Total Assets by *accessibility*. No new calc engine. No quickMetrics changes.
> **Estimated effort:** ~half day end-to-end (delivered).
> **Last updated:** 2026-05-09 — Reza + Claude.
> **Predecessor:** Phase 43 (Money Story Hero) — PR [#737](https://github.com/resadegh/monitrax/pull/737), merged 2026-05-09.

---

## 1. Strategic positioning

The first deferred follow-on from the Stark Naked Numbers translation. PHASE_43_MONEY_STORY.md §8 promised four follow-ons; **this is #1**, queued first because it's the highest-information-gain extension — it surfaces an insight users almost never see in personal-finance apps.

Andrew's central balance-sheet observation:

> *"The balance sheet is where all the cash is hiding."*  
> — Stark Naked Numbers, Principle 3 (Supercharge Your Cash Flow)

In SME context Andrew means: profit reports lie because cash is trapped in receivables / inventory / fixed assets. The personal-finance translation is sharper still: **the user with $500k net worth and $2k accessible is the rule, not the exception, for the AU property-investor segment Monitrax targets**. They see "$500k" on `/dashboard` Home and feel wealthy. They see "$2k" on payday and feel anxious. The gap between those two numbers is where the Hidden Wealth lens lives.

---

## 2. The three buckets

| Bucket | Source (canonical snapshot) | Time horizon | What it actually answers |
|---|---|---|---|
| **Liquid today** | `quickMetrics.liquidCash` (cash + offsets) | 24 hours | "Can I pay for this hot-water-system replacement before the weekend?" |
| **Accessible** | `investments.totalValue` (shares / ETFs / managed funds) | ~days, subject to CGT + market timing | "Could I free up $30k for a deposit this fortnight if I had to?" |
| **Locked long-term** | `propertyPortfolioEquity + netWorth.assets.superannuation + netWorth.assets.assets` | Years (property sale or preservation age) | "How much of my wealth is actually 'on paper' rather than 'on tap'?" |

These three sum to **Total Assets** (not Net Worth — liabilities are shown separately as page context, never subtracted from any bucket).

### Why this taxonomy and not another

- **Why not group offsets with property?** An offset balance is cash. The user can withdraw it any time (subject to redraw rules); calling it "locked" because it's sitting against a mortgage would be dishonest. It belongs in Liquid.
- **Why are investments "Accessible" not "Liquid"?** A share sale settles T+2, then funds clear. A genuine emergency on Tuesday morning can't be paid from a share sale today. ~Days, not 24 hours.
- **Why is property equity "Locked" if there's a Line of Credit?** A LOC against equity is a loan, not the equity itself. The equity only converts to cash through a property sale or refinance — both multi-week processes. The LOC is debt that already shows on the page.
- **Why are personal assets in Locked?** Cars / equipment / valuables are illiquid AND depreciating. Calling them "Accessible" would be optimistic about both speed and value retention.
- **Why no "Realisable Net" bucket (i.e. equity minus CGT minus selling costs)?** Out of scope for v1. The micro-copy under Accessible names the friction ("CGT and market timing apply"); the user gets a directional answer, not a forensic one.

---

## 3. Architectural decisions

| # | Decision | Rationale |
|---|---|---|
| **D-43.1-1** | **Zero new calc engines.** Every value is read-through from existing snapshot fields (`quickMetrics.liquidCash`, `investments.totalValue`, `propertyPortfolioEquity`, `netWorth.assets.superannuation`, `netWorth.assets.assets`). | CLAUDE.md §6.1 + §12.2 SSOT. |
| **D-43.1-2** | **No new fields on `quickMetrics`.** The bucketing is presentation-layer terminology specific to this lens. Coupling the calc layer to a UI taxonomy would invert the architecture. The lens-specific endpoint (D-43.1-3) does the bucketing. | If a second surface needs the same buckets in the future, *then* promote to `quickMetrics`. Don't pre-promote on speculation. |
| **D-43.1-3** | **New thin endpoint `/api/dashboard/hidden-wealth`.** Returns only the 3 bucket totals + the breakdown the lens renders. ~80 lines of route code, calls `getMasterFinancialSnapshot()`, returns. | Avoids loading the full master snapshot (~80 fields) on a page that only needs 5 of them. Keeps `/dashboard/balances` fetch budget contained — adds 1 small fetch, doesn't blow up payload size. |
| **D-43.1-4** | **Typography-led, not a glass card.** The existing `/dashboard/balances` hero is minimalist typography; introducing `<GlassHero>` would clash visually. Subtle border + faint background only. | Apple/Linear/Stripe restraint. The page already has its visual hero (Net Position) — the lens is a supporting analytical card, not a hero. |
| **D-43.1-5** | **Emerald → sky → slate palette.** Liquid (emerald, Bandura victory tone — *access*) → Accessible (sky, calm/can-act) → Locked (slate, neutral foundation). | The emerald-reservation rule in `PHASE_43_MONEY_STORY.md` §5a is **scoped to the Money Story Bar** (the §5a rule names that component explicitly). The two surfaces never co-render — `/dashboard` Home shows MoneyStoryHero, `/dashboard/balances` shows HiddenWealthLens. Emerald can carry "victory/access" semantics here without conflict. **Reviewers MUST reject any change that introduces red on this bar.** |
| **D-43.1-6** | **Self-hides when `totalAssets ≤ 0`.** A fully-grey bar communicates nothing useful and risks misinformation (e.g. a brand-new account with all zeros). | False precision is worse than missing precision (same rule as Phase 43 `enoughHistory`). |
| **D-43.1-7** | **Stark-Naked honesty in micro-copy.** Each bucket's micro-description names the trade-off without alarm. `>80% Locked` triggers warm framing (*"That is wealth — but not cash."*) without shaming. `0% Accessible` reframes as TRAIL stage progression (*"the next TRAIL stage"*), not absence. | Behavioural-psychology lens — Mani et al. cognitive load + the warm-words rule (CLAUDE.md §14.3). The math is sharp; the language is kind — same doctrine as Phase 43. |

---

## 4. Data flow

```
masterFinancialService.getMasterFinancialSnapshot()
    │
    ├── quickMetrics.liquidCash             → liquidToday
    ├── investments.totalValue              → accessible
    ├── propertyPortfolioEquity             ─┐
    ├── netWorth.assets.superannuation      ─┼─ summed → lockedLongTerm
    └── netWorth.assets.assets              ─┘
            │
            ▼
GET /api/dashboard/hidden-wealth     ── thin wrapper, withPermission('report.read')
    │  returns { liquidToday, accessible, lockedLongTerm, totalAssets, netWorth, breakdown }
    │
    ▼
/app/dashboard/balances/page.tsx     ── one fetch in the existing Promise.allSettled batch
    │
    ▼
<HiddenWealthLens ... />             ── pure presentational, 6 props, computes nothing
```

No new calc engine. No new derived fields on `quickMetrics`. No duplicate aggregation.

---

## 5. Visualisation

```
┌────────────────────────────────────────────────────────────┐
│  WHERE YOUR WEALTH IS              $478,200 net worth ·   │
│                                       $612,400 in assets  │
│                                                            │
│  [██████ 8% ██][██████████ 22% ███][══════ 70% ══════════] │
│   emerald          sky                 slate               │
│                                                            │
│  ● Liquid today          $48,200    8%                     │
│    Reachable today — a typical buffer.                     │
│                                                            │
│  ● Accessible           $137,400   22%                     │
│    Sellable within days. CGT and market timing apply.      │
│                                                            │
│  ● Locked long-term     $426,800   70%                     │
│    Most of your wealth is in long-term form. That is       │
│    wealth — but not cash.                                  │
│                                                            │
│  ─────────────────────────────────────────────────────     │
│  INSIDE LOCKED                                             │
│  Property equity   $284,100  ·  Super  $128,400  ·         │
│  Personal assets    $14,300                                │
└────────────────────────────────────────────────────────────┘
```

### Behavioural-psychology rules (NON-NEGOTIABLE — registered in `06_UI_UX_FOUNDATION.md`)

| Principle | Citation | How the lens answers |
|---|---|---|
| **No red anywhere** | Kahneman & Tversky, loss aversion | Even when a user is 95% Locked, no panic colour. Slate is the strongest tone in the bar. |
| **Emerald reserved for Liquid (access)** | Bandura, self-efficacy + colour-affordance research | Reaching cash *is* the small win. The emerald segment, however small, reads as a win. |
| **Comparative-not-judgemental copy** | Warm-words rule (CLAUDE.md §14.3) | "That is wealth — but not cash" reframes; never "you're cash-poor". "0% Accessible" → "the next TRAIL stage", not "you have no investments". |
| **Anchor against context** | Tversky & Kahneman, anchoring | The subhead carries `$X net worth · $Y in assets` so the buckets read against the user's whole position, not in isolation. |
| **Three-segment brevity** | Andrew, Stark Naked Numbers | One bar, three segments, no axis, no legend. The proportions ARE the legend. |
| **Reduced-motion-safe** | Apple HIG accessibility | The 0.7s left-anchored `scaleX` reveal is suppressed under `prefers-reduced-motion`. |

---

## 6. Acceptance criteria

- [x] Lens renders on `/dashboard/balances` between the existing Net Position hero and the Cash/Credit/Debt sections.
- [x] Lens self-hides when `totalAssets ≤ 0` OR the API fetch failed.
- [x] All three buckets render with proportional widths summing to 100%.
- [x] No red anywhere in the bar or rows, regardless of bucket distribution.
- [x] Lens reads from `/api/dashboard/hidden-wealth` only — no inline math, no client-side aggregation of accounts/properties/assets.
- [x] Endpoint is `withPermission('report.read')` (CLAUDE.md §12.5).
- [x] No new fields on `MasterFinancialSnapshot.quickMetrics` (D-43.1-2 — promote-on-second-use, not on speculation).
- [x] Inline JSDoc on `HiddenWealthLens.tsx` covering composition rules, design contract, behavioural-psychology citations (CLAUDE.md §16.4).
- [x] `npx tsc --noEmit` clean.

---

## 7. What's NOT in this PR

| Follow-on | Where | Why deferred |
|---|---|---|
| **Spending Pareto** on `/dashboard/expenses` | Top-20% merchants by spend with warm framing. Customer-profitability principle inverted. | Queued in `IMPLEMENTATION_PLAN.md`. Sequence after Hidden Wealth signal. |
| **Margin Trend** on `/dashboard/budget-analysis` | Savings-rate sparkline as first-class metric. Andrew's GP-margin direction-matters principle. | Queued. |
| **Tighter `enoughHistory` gate** for the Money Story Hero | ≥90-day transaction history check via `linkageHealthService`. | Queued. Phase 43 follow-on, unrelated to this surface. |
| **Realisable Net per bucket** (CGT + selling costs subtracted) | Inside-Locked drill-down rows could show post-tax estimates. | Out of scope for v1. The micro-copy names the friction; full modelling needs the tax engine wired in, which is a larger refactor. |
| **SurfaceDescriptor registration** | `lib/calc-audit/surfaces/dashboardBalancesHiddenWealth.ts` | Gated on Phase 41i.6a registry foundation shipping (same gate as MoneyStoryHero). Contract: each rendered field traces to its `quickMetrics` / `netWorth` / `investments` / `propertyPortfolioEquity` source path. |

---

## 8. References

- [Stark Naked Numbers — book listing](https://www.goodreads.com/book/show/43887582-stark-naked-numbers)
- `docs/blueprint/PHASE_43_MONEY_STORY.md` — predecessor; this is follow-on #1 of the four queued.
- CLAUDE.md §0 (Advisory Mindset), §6.1 + §12.2 (SSOT), §14 (TRAIL framework), §16 (Doc-sync protocol)
- `docs/architecture/06_UI_UX_FOUNDATION.md` — registers `HiddenWealthLens` as a canonical typography-led analytical card pattern
- `docs/architecture/02_DESIGN_PRINCIPLES.md` §3.2 ("Everything is a Drill-Down" — the lens links into the existing Cash / Investments / Properties detail surfaces via the page's existing rows)

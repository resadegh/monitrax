# Phase 57 — Dashboard KPI tiles: trailing basis (no more start-of-month $0)

**Status:** 🟢 In progress (KPI tiles shipping) · Freedom Horizon reframe deferred to a follow-up.
**Started:** 2026-07-02.
**Origin:** Reza dashboard review (2026-07-02): *"even with data I still don't understand why annual
income, annual outgoings, saving rate tile are not showing any numbers … showing 0 is not helping."*

---

## 1. The problem (root-caused in source)

The dashboard money tiles headlined the **in-progress current calendar month, annualised** (current
month × 12). Two days into a month the current month has little or no data:

- **Annual income → $0** — no salary deposit dated in the current month yet.
- **Saving rate → 0.0%** — `net ÷ income` with income $0 hits the divide-by-zero guard.
- **Annual outgoings → tiny** — a couple of days of spend × 12.
- **Delta pills** — `-100% YoY` (current-month income 0 vs a prior month), `vs avg`, `vs last mo`
  all measured against the partial month.

The honest figures were only in the subtext. Verified path: `app/dashboard/page.tsx` `cf.*` ←
`insights.kpiTiles.canonical` ← `getCanonicalMonthlyCashflow(snapshot)` ← `actualCashflow`
`currentMonth*` (the in-progress month). §19.1's "actuals win" rule is correct; the flaw was that
"current-month actuals" is a partial, unrepresentative window early each month.

## 2. The fix — trailing basis (Reza-approved: A + X, 2026-07-02)

**A. Basis** — headline the **average of COMPLETE, populated calendar months × 12** (trailing
twelve months). The in-progress current month is excluded (so it can't drag the number); a
**data-driven divisor** means months with no imported transactions don't count as real zeros.

**X. Empty state** — fall back to the declared **plan** when there are no complete actual months
(brand-new user), and render an **em-dash + a next-action nudge** instead of a bare `$0`. A
`Last 12 months` / `Your plan` basis label makes the source explicit (never lies).

### SSOT (§12.2.1 — one source, reused)
All of it is computed once in the canonical `moneyStoryTrend` engine (which already reads 12 months
of `UnifiedTransaction`), exposed as `annualIncome / annualOutgoings / annualNet / avgMonthlyNet /
savingsRateTrailing / trailingMonthsWithData`, and read verbatim by the tiles. No parallel source;
no new query; the existing actuals definitions (transfers excluded, uncategorised included) are
reused unchanged.

### §19.2 worked example (verified in `tests/neomatrix/moneyStoryTrendAudit.test.ts`)
Clock = Jun 15. Complete Mar/Apr/May earned 38k/40k/42k & spent 30k/28k/32k; June (current) $0
income + $200 spent → **June excluded**: `annualIncome 480,000`, `annualOutgoings 360,000`,
`annualNet 120,000`, `avgMonthlyNet 10,000`, `savingsRateTrailing 25.0%`, `incomeΔ +10.5%`
(never −100%), `cashflowΔ −2,000`, `outgoingsΔvsAvg +2,000`, `trailingMonthsWithData 3`.

## 3. Neomatrix (§21.2)
`moneyStoryTrend` engine node updated in the same PR (anchor 68→88, produces/formula/workedExample);
`GENERATED_CORE.md` regenerated; `neomatrix:check` green.

## 4. Deferred — Freedom Horizon hero (needs Reza's product-philosophy decision)
The hero's `MARGIN 100%` is the same partial-current-month bug (declared income − current-month
actual spend). The `N months of freedom` headline is `freeCashDays = liquidCash ÷ (declared monthly
expenses ÷ 30)`, then ÷ 365.25 — a **liquid-cash runway** mislabelled as "freedom": it ignores
income and the ~$5.5M in assets, and overlaps the Emergency-fund runway tile. Options presented to
Reza: (F1) a true work-optional runway using investable assets; (F2) relabel as a cash runway (then
likely remove, since Emergency owns runway); (F3) a genuine FIRE-progress metric (passive income ÷
expenses), most aligned with TRAIL "Live". Ships as a focused follow-up once chosen.

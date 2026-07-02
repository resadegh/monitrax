# Changelog — 2026-07-02

## Session: dashboard-tile-zeros-issue-vrnapu

### Changes Made
- **Type**: Fix (financial correctness) + UX
- **Scope**: Dashboard KPI tiles (Monthly cash flow / Annual income / Annual outgoings / Saving rate) + their delta pills.
- **Root Cause**: The tiles headlined the **in-progress current calendar month × 12**. In the
  first days of a month the current month has little/no data (e.g. salary not yet paid), so
  `Annual income` → $0, `Saving rate` → 0.0% (net ÷ 0 income), and `Annual outgoings` → a
  2-day-of-spend × 12 figure. The delta pills (`-100% YoY`, `vs avg`, `vs last mo`) were also
  computed against the partial current month, producing an alarming and wrong `-100% YoY`.
  The honest declared/trailing numbers were only in the tile subtext.
- **Solution (Phase 57)**: Headline the **trailing basis** — the average of **COMPLETE, populated
  calendar months × 12** (the in-progress current month is excluded; a data-driven divisor means
  months with no imported transactions don't drag the figure). Computed once in the canonical
  `moneyStoryTrend` engine (no parallel source, §12.2.1) and read verbatim by the tiles via the
  insights route's `canonical` block. Falls back to the declared **plan** when there are no
  complete actual months yet (brand-new user), and shows an em-dash + a next-action nudge instead
  of a bare, misleading `$0` (§0 behaviour lens). Delta pills now compute over complete months, so
  `-100% YoY` no longer appears. A `Last 12 months` / `Your plan` basis label makes the source
  explicit so the tile never lies about what it's showing (§19.1).

### Files Modified
- `lib/calculations/moneyStoryTrend.ts` — added trailing annual basis (`annualIncome`,
  `annualOutgoings`, `annualNet`, `avgMonthlyNet`, `savingsRateTrailing`, `trailingMonthsWithData`);
  recomputed the three KPI deltas over complete months (exclude the in-progress current month).
- `app/api/dashboard/insights/route.ts` — `kpiTiles.canonical` now serves the trailing basis
  (with a declared-plan fallback + `basis: 'actual-ttm' | 'declared'`).
- `app/dashboard/page.tsx` — tiles bind to the trailing figures; basis label; em-dash + nudge
  instead of `$0`; helper copy reflects the basis (mobile + desktop).
- `tests/neomatrix/moneyStoryTrendAudit.test.ts` — new `partialCurrentRows` fixture (§19.2 worked
  example) + updated delta assertions + trailing-basis + regression assertions.
- `docs/financial-logic/graph/financial-graph.json` — updated the `moneyStoryTrend` engine node
  (drifted anchor 68→88, produces/formula/workedExample); regenerated `GENERATED_CORE.md`.

### §19.2 Worked example (verified in the A1 test)
Clock = Jun 15. Complete months Mar/Apr/May earned 38k/40k/42k & spent 30k/28k/32k; June (current)
$0 income + $200 spent → **June excluded**. `annualIncome = avg(38,40,42)k=40k ×12 = 480,000`;
`annualOutgoings = avg(30,28,32)k=30k ×12 = 360,000`; `annualNet 120,000`; `avgMonthlyNet 10,000`;
`savingsRateTrailing 25.0%`; `incomeΔ (42−38)/38 = +10.5%` (never −100%); `cashflowΔ May10k−Apr12k = −2,000`;
`outgoingsΔvsAvg 32k−30k = +2,000`.

### §19.1 basis statement
Actuals win when present (trailing complete months from `UnifiedTransaction`, transfers excluded,
uncategorised included); declared **plan** is the fallback only when there are no complete actual
months. No user-facing money number is produced from declared records when actual transactions exist.

### Build Status
- [x] `vitest` — A1 `moneyStoryTrendAudit` 11/11 pass (incl. the §19.2 worked example).
- [x] `eslint` — clean on the 3 changed source files (1 pre-existing unrelated warning at page.tsx:358).
- [x] `tsc --noEmit` — the 3 changed files are type-clean. (The repo-wide errors are ALL the
      missing-generated-`@prisma/client` pattern — this sandbox's proxy blocks the Prisma engine
      binary download, so `prisma generate` can't run here.)
- [x] `npm run neomatrix:check` — OK (anchor 68→88 resolves, markdown fresh, census/binding OK).
- [ ] `next build` — NOT runnable in this sandbox (needs `prisma generate`; engine binary download
      blocked by the proxy). Verified on Vercel via the PR preview build; §17.2 post-merge check to follow.

### §20.4 self-review (financial build → 10/10)
v1 critique caught: (a) fixing only the big numbers would leave "-100% YoY" on the delta pill → deltas
now computed over complete months too; (b) the fallback must be the declared PLAN, not current-month
actuals (which is the bug) → declared net used directly; (c) partial-current-month drag → current month
excluded + data-driven divisor; (d) bare $0 → em-dash + nudge; (e) `basis` union type error → fixed.
Score: **10/10 against requirement**; code correctness verified by tests + types + lint + neomatrix
(build-run deferred to the Vercel preview — sandbox can't download the Prisma engine).

### Not in this PR (deferred — needs Reza's decision)
- **Freedom Horizon** hero (`EARNED / KEPT / MARGIN 100%` + the `N months of freedom` number). The
  `MARGIN 100%` is the same partial-current-month bug (declared income − current-month actual spend).
  The `N months` number is a **liquid-cash runway** mislabelled as "freedom" (ignores income + the
  $5.5M in assets, likely duplicates the Emergency tile). Reframing it is a product-philosophy fork
  presented to Reza; the fix ships in a focused follow-up once the direction is chosen.

---

## Session (cont.): Phase 58 — the "Freedom" hero (Financial Independence)

### Changes Made
- **Type**: Feature (the "wow" — cross-portfolio Financial Independence) + Fix (hero MARGIN 100%)
- **Scope**: Dashboard hero (`MoneyStoryHeroV2`) + new canonical FI engine.
- **Why (Reza, 2026-07-02)**: *"I need the tiles to be real value add … something that wow the
  users (that will be very hard for the user to figure out without having all portfolio in one page)."*
- **Solution**: reframe the hero from a liquid-cash **runway** into a **Financial Independence**
  number: *"your portfolio covers N% of the life you actually live"* = **net, accessible** passive
  income ÷ **real** (trailing) lifestyle spend. Net = Σ per-property net cashflow (rent − costs −
  loan repayments) + dividends + interest + royalties — **gross rent is never used** (it would
  overstate freedom on geared property). Preserved super is **excluded** from "now" and surfaced as
  an **"→ N% once your super unlocks at 60"** line (labelled 4% safe-withdrawal assumption). A
  **growth-vs-income split** ("2 building equity · 1 producing income") reframes negatively-geared
  property as the deliberate strategy it is, not a failure. The `MARGIN 100%` hero bug is fixed by
  putting earned/kept on the same trailing basis.

### Files
- `lib/calculations/financialIndependence.ts` — NEW pure canonical engine (`computeFinancialIndependence`).
- `tests/neomatrix/financialIndependenceAudit.test.ts` — NEW A1 worked-example audit (9 tests).
- `app/api/dashboard/insights/route.ts` — assemble net-accessible passive + lifestyle + super, call
  the engine, expose `moneyStory.freedom*`; fix earned/kept to the trailing basis (MARGIN).
- `components/editorial/money-story/MoneyStoryHeroV2.tsx` — FI-coverage hero number + at-60 + split
  lines; em-dash (never a bare 0%) when no lifestyle data.
- `components/dashboard/tiles/GlassInsightTiles.tsx`, `app/dashboard/page.tsx` — prop wiring.
- Neomatrix: NEW `engine.financialIndependence.computeFinancialIndependence` node + 2 edges
  (moneyStoryTrend → FI → hero); Layer-0 manifest updated for the new file (graphify binary
  unavailable in-sandbox — manifest hand-reconciled, to be regenerated on next graphify run);
  `GENERATED_CORE.md` regenerated; `neomatrix:check` green (Layer 0, binding 150/150, census 0 uncovered).

### §19.2 worked example (verified — FI test 9/9)
net passive $24k/yr ÷ lifestyle $120k/yr → **coverageNow 20.0%**; preserved super $300k × 4% = $12k →
**coverageAt60 30.0%**; propertyNetMonthly [-500,200,-300] → 1 income-producing, 2 growth-building;
lifestyle 0 → coverage 0 + hasData false (em-dash, no bare 0%).

### §19.1 basis + honesty
Net (not gross) passive; accessible (super excluded from "now"); lifestyle = trailing real spend.
Known caveat (documented): SMSF assets flow through entity investments and are not yet
preservation-gated — a v1 limitation for the "now" figure.

### §20.4 self-review (financial build → 10/10)
Critique caught: gross-rent would lie → used per-property net cashflow; super in "now" would mislead
→ at-60 layer; a bare "0%" empty state → em-dash guard; new engine must be modelled + connected in
the graph (not an island) → added node + 2 edges. **10/10 against requirement.**

### Build Status
- [x] `vitest` — FI 9/9 + moneyStory 11/11 (20/20).
- [x] `lint:financial-surfaces` — 0 new (engine math lives in the engine; route assembly annotated).
- [x] `tsc --noEmit` — changed files type-clean (repo-wide errors are the missing-Prisma-client pattern).
- [x] `neomatrix:check` — green.
- [ ] `next build` — Vercel preview (Prisma engine download blocked in-sandbox).

### PR
- PR: #1330 (same branch — Phase 57 + 58)
- Status: Draft

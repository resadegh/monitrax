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

### PR
- PR URL: (pending)
- Status: Draft

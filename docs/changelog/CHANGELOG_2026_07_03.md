# Changelog — 2026-07-03

## Session: dashboard-tile-zeros-issue-vrnapu (follow-up to merged #1330)

### Changes Made
- **Type**: Fix (UX — broken/empty detail modal)
- **Scope**: Dashboard **Annual income** + **Annual outgoings** tile detail dialogs.
- **Root Cause (verified in source)**: `DetailTileType` includes `'income' | 'outgoings'` and both
  tiles call `setSelectedDetail(...)`, which opens the shared `<Dialog>` (`open={selectedDetail !== null}`).
  But the dialog had content branches only for `netWorth` / `cashflow` / `savingsRate` / `lvr` — **no
  branch for `income` or `outgoings`** — so clicking those tiles opened an empty modal (just the close
  button). A pre-existing gap the Phase 57/58 tile work made visible (the tiles now invite clicks).
- **Solution**: added the two missing dialog branches, mirroring the Savings Rate breakdown — a hero
  figure (annual, trailing basis) + average-per-month + the declared-plan comparison + a basis-aware
  explainer. Renders existing canonical `cf.*` values (no new number, no arithmetic in the surface).

### Files Modified
- `app/dashboard/page.tsx` — added `selectedDetail === 'income'` and `=== 'outgoings'` dialog bodies.

### Testing
- [x] `lint:financial-surfaces` — 0 new (no inline arithmetic; renders precomputed `cf.*`).
- [x] `eslint` — 0 errors (pre-existing useEffect-dep warning only).
- [x] `tsc --noEmit` — `page.tsx` type-clean (repo-wide errors are the missing-Prisma-client pattern).
- [x] `neomatrix:check` — green (pure UI; no engine/number/anchor change).
- [ ] `next build` — Vercel preview (Prisma engine download blocked in-sandbox).

### Why no §19.2 / Neomatrix change
Pure presentational fix — the modal renders already-canonical, already-modelled figures (`cf.annualInflow`,
`cf.annualOutflow`, `cf.monthlyInflow`, `cf.monthlyOutflow`, `insights.kpiTiles.*`). No financial engine,
number, formula, or lineage added or changed.

### §20.5 self-review — 10/10 against requirement
Requirement: the income/outgoings tiles must open a real breakdown, not a broken empty modal. 3× review:
v1 add branches → v2 removed an `incomeMonthly * 12` inline arithmetic (surface-linter violation) in
favour of the precomputed monthly value → v3 confirmed em-dash when no data + basis-aware copy so the
modal never shows a misleading figure. Numbers unchanged (canonical `cf.*`); §19.1 basis intact.

### PR
- PR: (pending) — fresh PR off `main` (#1330 already merged).
- Status: Draft

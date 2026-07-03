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

---

## Session: p2-property-cashflow-canonical — MON-002 canonical per-property cashflow

### Changes Made
- **Type**: Fix (financial, number-changing) + Refactor (SSOT dedup)
- **Scope**: property cashflow — engine, actuals producer, both property surfaces, both property APIs, Neomatrix, issue registry
- **Root Cause**: per-property cashflow was computed **inline** in BOTH property pages from **declared** records (ignoring reconciled actuals), and the loan cost read a possibly-zero `minRepayment` → **loan silently $0** (Thornlands Lot 2 read `Cashflow/yr == rent`). Two inline producers → surfaces disagreed (§12.2.1 violation; §19.1 violation).
- **Solution (decision: actuals-first P&I, confirmed by Reza 2026-07-03)**:
  - New pure engine `lib/calculations/propertyCashflow.ts` → `computePropertyCashflow` — the ONE source. Per entity: actual `monthlyAverageActual × 12` when `hasTransactions`, else declared `× frequency`. Loan repayment = actual → manual `minRepayment` → **interest floor `principal × interestRateAnnual`** (never $0). Returns `annualCashflow` (cash, full P&I) **and** `annualTaxCashflow` (interest-only) — folds MON-006.
  - New shared actuals producer `lib/services/propertyActuals.ts` → `enrichPropertiesWithActuals` (extracted verbatim from the detail route; **batched** — 3 queries total, no N+1) now used by BOTH `/api/properties` (list) and `/api/properties/[id]` (detail) so the list tile matches the detail hero (§19.4). `calculateMonthlyAverage` derives the true monthly average from the reconciled cadence → fixes MON-001 (fortnightly rent).
  - Both property surfaces refactored to the engine; inline declared-only producers deleted.

### Files Modified
- `lib/calculations/propertyCashflow.ts` — NEW canonical engine (comment ref → services helper).
- `lib/services/propertyActuals.ts` — NEW shared, batched actuals producer.
- `app/api/properties/route.ts` — list GET now enriches (batched) before GRDCS wrap.
- `app/api/properties/[id]/route.ts` — detail GET now calls the shared producer (deleted ~150 lines of inline actuals math — SSOT).
- `app/dashboard/properties/page.tsx` — `calculateCashflow`/`calculateRentalYield`/loan helpers delegate to the engine.
- `app/dashboard/properties/[id]/page.tsx` — `cashflowOf` delegates to the engine (prior commit in branch).
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — modelled (engine.propertyCashflow + engine.propertyActuals.calculateMonthlyAverage + number.propertyCashflow + 2 converged ui-surfaces + input.Loan.interestRateAnnual; 250 nodes / 338 edges).
- `docs/financial-logic/graph/structural/structural-graph.json` — regenerated (new files mapped).
- `tests/calculations/propertyCashflow.test.ts` — NEW (§19.2 worked examples + §19.4 one-source proof).
- `docs/issues/ISSUES.json` + `ISSUES.md` — MON-002 → FIXING (folds MON-001, MON-006).
- `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md` — P-2 marked fixed.

### §19.2 worked-example evidence
- **Lot 1** (rent $1195/mo, expenses $43,546/yr, loan $947,076 @ 6.49%, manual P&I $5,975.38/mo): rent 14,340 − expenses 43,546 − repayment 71,704.56 = **−$100,910.56** cash; interest 61,465.23 → tax cashflow **−$90,671.23** (less negative than cash — principal isn't deductible). ✅ matches code.
- **Lot 2** (rent $650/wk, loan $482,000 @ 6.49%, `minRepayment = 0`): interest 31,281.80 floors the repayment → cashflow **+$2,518.2** (was wrongly +$33,800 with loan ignored). ✅ loan never $0.
- **Actuals-first**: fortnightly $1195 → `monthlyAverageActual` ≈ 2,588.3 → annual ≈ **$31,070**, not the declared-MONTHLY $14,340. ✅

### §19.4 downstream sweep (same number everywhere)
Consumers of per-property cashflow enumerated via Neomatrix lineage: property **list tile** + property **detail hero/Tax card**. Both now read `number.propertyCashflow` ← `engine.propertyCashflow.computePropertyCashflow` (A3 convergence — same `semanticKey`, one engine). Cross-surface one-source proven by `tests/calculations/propertyCashflow.test.ts` (asserts both files read the engine, no inline producer). The list API now carries actuals so the tile is not just one-formula but one-number with the detail page.

### Build Status
- [x] `tests/calculations/propertyCashflow.test.ts` — 7 passed
- [x] `tests/neomatrix` + `tests/issues` — 152 passed
- [x] `neomatrix:check` — green (250 nodes/338 edges, A3 holds, census 0 uncovered, 153/153 anchors resolve)
- [x] `issues:check` — 8 valid
- [x] `eslint` — 0 errors (pre-existing useEffect-dep warning only)
- [x] `tsc --noEmit` — 0 errors after `prisma generate`
- [ ] `next build` — Vercel preview (Prisma engine download blocked in-sandbox)

### §20.4 self-review — 10/10 (financial build)
Requirement: one canonical per-property cashflow, actuals-first, loan never $0, SAME number on list + detail, modelled + tested. 3× review: v1 engine only (list still declared) → v2 extracted the shared batched actuals producer so the list tile matches the detail number (true §19.4, not just one-formula) → v3 fixed the `basis` to count only contributing entities + modelled `calculateMonthlyAverage` so census stays 0-uncovered. Every number traced to a worked example (§19.2). 10/10.

### PR
- PR: (pending) — draft off this branch.
- Status: Draft — MON-002 holds at FIXING until Reza verifies the numbers on his data.

---

## Session: eloquent-archimedes — MON-009 universal monthly resolver (rent/expenses/loans from dates)

### Changes Made
- **Type**: Fix (financial, number-changing) + Refactor (SSOT)
- **Scope**: universal monthly resolution for rent / expenses / loan repayments, read from transaction dates; property pages + master snapshot (dashboard/net-worth/health); reconciliation source fix
- **Root Cause**: per-property money lines were shown at their **declared frequency** (rent as "monthly" though paid fortnightly), and a rental **fragmented across 4 Income records** (reconciliation's "create income from transaction" hard-codes MONTHLY per payment — `link/route.ts:345`) was **summed 4×**. `masterFinancialService.buildPropertyMetrics` (`:1114`) + aggregate income summed declared records → dashboard/savings/health inflated.
- **Solution (Reza directive 2026-07-03 — universal, shown monthly)**:
  - New `lib/calculations/monthlyResolver.ts` → `resolveMonthly` — ONE rule for any money line: **day-span average from transaction DATES** (×30.4375/mo) when ≥2 tx (correct for fortnightly, twice-a-month, quarterly); actual amount × declared frequency when 1 tx; declared monthly when 0 tx.
  - `computePropertyCashflow` rewired to the resolver; **RENT pooled at the property-stream level** (fragmentation counted once); expenses/loans per record; loan never $0; returns monthly + annual + detected cadence.
  - `propertyActuals.enrichPropertiesWithActuals` now also attaches each property's `linkedTransactions`; both property APIs feed them to the engine.
  - `masterFinancialService`: `buildPropertyMetrics` routed through the engine (added `loanId` to linked-tx fetch); aggregate income deduped via `adjustPropertyRentalIncome` (synthetic monthly rent per property) so income totals / savings rate / health match the property page. Tax left raw (§12.14 → MON-010).
  - Display: property "Financial infrastructure" collapses the fragmented rental rows into ONE "Rental income" row with the detected cadence + monthly figure.
  - Source fix: `create-income-from-transaction` reuses an existing property rental stream instead of minting a duplicate MONTHLY row.

### Files Modified
- `lib/calculations/monthlyResolver.ts` (NEW) · `lib/calculations/propertyCashflow.ts` (rewired) · `lib/services/propertyActuals.ts` (linkedTransactions) · `lib/services/masterFinancialService.ts` (engine + dedup) · `app/api/transactions/[id]/link/route.ts` (source fix) · `app/dashboard/properties/[id]/page.tsx` + `page.tsx` (transactions + collapse) · Neomatrix graph + `GENERATED_CORE.md` + structural · `tests/calculations/monthlyResolver.test.ts` + `propertyCashflow.test.ts` · `ISSUES.json`/`ISSUES.md` (MON-009 + MON-010) · this changelog.

### §19.2 worked-example evidence
- Fortnightly $1,195/14d → 1195/14 × 30.4375 ≈ **$2,598/mo** (~$31,176/yr), NOT declared-MONTHLY $14,340.
- **4 fragmented rental records + pooled fortnightly tx** → rent counted ONCE (~$2,598/mo), not 4 × $1,195.
- Quarterly $300/91d → 300/91 × 30.4375 ≈ **$100/mo**. Two repayments/month (~15d) → ~2× single. 1 quarterly tx → $300 × 4/12 = $100/mo (not $300).
- Lot 1 −$100,910.56 cash / −$90,671.23 tax; Lot 2 loan floors to interest → +$2,518.2 (declared-only paths unchanged).

### §19.4 downstream sweep (same number everywhere)
Consumers of per-property rent/cashflow via Neomatrix lineage + grep: property **list tile**, property **detail hero + Tax + Linked-Entities**, and **masterFinancialService** (per-property metrics + portfolio rollups + aggregate income → quickMetrics.monthlyIncome/savingsRate/health/cashflow). All read the ONE engine (`number.propertyCashflow` ← `engine.propertyCashflow` ← `engine.monthlyResolver`, A3 convergence). Structural one-source test now asserts all three surfaces (both pages + master) read the engine. **Deliberately out of scope:** tax (`buildTaxSummary`, §12.14) → MON-010; the date-based `computeActualCashflow` headline tiles were already correct (real transactions).

### Build Status
- [x] `tests/calculations` + `tests/neomatrix` + `tests/issues` — 281 passed
- [x] Full `vitest run` — 3624 passed / 69 skipped / **0 failed** (no master-snapshot regression)
- [x] `neomatrix:check` green (251 nodes/340 edges, A3 holds, census 0 uncovered, 154/154 anchors)
- [x] `issues:check` — 10 valid · `lint:financial-surfaces` — 0 new · `eslint` 0 errors · `tsc --noEmit` 0 errors
- [ ] `next build` — Vercel preview

### §20.4 self-review — 10/10 (financial build)
Requirement: universal, cadence-agnostic, shown-monthly resolution for rent/expenses/loans, fragmentation-proof, same number on property pages AND dashboard. 3× review: v1 rent-only stream fix → v2 generalised to a shared resolver covering the quarterly/twice-a-month cases + 1-tx-declared-cadence edge → v3 flowed it through masterFinancialService (per-property + aggregate income dedup, budget-variance preserved) and added the source fix + collapsed display; scoped tax out honestly (MON-010) rather than risk a §12.14 change unverified. Every number traced to a §19.2 worked example. 10/10.

### PR
- PR: (pending) — draft. MON-009 holds at FIXING until Reza verifies on his data.

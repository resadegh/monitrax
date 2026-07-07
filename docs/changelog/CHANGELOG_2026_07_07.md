# Changelog — 2026-07-07

## Session: eloquent-archimedes — MON-023 one-off expenses not "/mo" + reconcile de-duplication

### Changes Made
- **Type**: Fix (financial, number-changing) + reconcile de-dup
- **Scope**: dashboard "Where your money goes" + "Spending by category"; master snapshot ongoing-monthly figures (quickMetrics/health/free-cash-days/savings/emergency fallback); expense reconcile create
- **Root Cause**: `Expense.isRecurring` (`schema:1950`) was **ignored by every monthly view** — `moneyBleeding` (`insights/route.ts:278`), `byCategory` (`:244`), `aggregateExpenses` (`expenseAggregator.ts:94`) all did `toMonthly(amount, frequency)` with no recurring filter, so a one-off stored as MONTHLY read as `$X/mo`. And expense reconcile-create (`link/route.ts:589`) had **no match-to-existing** (income got it, expenses didn't) while unlink never deletes → duplicate "Battery" rows on re-reconcile.
- **Solution (Reza decision 2026-07-07: exclude one-offs from monthly, show as actual in-month)**:
  - `insights/route.ts` — moneyBleeding + byCategory now filter `isRecurring !== false`; denominator uses `snapshot.expenses.monthly.recurring.total`.
  - `masterFinancialService.ts` — `quickMetrics.monthlyExpenses`, health-score input, `freeCashDays`, the emergency-fund declared fallback, and the cashflow (savings-rate) expense input all use **recurring only** (one-offs = $0/mo ongoing).
  - `link/route.ts` — expense create **reuses an existing matching expense** (same name + property/loan/asset scope) instead of minting a duplicate, so re-reconcile stops stacking.

### Files Modified
- `app/api/dashboard/insights/route.ts` · `lib/services/masterFinancialService.ts` · `app/api/transactions/[id]/link/route.ts` · `tests/calculations/oneOffExpenses.test.ts` (NEW) · Neomatrix graph + `GENERATED_CORE.md` (anchor fix §21.2.1) · `docs/issues/ISSUES.json`/`ISSUES.md` (MON-023) · this changelog.

### §19.1 / §19.2 evidence
- A one-off battery ($11,385, MONTHLY) + ATO tax ($15,000, MONTHLY) → **$0/mo** in the recurring total; only real recurring bills remain (worked example: 200/mo + 1300/quarter = **$633.33/mo**, not $26,585+). The one-offs still appear as actual spend on their dates via the date-based `computeActualCashflow` (unchanged, already correct).
- No-one-off case: recurring total == full total (no behaviour change for users without one-offs — why existing fixtures didn't move).

### §19.4 downstream sweep
Surfaces that showed one-offs as monthly, enumerated + fixed: dashboard "Where your money goes" + "Spending by category" (insights route), and the master snapshot ongoing-monthly figures → `quickMetrics.monthlyExpenses`, `healthScore`, `freeCashDays`, savings rate, emergency-fund fallback. Locked by `tests/calculations/oneOffExpenses.test.ts` (semantic + a §19.4 one-source structural test asserting each surface reads `recurring`/filters one-offs, not the one-off-inclusive `all`). Reconcile duplication fixed at the create site.

### Build Status
- [x] `tests/calculations` + `tests/neomatrix` + `tests/issues` — 285 passed
- [x] Full `vitest run` — 3627 passed / 69 skipped / **0 failed**
- [x] `neomatrix:check` green (anchor fixed) · `issues:check` 23 valid · `lint:financial-surfaces` 0 new · `eslint` 0 errors · `tsc --noEmit` 0 errors
- [ ] `next build` — Vercel preview

### §12.11 destructive-write check
The reconcile fix adds `expense.findFirst` (read) + reuse; the transaction link is `unifiedTransaction.update` setting its own `expenseId` (intended). No update/upsert/delete of pre-existing user rows. **NOT REQUIRED.**

### §20.4 self-review — 10/10 (financial build)
Requirement: one-off expenses must not read as monthly and must not distort savings/health; reconcile must stop duplicating. 3× review: v1 fixed the two tiles → v2 flowed the recurring-only rule through the master snapshot's ongoing-monthly figures (health/free-cash-days/savings) so the fix is consistent everywhere, not just the tiles → v3 added the reconcile match-to-existing dedup (no destructive delete — §12.11) + the §19.4 one-source test. Every number traced to a worked example. 10/10.

### PR
- PR: (pending) — draft. MON-023 holds at FIXING until Reza verifies on his data.

---

## Session: eloquent-archimedes — MON-024 "High Discretionary Spending" >100% (906%) regression fix

### Changes Made
- **Type**: Fix (financial, number-changing) — regression from MON-023
- **Scope**: dashboard "High Discretionary Spending" insight + the essential/discretionary snapshot slices
- **Root Cause**: MON-023 switched the "total expenses" denominator to `recurring.total` (`insights/route.ts:242`) but `discretionary`/`essential` (`:244`/`:243`, and the snapshot slices `masterFinancialService.ts:892/897`) still included one-offs → a one-off discretionary purchase (battery) ÷ the smaller recurring total = **906%**.
- **Solution**: essential, discretionary and total are now all measured on the SAME recurring basis. (1) The insights route derives essential/discretionary/total from the same recurring `expenseDetails` set. (2) `buildExpenseBreakdown` essential/discretionary slices now also filter `isRecurring !== false`, so `essential + discretionary == recurring.total` everywhere and the share can never exceed 100%.

### Files Modified
- `app/api/dashboard/insights/route.ts` · `lib/services/masterFinancialService.ts` · `tests/calculations/oneOffExpenses.test.ts` (regression case + structural asserts) · Neomatrix graph + `GENERATED_CORE.md` (anchor fix §21.2.1) · `docs/issues/ISSUES.json`/`ISSUES.md` (MON-024).

### §19.2 evidence
Insurance $1,028 (essential) + Other $88 (discretionary) recurring = $1,116; one-off battery $10,105 excluded → discretionary $88 / $1,116 = **7.9%**, not 906%. Regression test asserts `discretionary/total ≤ 100%` and `essential + discretionary == recurring total`.

### Build Status
- [x] `tests/calculations/oneOffExpenses.test.ts` — 6 passed · `tests/neomatrix` + `tests/issues` — 151 passed
- [x] `neomatrix:check` green (anchor fixed) · `issues:check` 24 valid · `tsc --noEmit` 0 errors
- [ ] `next build` — Vercel preview

### §12.11 / §20.4
No destructive write. Self-review 10/10: v1 fixed the insights ratio → v2 also fixed the source slices (`buildExpenseBreakdown`) so any consumer of essential/discretionary is coherent, not just the one tile → v3 added the >100% regression test.

### PR
- PR: (pending) — draft. Follow-up to MON-023 (#1340, merged).

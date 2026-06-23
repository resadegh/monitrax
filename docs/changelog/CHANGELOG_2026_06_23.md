# Changelog — 2026-06-23

## Session: cashflow-ssot-convergence-shk180

### Changes Made
- **Type:** Fix (financial correctness) + Enhancement (SSOT enforcement)
- **Scope:** cashflow calculation engine + the surfaces that emit monthly in/out/net
- **Root cause:** SSOT was *documented* (CLAUDE.md §6.1/§12.2/§12.3) but never *enforced*. Multiple routes each chose their own cashflow basis — some DECLARED records (Income/Expense/Loan × frequency), some ACTUAL transactions, and one tile mixed both — so two cashflow tiles on the same page showed different (and, for declared surfaces, falsely optimistic) numbers. The `/cashflow` page showed a +$10,505 surplus / 51.9% saving-rate hero while its own money-flow waterfall showed the real actuals; the true current month was a deficit (In ≈ $25,827 / Out ≈ $46,741 / Net ≈ −$20,914).
- **Solution (Phase 2 — establish ONE correct number + source of truth, converge the others to it):**
  1. **Canonical accessor** `lib/calculations/canonicalCashflow.ts` — `getCanonicalMonthlyCashflow(snapshot)` + pure `resolveCanonicalCashflow(actual, declared)`. The ONE place the actuals-vs-declared rule lives: actuals win when `hasActualData`, declared fallback otherwise (CLAUDE.md §19.1). Returns `{ inflow, outflow, net, savingsRate, avgMonthlyOutflow, basis }`.
  2. **`/cashflow` HERO converged** — `buildForecastSummary` + the cashflow health-score input in `/api/cashflow/intelligence/route.ts` now resolve through the canonical accessor instead of declared records. The hero now agrees with the (already-actual) waterfall on the same page.
  3. **Emergency-fund tile internal mismatch fixed** — `/api/dashboard/insights/route.ts` displayed declared `totalMonthlyExpenses` as the "/month" figure while `monthsCovered` used the actual trailing-avg outflow — a contradiction on one tile. Now displays `snapshot.emergencyFund.monthlyExpenses` (the exact denominator the engine used for `monthsCovered`).
  4. **Trailing-average divisor fix** — `lib/calculations/actualCashflow.ts` changed the trailing-3-full-month average from a fixed `/3` to a **data-driven divisor**: a month with NO transactions is missing data (excluded from sum AND divisor); a populated low-spend month still counts. Fixes the false ~$938 emergency figure for users who only recently connected their bank.
  5. **Enforcement gate** — `tests/calculations/cashflowSurfacesUseCanonical.test.ts` structural guard fails the build if a converged surface drops the canonical accessor (so SSOT can't silently drift again).

### Scoped out / deferred (with reason)
- **Home page tiles** (`/dashboard` Monthly Cash Flow / Annual Outgoings / Saving Rate, fed by `portfolio/snapshot.cashflow` + `insights.kpiTiles.outgoingsAnnual`) were investigated and intentionally NOT converged in this PR. Overwriting only the headline to actual breaks the Home drill-down tie-out — the drill-down recomposes net from a DECLARED Income−Expenses−Loans breakdown, while actuals only give Inflow−Outflow (loans folded into outflow). Converging correctly needs a section-level drill-down change (Stitch-first, CLAUDE.md §18.2.1). A backend-only overwrite would re-introduce exactly the contradiction this workstream is removing. Tracked as Phase 2b in `01_ACTIVE_WORKSTREAMS.md`.
- Rolling-30-day analytics window vs current-calendar-month reconciliation; `/activity` donut "20% kept" YTD source trace — tracked as Phase 2c.

### Files Modified
- `lib/calculations/canonicalCashflow.ts` — **new.** Canonical accessor + pure resolver (the single actuals-vs-declared rule).
- `lib/calculations/actualCashflow.ts` — trailing-average divisor changed from fixed `/3` to data-driven (populated-months only); doc comments updated.
- `app/api/cashflow/intelligence/route.ts` — `buildForecastSummary` re-signed to take canonical (income, outflow, net); hero + health-score input resolve via `getCanonicalMonthlyCashflow`.
- `app/api/dashboard/insights/route.ts` — emergency tile displays `snapshot.emergencyFund.monthlyExpenses` (engine denominator), not declared `totalMonthlyExpenses`.
- `tests/calculations/canonicalCashflow.test.ts` — **new** (4 tests).
- `tests/calculations/cashflowSurfacesUseCanonical.test.ts` — **new** (3 tests, enforcement gate).
- `tests/calculations/actualCashflow.test.ts` — updated 3 tests for the data-driven divisor.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — `0·CASHFLOW-ACTUALS` Phase 2 progress.
- `docs/IMPLEMENTATION_PLAN.md` — hub `Last updated` bumped.
- `docs/audit/AUDIT_CASHFLOW_SSOT.md` — convergence status appended.

### §19.2 evidence (worked examples)
- **Canonical accessor (actual):** In 25,827 / Out 46,741 → Net −20,914; savingsRate = −20,914 / 25,827 × 100 ≈ −80.98% (NOT +51.9%). basis = 'actual'. ✅ verified by test.
- **Canonical accessor (declared fallback, no txns):** Income 8,000 − (Expenses 5,000 + Loans 1,000) → Net 2,000; savingsRate 25%. basis = 'declared'. ✅ verified.
- **Divisor:** only May populated (600), Mar+Apr no transactions → divisor 1 → avg 600 (old fixed /3 wrongly gave 200). Mar 10 + May 600 both populated → divisor 2 → avg 305. ✅ verified.

### Testing
- [x] Build passes (`npm run build` — full route table emitted, no type errors)
- [x] Lint passes (`npm run lint:financial-surfaces` — 0 new violations)
- [x] `tests/calculations` — 119 tests pass (incl. 18 new/updated cashflow tests)

### PR
- PR URL: (to be filled)
- Status: Open (draft)

---

## Session: financial-logic-index-shk180

### Changes Made
- **Type:** Documentation (new master reference — no logic change)
- **Scope:** new `docs/financial-logic/` hub + spokes — the Financial Logic Index
- **Why:** Reza directive — *"build the document for every phase [after] complete research on the document for that section, the code, understand the logic, then document. Never guess or assume … only to keep a live index and reference … so you can understand Monitrax without guess or assumption."* The 2026-06-23 doc-coverage audit found ~27% of ~112 financial-engine files have proper inline headers and NO canonical engine→file→formula→authority index. Calc drift (the #1201 cashflow contradiction) happens when a surface changes without tracing to the canonical source; this index is the anchor.
- **Constraints honoured:** documentation only (no logic/law/formula/threshold changed); research-first (each entry written only after a complete source read + phase-doc + input-unit + caller trace); never guess (`⚠️ UNVERIFIED`/`⚠️ SUSPECTED ISSUE` markers reserved for the unverifiable).

### Files Added
- `docs/financial-logic/00_INDEX.md` — hub: purpose, operating rules, status legend, spoke map, coverage tracker.
- `docs/financial-logic/01_CORE_CALCULATIONS.md` — first spoke, 4 engines fully documented from complete reads: net worth (`netWorthCalculator.ts`), declared cashflow (`cashflowOrchestrator.ts`), actual cashflow (`actualCashflow.ts`), canonical cashflow (`canonicalCashflow.ts`) — each with Produces · Canonical accessor · Inputs (unit/type/convention) · Formula+authority · Gotchas · Consumers · Verified-by · worked example.

### Files Modified
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — new `0·FIN-LOGIC-INDEX` workstream.

### Note on branch base
Stacked on the #1201 cashflow-SSOT branch so the index documents the **converged** state (data-driven divisor + `canonicalCashflow.ts` exist). PR base set to the #1201 branch for a clean diff; retarget to main once #1201 merges.

### Testing
- [x] No code changed — docs only. (No build/lint impact.)

### PR
- PR URL: (to be filled — pending GitHub MCP re-auth)
- Status: template slice for format sign-off

#### Addendum — relationships & lineage (third dimension)
Reza directive: the index must also capture how all numbers/engines relate, so the artefact explains how Monitrax works end-to-end and how any number is generated.
- `docs/financial-logic/00b_RELATIONSHIPS_AND_LINEAGE.md` — **new.** Layered data-flow diagram (DB → pure engines → masterFinancialService → API routes → UI, mermaid), verified engine dependency graph (file:line for each `masterFinancialService` composition call), per-number lineage table (raw field → engine → accessor → route → tile), and the two-snapshot-SSOT distinction. Verified-only edges (confirmed in source this session).
- `00_INDEX.md` — per-engine schema now requires **Fed by / Feeds into** edges; relationships spoke registered.
- `01_CORE_CALCULATIONS.md` — added **Fed by / Feeds into** to all 4 entries.

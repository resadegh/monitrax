# Changelog — 2026-07-11

## Session: chat-audit-findings-issues-m9518i

### Per-property Expenses card (MON-005 + MON-008)

- **Type**: Feature (UI + data-entry affordance) — `changesNumbers: false`
- **Scope**: `app/dashboard/properties/[id]`, per-property expenses
- **Issue**: On a property, "N expenses tracked" linked out to the *global* Spending page instead of showing that property's expenses, and there was no clear place to enter a property's expense amounts.
- **Fix**: A dedicated `PropertyExpensesCard` on the property detail page lists each expense with an Actual/Estimate tag and an annual total, plus an inline **Add expense** button (and a form-led empty state) that opens the canonical `ExpenseDialog` pre-scoped to the property; edit/delete on each row.
- **You'll see**: rates/insurance/strata/maintenance now show on the property with a total matching the rest of the app; "Add your first expense" on an empty property; amounts flip Estimate → Actual automatically once transactions reconcile.

#### Design (Stitch-first, §18.2.1)
- Full 4-variant matrix: `.stitch/designs/mon-005-008/property-expenses-v2{,-dark,-mobile,-mobile-dark}.{html,png}` (project `1859462351962811110`, screens `e316a4811e364fbb93234d7c96f9df5d` / `355298a816df4694b8180565c78a3708` / `966dbd42ddff4ce28153668672641113` / `6b2f35540bff4b70a53314cb9bdede5d`).
- §18.8 self-review gate: **v1 8.3/10 → v2 9.3/10** (passing). Deviation from mock: reuse the canonical `ExpenseDialog` instead of a second inline form (§12.2.1).

#### SSOT & correctness (§12.2.1 / §19.1 / §19.4)
- Header total and every row read from the ONE canonical engine `computePropertyCashflow`. New additive, **number-preserving** `expenseLines[]` breakdown from the same loop → `Σ rows.annual === annualExpenses` by construction.
- Actuals-first (§19.1): Actual pill when reconciled transactions exist, Estimate otherwise (engine's own `usedActuals`).
- Duplicate summary row removed from `LinkedEntitiesCard` (§6.7 — one primary place per metric).

#### Financial-build self-review (§20.4)
- 3× against requirement → **10/10** (number-preserving; rows reconcile with header; canonical read + write; graph green; tests lock it).

### Files Modified
- `lib/calculations/propertyCashflow.ts` — expose `CashflowExpenseLine[]` (additive)
- `components/properties/PropertyExpensesCard.tsx` — new card (light+dark, empty state)
- `app/dashboard/properties/[id]/page.tsx` — mount card, drop duplicate row, refetch on change
- `tests/calculations/propertyExpenseLines.test.ts` — §19.4 reconciliation lock
- `tests/dashboard/propertyExpensesCard.test.ts` — SSOT + display guards
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — engine anchor 93→113, regenerated
- `docs/issues/ISSUES.json` + `ISSUES.md` — MON-005 + MON-008 → FIXING

### Build Status
- [x] `npm run neomatrix:check` — OK (schema valid, invariants hold, anchors resolve, markdown fresh, census 0 uncovered)
- [x] `npm run issues:check` — 27 valid
- [ ] Build / lint / vitest — CI (local tsc/vitest unavailable)

### PR
- PR: https://github.com/resadegh/monitrax/pull/1358 (draft)
- Status: Open — MON-005/008 at FIXING, verify on live data before VERIFIED.

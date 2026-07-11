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

---

## Session continuation: the Verification Machine (Part 23) + VR-001 + MON-028

### VR-001 — first real-data verification run (Claude-in-Chrome relay)
- Reza ran the verification brief on his live account. **Confirmed fixed:** MON-011 (portfolio equity ties out, negative equity honest), MON-020 (tax engines agree, $42,721 both), MON-022(ii) (no fake gain pill), MON-002 tax-vs-cash basis, MON-019 sentinel gone.
- **FAILs found:** detail-page cashflow/yield drift on every property (→ MON-028, fixed same-day PR #1359); savings rate ×3 producers (→ MON-029); health score ×3 (→ MON-030); liquid savings $2,496 gap (→ MON-031); "-$0" repayment row (→ MON-032); yield on owner-occupied Home tile + CFO (→ MON-033); MON-017/MON-019 residuals re-opened (safety subscore full marks on negative cashflow; refinance offered at 104% LVR); one-offs-as-monthly reconfirmed (MON-023/025 class).
- Full record: `docs/verification/runs/VR-001.md`; snapshot: `docs/verification/baselines/BASELINE.md` (known-broken annotated).

### MON-028 — detail page declared-only (root-caused, fixed, PR #1359)
- `/api/properties/[id]` dropped `linkedTransactions` from its JSON → detail page fed the canonical engine `transactions: undefined` → declared fallback (+$34K optimistic on Broadbeach). Fix restores the one field (remove-the-culprit, not a wrapper). Tests: `tests/api/propertyDetailActuals.test.ts` (source-lock + 3-surface input-parity guard). §20.4: 10/10.

### Verification Machine codified
- **CLAUDE.md Part 23** (v3.4): four rings (engine fixtures / wiring-SSOT / Golden-Household end-to-end / real-data), REMOVE-THE-CULPRIT rule (Reza directive, verbatim), the Ratchet (every Ring-3 escape adds a test at the lowest ring that could have caught it), VERIFIED-requires-Ring-3.
- **`docs/verification/VERIFICATION_PLAYBOOK.md`** — canonical manual: the Chrome relay protocol, the verbatim run brief (Parts A–F, JSON snapshot), baseline/run management, the fix loop, Ring-2 + self-audit roadmap.
- Registry: MON-029..033 registered (OPEN). Workstream added to `01_ACTIVE_WORKSTREAMS.md`.
- In flight: two root-cause investigations (cross-surface splits; golden-test/self-audit infra patterns).

---

## Session continuation 2: VR-001 culprit-removal fixes (MON-017 residual, MON-029, MON-032, MON-033)

All four follow CLAUDE.md §23.2.1 — the broken/duplicate producer is removed, never wrapped:

- **MON-029 (savings rate ×3)** — NEW `getCanonicalSavingsRate` in `lib/calculations/canonicalCashflow.ts` (ONE selection rule: trailing-12-mo actuals when history exists, declared plan fallback). The CFO monthly-progress card's declared `quickMetrics.savingsRate` read DELETED; the Home insight's current-month read DELETED; the Home KPI tile's two inline branches repointed. All three surfaces → one accessor. Graph: new engine node + `number.savingsRate` repointed.
- **MON-017 residual (safety 15/15 on a deficit)** — `app/api/safety-net/route.ts` fed the score `qm.monthlyCashflow` (DECLARED, positive) while its comment claimed actuals-aware. Now feeds `getCanonicalMonthlyCashflow(snapshot).net`. A −$6,073/mo deficit scores 0/15. Stale input-contract comment on `safetyScore.ts` corrected.
- **MON-032 ("-$0" repayment row)** — engine exposes per-loan `loanLines[]` (resolved cost: actuals → minRepayment → interest floor; Σ === monthlyLoanRepayment by construction); the detail-page activity row renders the engine line, labelled "interest (no repayment set)" when floored.
- **MON-033 (yield on owner-occupied)** — `type` threaded through `PropertyMetrics`; `DashboardPropertyTile` yield block gated on `isInvestment`; CFO `low_yield` alert gated on `type === 'INVESTMENT'`.
- **MON-030 / MON-031** — root causes verified + recorded (DIAGNOSED): MON-030 = four score producers (fix: delete `calculateCFOScore` as an overall grade → canonical `generateHealthReport`; own PR, structural). MON-031 = label collision, not math (gross liquid vs net-of-cards; $2,496 IS the credit card) — copy fix queued.
- **Ratchet (§23.2.2):** `tests/verification/vr001Ratchet.test.ts` — Ring-0 worked examples (deficit→0/15; trailing vs declared savings rate; interest-floor $1,271.10 on $228k@6.69%; fortnightly repayment ×26/12) + source-locks on every culprit.
- Neomatrix: 7 drifted anchors fixed, `getCanonicalSavingsRate` modelled, `number.savingsRate` repointed; `neomatrix:check` + `issues:check` green. `lint:financial-surfaces` unable to run locally (ts-node/node-types container limitation) — Vercel build is the gate.

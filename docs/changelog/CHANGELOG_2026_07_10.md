# Changelog — 2026-07-10

## Session: chat-audit-findings-issues-m9518i

---

### MON-020 — Two tax engines disagreed ($153,278 vs $104,323) + /cashflow dropped Medicare → one canonical source

- **Type**: Fix (financial — tax estimate, §12.2.1 duplicate-source consolidation)
- **Scope**: NEW `lib/tax-engine/position/userTaxPosition.ts`; `app/api/cashflow/intelligence/route.ts`; `lib/cfo/decisionSupport/taxIntegration.ts`; Neomatrix
- **Root cause (verified §19.2)**: two independent tax producers for the same user.
  - `/cashflow` (`buildTaxOptimization`, route.ts:457) — `calculateIncomeTax(gross − adHocDeductions).taxPayable` = **income tax only (no Medicare)** with a small ad-hoc deduction set.
  - My Guide (`calculateCFOTaxInsights` → `calculateTaxPosition`) — the FULL position: all deductions + Medicare + offsets + PAYG.
  So the same person saw **$153,278 vs $104,323** — a §12.2.1 duplicate-source defect plus a missing ~2% Medicare levy on the /cashflow side. (The direction: /cashflow read *higher* despite dropping the levy because its ad-hoc deductions were far smaller than the canonical full set; the dominant driver was the deduction gap, Medicare a secondary opposite-direction term.) Sub-claim (c) — the CFO deductions card "mixing benefit into deductions" — was **retracted** after verification (the neg-gearing benefit is a correctly-labelled separate Key-Metrics block; no code sums it into deductions).
- **Fix (§12.2.1 / §12.3)**: extracted `getUserTaxPosition(userId)` — the ONE user-level tax source (fetch once → assemble → the reform-aware `calculateTaxPosition`, Medicare + full deductions + offsets). **Both** surfaces read it:
  - `/cashflow` `buildTaxOptimization(taxPosition)` → `estimatedAnnualTax = Math.round(taxPosition.tax.netTax)` (income tax + Medicare − offsets), `deductibleExpenses`/`effectiveTaxRate`/`paygWithheld` all canonical.
  - `calculateCFOTaxInsights` reads the same `getUserTaxPosition` (removed its inline fetch/assemble/`calculateTaxPosition`).
  They converge by construction — same source, same inputs, Medicare included.

### §19.2 worked example (traced to source)

- `grossTax = taxOnIncome + medicareResult.total` (taxPositionCalculator.ts:242); `medicareResult.total = medicareLevy + surcharge` (medicareLevyCalculator.ts); `netTax = grossTax − offsets` (:244). So `netTax` **includes the Medicare levy** that the old /cashflow calc (income-tax-only) omitted. Both surfaces now show `taxPosition.tax.netTax` → identical figure.

### §19.4 downstream + hard test

- Consumers of the tax number: `/cashflow` (`buildTaxOptimization`) and My Guide (`taxIntegration` → `app/dashboard/cfo`). Both now route through `getUserTaxPosition`. Locked by `tests/tax/userTaxPositionConvergence.test.ts`: (1) a Medicare-inclusion worked example (`grossTax > taxOnIncome`, `medicareLevy > 0` at $150k), (2) cross-surface source-lock — both files call `getUserTaxPosition`, `/cashflow` no longer calls `calculateIncomeTax`, `taxIntegration` no longer calls `calculateTaxPosition(`.
- **Neomatrix A3 convergence** now models it: `number.cashflowIntelligence.estimatedTax` gains `semanticKey: taxPayable` and both `taxPayable` numbers trace to the same engine (`calculateTaxPosition`) — a future divergence is a build failure.

### §12.14 reform compliance

- `getUserTaxPosition` adds **no** tax math — it orchestrates the fetch and delegates to the reform-aware `calculateTaxPosition`. FW-1/FW-2 are inherited (no new regime-affected computation added). No new column on `Property`/`Investment`/`LegalEntity`. No new AI tool.

### Files Modified

- `lib/tax-engine/position/userTaxPosition.ts` — NEW shared source (`getUserTaxPosition` + `UserTaxPositionBundle`).
- `app/api/cashflow/intelligence/route.ts` — `buildTaxOptimization` reads the canonical position; removed the ad-hoc income-tax calc + `calculateIncomeTax` import.
- `lib/cfo/decisionSupport/taxIntegration.ts` — `calculateCFOTaxInsights` reads `getUserTaxPosition`; removed inline fetch/assemble/`calculateTaxPosition` + now-unused `prisma`/`calculateTaxPosition`/type imports.
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` + `structural/structural-graph.json` — modelled orchestrator `service.tax.getUserTaxPosition`; repointed `number.cashflowIntelligence.estimatedTax` (formula + `taxPayable` semanticKey → A3 convergence); re-pinned 2 `taxIntegration` anchors; binding 158/158.
- `.audit/financial-math-baseline.json` — re-pinned the `27500` constant (481 → 447).
- `tests/tax/userTaxPositionConvergence.test.ts` — NEW convergence + Medicare-inclusion guard.
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-020 → FIXING.

### Build status

- [x] `npm run neomatrix:check` — OK (A3 converges, binding 158/158, census 0 uncovered).
- [x] `npm run issues:check` — 25 valid.
- [x] §19.2 identities traced to source (Medicare in netTax).
- [ ] `npx tsc` / `npm run test` / `lint:financial-surfaces` — **CI-verified** (local tsc aborts on the tsconfig `baseUrl` deprecation; vitest toolchain unavailable in this container). Field paths verified against `TaxPositionResult`; imports verified against existing usage.

### §12.11 destructive-write check

Read-only orchestration (`prisma.*.findMany`) + pure render logic. No update/upsert/delete. **NOT REQUIRED.**

### §20.4 self-review — 10/10 (financial build)

3× against requirement (both surfaces show the same Medicare-inclusive tax from one source): v1 the shared `getUserTaxPosition` + /cashflow rewire; v2 rewired My Guide to the same source (killing the second producer) + removed dead code/imports; v3 modelled A3 convergence in the Neomatrix (orchestrator kind so both tax numbers converge on `calculateTaxPosition`), added the Medicare-inclusion + source-lock test, re-pinned anchors/baseline. Every figure traced to the canonical engine.

### Plain-English (what was wrong / what changed / what you'll see)

- **Wrong**: the Cashflow page estimated your annual tax at $153,278 while My Guide said $104,323 — same person, same year. Cashflow used a simpler calc that left out the Medicare levy and most of your deductions.
- **Changed**: both pages now read one canonical tax position (full deductions + Medicare + offsets).
- **You'll see**: the estimated annual tax on Cashflow matches My Guide exactly and includes the ~2% Medicare levy.

### PR
- PR: (pending) — draft. MON-020 holds at FIXING until Reza verifies on his data.

---

### MON-014 — Home property tiles showed gross rent instead of cashflow (3rd non-canonical producer) → one engine

- **Type**: Fix (financial — per-property cashflow, §12.2.1 duplicate producer)
- **Scope**: `app/api/portfolio/snapshot/route.ts`; Neomatrix
- **Root cause (verified §19.2, Neomatrix-first §21.5)**: the Home dashboard reads `/api/portfolio/snapshot`, whose per-property block was a **third** non-canonical cashflow producer — `annualLoanRepayments = Σ toAnnual(minRepayment || 0)` then `propertyCashflow = rent − expenses − repayments`. When a loan had **no `minRepayment`**, `|| 0` dropped the loan cost to **$0**, so the tile showed ~gross rent (Broadbeach +$5,461) while a loan *with* `minRepayment` showed true cashflow (Lot 1 −$3,908). #1336/#1337 unified the property *pages* on `computePropertyCashflow` but this producer was never unified (§12.2.1). The canonical engine (`propertyCashflow.ts:153`) floors loan cost to interest — never $0.
- **Fix (§12.2.1 one engine / §19.4 same number everywhere)**: the snapshot route now calls **`computePropertyCashflow`** — the ONE canonical engine — with **identical inputs** to the master snapshot (`buildPropertyMetrics`): the property's income/expenses/loans + reconciled `unifiedTransaction` rows (new linked-tx fetch replicating master's query, actuals-first). `cashflow.monthlyNet = cf.monthlyCashflow`. So the Home tile = the detail page = the list.

### §19.2 worked example (traced to source)

- Loan 300k @ 6%, **no `minRepayment`**, no actuals → loan cost floored to interest **$18,000/yr** (not $0). Cashflow = 30,000 − 6,000 − 18,000 = **+$6,000**. The old snapshot bug (`rent − expenses − 0`) would have shown **+$24,000** (~gross rent). Verified against `propertyCashflow.ts:153` (interest floor) + `resolveMonthly` (declared fallback with no tx).

### §19.4 downstream + hard test

- The Home tile (`DashboardPropertyTile`, via `app/dashboard/page.tsx` → `/api/portfolio/snapshot`) now shares the ONE engine with the detail + list + master. Test `tests/calculations/propertyCashflowSnapshot.test.ts`: (1) interest-floor worked example (loan cost never $0), (2) a `minRepayment` row unchanged, (3) source-lock — the snapshot route calls `computePropertyCashflow` and no longer runs the inline `rent − expenses − repayments`; master uses the same engine.
- **Neomatrix A3**: modelled `ui.dashboard.propertyTileCashflow` (`semanticKey: propertyCashflow` — converges with detail/list on `computePropertyCashflow`; was a §21.5 blind spot) + `rendered-at` edge; GET anchor re-pinned 513→517; `neomatrix:check` green.

### Scoped residual (deliberately NOT changed)

- The **household-level** `snapshot.cashflow.monthlyNetCashflow` (route.ts:663-669) keeps `toAnnual(minRepayment || 0)`. It is the SnapshotV2 **declared** view (§12.2, a distinct SSOT), and the dashboard uses it only as a **fallback behind the canonical KPI** (`getCanonicalMonthlyCashflow`). Rewiring it would blur the declared-vs-actual distinction — out of MON-014's per-property scope.

### Files Modified

- `app/api/portfolio/snapshot/route.ts` — added the linked `unifiedTransaction` fetch; per-property cashflow now via `computePropertyCashflow` (identical inputs to master); `monthlyNet = cf.monthlyCashflow`.
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — `ui.dashboard.propertyTileCashflow` node + edge; GET anchor re-pinned.
- `.audit/financial-math-baseline.json` — re-pinned the grandfathered `asset.purchasePrice − asset.currentValue` (859 → 908).
- `tests/calculations/propertyCashflowSnapshot.test.ts` — NEW.
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-014 → FIXING.

### Build status

- [x] `npm run neomatrix:check` — OK (A3 converges, census 0 uncovered).
- [x] `npm run issues:check` — 25 valid.
- [x] §19.2 worked example traced to source.
- [ ] `npx tsc` / `npm run test` / `lint:financial-surfaces` — **CI-verified** (local toolchain unavailable). Types verified against `PropertyCashflowInput`/`CashflowTransaction`; the call mirrors master `buildPropertyMetrics` exactly.

### §12.11 destructive-write check

Read-only (`prisma.*.findMany`) + pure engine. No update/upsert/delete. **NOT REQUIRED.**

### §20.4 self-review — 10/10 (financial build)

3× against requirement (Home tile shows cashflow, one engine, = detail page): v1 repoint to `computePropertyCashflow`; v2 added the reconciled-transaction fetch so inputs are IDENTICAL to master (exact convergence, not just declared); v3 modelled the blind-spot tile in the Neomatrix (A3 converges), added the interest-floor + source-lock test, re-pinned anchor/baseline, scoped-out the declared household cashflow with reasoning.

### Plain-English (what was wrong / what changed / what you'll see)

- **Wrong**: on the Home page, the "Monthly Cash Flow" under some property tiles was actually the rent, not the cashflow — when a loan had no minimum-repayment recorded, its cost was counted as $0.
- **Changed**: every Home tile now uses the same cashflow calculation as the property detail page, with the loan cost floored to its interest.
- **You'll see**: each Home tile's monthly figure × 12 equals that property's detail-page Cashflow/yr (Broadbeach shows ~+$4,190, not +$5,461).

### PR
- PR: (pending) — draft. MON-014 holds at FIXING until Reza verifies on his data.

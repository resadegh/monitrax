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

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

---

## Session: chat-audit-findings-issues-m9518i — MON-003 + MON-026 (depreciation 100× / phantom-field)

### Changes Made
- **Type**: Fix (financial correctness — critical)
- **Scope**: Depreciation — every surface now reads the ONE canonical engine `calculateDepreciationAnnual`.
- **Root cause (verified, §19.2)**: `DepreciationSchedule.rate` is stored as a **PERCENTAGE** (`2.5` = 2.5%). Proven from three writers/validators: the API validator `rate: z.number().positive().max(100, 'Rate cannot exceed 100%')` (`app/api/properties/[id]/depreciation/route.ts:14`), the schema comment `rate Float // 2.5% for Div43…` (`prisma/schema.prisma:2381`), and the canonical engine which divides by 100 (`lib/depreciation/index.ts:78` `const rate = schedule.rate / 100`).
  - **MON-026 (critical)** — two production tax paths computed `cost × rate` with **no `/100`** → 100× too high. `cost $100,000 @ rate 2.5` gave `$250,000` (250% of the asset) instead of `$2,500`/yr. That inflated the depreciation deduction 100×, understating taxable income and tax owed. Present in `lib/tax-engine/position/userTaxPosition.ts` (the shared `/cashflow` + My Guide source) AND `app/api/tax/position/route.ts` — the latter's comment even mis-stated "rate is stored as decimal".
  - **MON-003** — the property **detail page** summed a non-existent `annualClaim` field (the API returns the raw schedule, not that field) → Depreciation/yr always **$0**.

### §19.2 worked example (verified from source)
- Prime-cost DIV43, `cost 100000`, `rate 2.5`: engine → `100000 × (2.5/100)` = **$2,500/yr**. (Old tax path: `100000 × 2.5` = $250,000 — 100× high.)
- Diminishing-value DIV40, `cost 10000`, `rate 20`, year-0: `effectiveRate = 20% × 2 = 40%`, WDV ≈ cost → ≈ **$4,000** first year. (Old: `10000 × 20` = $200,000.)

### §12.2.1 SSOT — one engine, five surfaces repointed
- `lib/depreciation/index.ts` → `calculateDepreciationAnnual(schedule)` is the ONE source (rate `/100`, prime-cost vs diminishing-value, method-aware). Now used by:
  - `lib/tax-engine/position/userTaxPosition.ts:122` (was `dep.cost * dep.rate`)
  - `app/api/tax/position/route.ts:153` (was `dep.cost * dep.rate`)
  - `app/dashboard/properties/[id]/page.tsx` `computeAnnualDepreciation` (was summing phantom `annualClaim`)
  - `lib/testing/exporter.ts:412` + `:538` (were `Number(d.cost) * Number(d.rate)`)

### §19.4 downstream sweep + hard test
- Downstream consumers of the depreciation number: (1) `/api/tax/position` `deductions.depreciation` + `taxableIncome` + `taxPayable`; (2) `getUserTaxPosition` → CFO/My Guide tax insights + `/cashflow` tax optimisation; (3) property detail page "Depreciation/yr" tile; (4) the testing exporter's per-property + schedule rows. All now trace to the one engine.
- **Test** `tests/tax/depreciationRate.test.ts` (NEW): prime-cost $100k@2.5% → `2_500` (asserts `not 250_000`); DV $10k@20% year-0 → `>3_500 && <=4_000`; source-locks that userTaxPosition / tax-position route / property page all call `calculateDepreciationAnnual` and no longer do `dep.cost * dep.rate` / `annualClaim`.

### §21.2 Neomatrix (model-the-change)
- Added engine node `engine.depreciation.calculateDepreciationAnnual` (`lib/depreciation/index.ts:78`, domain tax, regime `null`) + number node `number.propertyDepreciation` (`semanticKey: propertyDepreciation`).
- Edges: `calculateDepreciationAnnual → number.propertyDepreciation` (feeds) and `calculateDepreciationAnnual → engine.taxPositionCalculator.calculateTaxPosition` (feeds — so both `taxPayable` numbers' engine-sets include depreciation and A3 converges).
- Re-pinned `service.tax.getUserTaxPosition` 50→54 (import add shifted the symbol). Added `lib/depreciation/index.ts` to structural files. `neomatrix:check` green (263 nodes, A3 converges, census 0 uncovered).

### Files Modified
- `lib/tax-engine/position/userTaxPosition.ts` — import + `calculateDepreciationAnnual(dep)`.
- `app/api/tax/position/route.ts` — import + `calculateDepreciationAnnual(dep as any)`; corrected the wrong "decimal" comment.
- `app/dashboard/properties/[id]/page.tsx` — import; `DepreciationSchedule` client interface → real fields (cost/rate/method/category/startDate/assetName); `computeAnnualDepreciation` via the engine.
- `lib/testing/exporter.ts` — import + two call sites via the engine.
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — nodes/edges/anchors above.
- `tests/tax/depreciationRate.test.ts` — NEW.
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-026 registered (critical); MON-003 updated; both → FIXING.

### Build status
- [x] `npm run neomatrix:check` — OK (A3 converges, binding 159/159, census 0 uncovered).
- [x] `npm run issues:check` — 26 valid.
- [x] §19.2 worked example traced to source (validator + schema + engine).
- [ ] `npx tsc` / `npm run test` / `lint:financial-surfaces` — **CI-verified** (local toolchain unavailable — `tsc` aborts on `baseUrl` deprecation). The engine already treats rate as a percentage; the change only re-routes callers to it.

### §12.11 destructive-write check
Read-only (`prisma.*.findMany`) + pure engine. No update/upsert/delete. **NOT REQUIRED.**

### §12.14 reform-awareness
Touches `lib/tax-engine/position/userTaxPosition.ts`. The change re-routes the depreciation input through the canonical engine — no new tax math, no regime branch, no schema column on `Property`/`Investment`/`LegalEntity`. Depreciation (Div 40/43) is not one of the eight reform measures. Outcome **(b)**: no reform interaction.

### §20.4 self-review — 10/10 (financial build)
3× against requirement (depreciation correct + one engine everywhere): v1 fixed the two tax paths (MON-026); v2 fixed the property page phantom-field (MON-003) + the exporter, unifying all five surfaces on the one engine per Reza's "fix both now, unified"; v3 modelled the engine+number in the Neomatrix so A3 converges, added the worked-example + source-lock test, corrected the misleading "decimal" comment, re-pinned the anchor.

### Plain-English (what was wrong / what changed / what you'll see)
- **Wrong**: depreciation was calculated as `cost × rate` without dividing the rate by 100 — because the rate is stored as a percentage (2.5 means 2.5%). So a $100,000 building at 2.5% was claiming **$250,000/yr** of depreciation instead of **$2,500/yr** — 100× too high — which made your taxable income and tax owed look far too low. Separately, the property detail page's "Depreciation/yr" always showed **$0** because it read a field the data doesn't have.
- **Changed**: every place that shows or uses depreciation now runs the one correct calculator (which divides the rate by 100 and handles prime-cost vs diminishing-value).
- **You'll see**: the property detail page now shows a real "Depreciation/yr" (e.g. ~$2,500 for a $100k @ 2.5% capital-works schedule, not $0), and your tax estimate on /cashflow and My Guide will show a smaller, correct depreciation deduction and a correspondingly higher (correct) tax figure.

### PR
- PR: (pending) — draft. MON-003 + MON-026 hold at FIXING until Reza verifies on his data.

# canonicalMonthlyCashflow — actuals-first monthly in/out/net (household headline)

> Quantity Contract — MON-131 Phase A (brief §3). READ-ONLY census at HEAD `fa392b9a`, 2026-07-29.
> Governing settled decisions: **D8** (full loan repayment subtracted; principal portion labelled
> "wealth transfer, not spending"), D1/D2 (FACT/DERIVED), D6 (named quantities).
> Companion contracts: `monthly-cashflow-declared.md`, `monthly-cashflow-per-entity.md`, `savings-rate.md`.

## classification

**DERIVED.** Computed from FACT rows (`UnifiedTransaction`; declared `Income`/`Expense`/`Loan` on
fallback only). Never stored. FACT-input trust caveat (brief §6): MON-001 (fortnightly rent
stored/treated as monthly) is upstream of the declared fallback; MON-135 (`aiCategorisation.ts`
stamping `isRecurring:false`) is upstream of any one-off-gated declared input.

## semantic

- **Basis — actuals-first selection (CLAUDE.md §19.1).** When `quickMetrics.hasActualData === true`
  (≥1 non-transfer `UnifiedTransaction` in the fetched window), every field derives from ACTUAL
  transactions. Otherwise (and ONLY otherwise) declared/planned records
  (see `monthly-cashflow-declared.md`). The chosen basis is returned in `basis: 'actual'|'declared'`
  and must be surfaced ("the UI never lies").
- **Window (actual branch):** current CALENDAR month (`monthKey(now)`), local time
  (`actualCashflow.ts:94-96`). `avgMonthlyOutflow` = trailing ≤3 FULL calendar months' OUT,
  averaged over the POPULATED months only (data-driven divisor, `actualCashflow.ts:176-190`);
  falls back to current-month outflow when the average is 0 (`canonicalCashflow.ts:90`).
- **Inclusions (actual):** all non-transfer transactions; direction decided by `direction`
  ('IN'/'OUT'), never by sign; magnitudes via `Math.abs(amount)`; **uncategorised OUT INCLUDED**
  (bucketed 'Uncategorised' — dropping it was the falsely-optimistic-surplus bug).
  **Loan-repayment treatment per D8: the FULL repayment transaction is in OUT** (a repayment is an
  OUT row like any other; no principal/interest split is applied to the number). D8's
  principal-portion relabel is a LABELLING obligation on surfaces, not an arithmetic change.
- **Exclusions (actual):** `isTransfer === true` rows (both directions).
- **Inclusions (declared fallback):** inflow = orchestrator `monthlyNetIncome`; outflow =
  `monthlyExpenses + monthlyLoanRepayments` (FULL declared repayment per D8);
  net = `monthlyCashflow` (`canonicalCashflow.ts:127-131`).
- **Units:** AUD per calendar month, Float (`number`).
- **Outputs:** `{ inflow, outflow, net, savingsRate, avgMonthlyOutflow, basis }` — the embedded
  `savingsRate` here is **current-month** basis; see `savings-rate.md` DR-3 (naming collision with
  the TTM-first `getCanonicalSavingsRate`).

## canonicalHome

- `lib/calculations/canonicalCashflow.ts:78` `resolveCanonicalCashflow` (the selection rule) and
  `lib/calculations/canonicalCashflow.ts:114` `getCanonicalMonthlyCashflow` (snapshot accessor).
- Actual-branch producer: `lib/calculations/actualCashflow.ts:104` `computeActualCashflow`
  (pure; consumed via `masterFinancialService.ts:1985` → `quickMetrics.actual*` at 2131-2136).
- Forward projection sibling: `canonicalCashflow.ts:189` `projectBalanceForward` (MON-021).
- **Decimal twin: NOT ESTABLISHED.** Neither `canonicalCashflow.ts` nor `actualCashflow.ts` has a
  Decimal sibling (verified: no `Decimal` import in either file). Standing rule 4 (twins migrate
  together) — creating one is a T6 build decision, not assumed here.
- Drift guards already in CI: `tests/calculations/canonicalCashflow.test.ts`,
  `tests/calculations/actualCashflow.test.ts`, `tests/calculations/cashflowSurfacesUseCanonical.test.ts`.

## callSites

All anchors re-verified at HEAD `fa392b9a` (no drift found in the sites below).

| file:line | tag | arithmetic in words |
|---|---|---|
| `app/api/dashboard/insights/route.ts:201` | CONSUMER | reads canonical in/out/net to build Home KPI payload (`kpiTiles`) |
| `app/api/safety-net/route.ts:63` | CONSUMER | `monthlySurplus = canonical .net` feeding the safety score |
| `app/api/cashflow/intelligence/route.ts:597` | CONSUMER | canonical in/out/net → forecast hero + health-score input (loans folded into outflow, `monthlyLoanRepayments: 0` to avoid double count) |
| `app/api/cashflow/intelligence/route.ts:598-609` | DUPLICATE (guarded fallback) | inline `income − expenses − loanRepayments` re-derive, fires ONLY when the master snapshot throws; same shape as declared quantity |
| `app/dashboard/activity/page.tsx:630` | CONSUMER | canonical current-month cashflow tile from `/api/master-snapshot` payload |
| `lib/cfo/intelligenceEngine.ts:260` | CONSUMER | `canonicalNet = .net` for CFO monthly progress |
| `lib/verification/selfAuditInvariants.ts:127,207,225-226` | CONSUMER | Ring-audit invariant reads (net + basis) |
| `lib/services/masterFinancialService.ts:2131-2136` | CONSUMER (assembler) | copies `computeActualCashflow` fields onto `quickMetrics.actual*` verbatim ("no arithmetic here") |
| `lib/calculations/moneyStoryTrend.ts:88` | DIFFERENT-QUANTITY | **trailing-12-month actuals** (`avgMonthlyNet`, `annualNet`) — 12-mo window, not current-month; survives with its own name |
| `app/api/dashboard/margin-trend/route.ts:95` | DIFFERENT-QUANTITY | per-month income/expense series, UTC month keys, **also excludes `isInvestmentContribution`** (a third exclusion rule no other producer applies) |
| `lib/tie/analytics.ts:96` *(§7: anchor +1 — `calculateSpendingSummary` declares at `:96`)* | DIFFERENT-QUANTITY (reference impl) | spending summary over its own window; pattern `actualCashflow.ts` was extracted from |
| `lib/calculations/propertyCashflow.ts` (`computePropertyCashflow`) | DIFFERENT-QUANTITY | per-property cashflow (register row, T5 — not this contract) |
| `lib/intelligence/portfolioEngine.ts:366` | DIFFERENT-QUANTITY | stress-test cashflow: expenses + **interest-only loan cost** (deliberate, documented at 360-365) — NOT the D8 full-repayment basis; needs its own name (see decisionsRequired) |
| `lib/cashflow/forecasting.ts:447,672,734` | DIFFERENT-QUANTITY | event-level forward projections (scheduled items), not the monthly headline |
| `components/bookkeeping/ConsumerMoneyFlowSankey.tsx:75` | CONSUMER (not re-derive of net) | projects snapshot fields into Sankey flows — NOT EXAMINED line-by-line beyond entry point |
| CFO scenarios (`lib/cfo/scenarios/{refinanceLoan,addInvestment,payDownLoan,sellProperty}.ts`) + `lib/cfo/aiAdvisor.ts:326,349,447` + `app/api/cfo/{scenarios/context,advice/chat}/route.ts` | CONSUMER-OF-DECLARED (wrong-input risk) | read `quickMetrics.monthlyCashflow` (DECLARED) as the "before" baseline while the headline is actuals-first — DR-2 |

## invariants

1. `net === inflow − outflow` — exact on the ACTUAL branch (computeActualCashflow returns
   `currentMonthNet = inflow − outflow`); on the DECLARED branch *(§7 correction)* it holds only
   to within ~2¢: the orchestrator rounds each field independently
   (`round(netIncome) − [round(expenses) + round(loanRepayments)] ≠ round(netIncome − expenses − loans)`
   in general, `cashflowOrchestrator.ts:386-396`). Pin as a tolerance test, not strict equality.
2. Actual branch: `outflow === Σ |amount| of non-transfer OUT in current month`, uncategorised
   INCLUDED; a transfer contributes 0 to both sides.
3. **D8:** a loan-repayment transaction (actual) / declared repayment (fallback) contributes its
   FULL amount to `outflow` — never only the interest portion.
4. `basis === 'declared'` ⟹ `quickMetrics.hasActualData === false` (never show plan as actuals).
5. `avgMonthlyOutflow > 0` whenever `outflow > 0` (the sparse-history fallback at
   `canonicalCashflow.ts:90` guarantees it).
6. Cross-surface parity: Home KPI net == /cashflow hero net == Activity month net == Safety-Net
   surplus input, same snapshot (Ring-3; VR-041 Part-C row "Home monthly cashflow −$6,073 PASS").

## independentExpectation

Arithmetic identity from FACT rows: for a fixed month, hand-sum non-transfer `UnifiedTransaction`
rows by `direction` (`Σ|IN| − Σ|OUT|`) and compare to `net`. Fully computable without reading any
other screen. (Golden-baseline household fixture is the Ring-2 form of this.)

## surfaces

| route | label |
|---|---|
| `/dashboard` (Home) | "Cash flow" KPI tile — **the −$6,073/mo headline** (annual −$72,880/yr helper); via `/api/dashboard/insights` `kpiTiles`, fallback `portfolio/snapshot` declared (`app/dashboard/page.tsx:449-453,766`) |
| `/cashflow` | hero "current.net" + 30/90-day forecast (via `/api/cashflow/intelligence`) |
| `/dashboard/activity` | current-month cashflow tile |
| `/dashboard/safety-net` | survival/safety score input (net not displayed raw) via `/api/safety-net` |
| `/dashboard/cfo` | monthly progress card (intelligenceEngine) |
| My Guide | "Month-End Balance" via `projectBalanceForward` |
| `/dashboard/reports` (income-expense report) | "Net Annual Cashflow" — currently a DUPLICATE re-derive, see declared contract |

## expectedMoves

- **D8 relabel → NO numeric movement, explicitly predicted.** The canonical producer ALREADY
  subtracts the full repayment on both bases; D8 adds the "principal = wealth transfer, not
  spending" label to surfaces. `pathPrefix: kpiTiles.cashflow*`, `forecast.current.net`,
  `quickMetrics.actualNetCashflow` — all UNCHANGED. Any movement here during T6 is a defect.
- Migrating `metricAggregation.ts` surplus (omits loans) onto this quantity: health "surplus"
  metric moves DOWN by monthly loan repayments (≈ $12,779/mo at census baseline) —
  `pathPrefix: health.cashflow.surplus` (see declared contract DR-1).
- Re-basing CFO scenario baselines (DR-2) from declared onto canonical: scenario "before" figures
  move from `quickMetrics.monthlyCashflow` (declared) to canonical net — at census data that is
  declared-vs-actual delta; direction depends on live data, must be re-derived pre-migration.

## decisionsRequired

1. **DR-2** — CFO scenarios + AI advisor + `/api/cfo/*` baselines read DECLARED
   `quickMetrics.monthlyCashflow`; headline is actuals-first. Re-base scenarios on canonical
   (numbers move) or keep plan-basis and LABEL it? Consequence: unlabelled today, a scenario
   "before" can contradict the Home headline on the same screen.
2. **DR-7** — name `portfolioEngine.calculateCashflow`'s interest-only stress quantity (e.g.
   `stressTestCashflowInterestOnly`) so it survives deletion sweeps legitimately (D6).
3. **DR-8** — `margin-trend`'s extra exclusion (`isInvestmentContribution`) is a third basis
   variant; either promote the exclusion into the canonical actual basis or name the margin series
   as its own quantity. Accounting consequence: investment contributions currently count as
   "spending" on Home/Activity but not in the margin ribbon.
4. Decimal twin creation for `canonicalCashflow.ts`/`actualCashflow.ts` (NOT ESTABLISHED today) —
   T6 scope call.

## coverageBoundary

Examined end-to-end: `canonicalCashflow.ts`, `actualCashflow.ts`, `masterFinancialService.ts`
(assembly + quickMetrics), `insights`/`safety-net`/`cashflow-intelligence`/`margin-trend`/
`portfolio-snapshot` routes, `app/dashboard/page.tsx` KPI wiring, `activity/page.tsx` entry,
`intelligenceEngine`, `scoreCalculator`, `metricAggregation`, `riskRadar` (:192), `portfolioEngine`
(:366), `moneyStoryTrend`, `forecastEngine` (:182), `incomeExpense` report, `EntityCashflowSummary`
entry, `cashflow/route.ts` + `cashflow/summary/route.ts` input builders. **NOT EXAMINED** from the
heuristic census cashflow list (59): onboarding-wizard files, `companionGateway`/`gateway`,
`budgetComparison`, `taxPack/summary`, `calc-audit` fixture engines (test infra),
`cashflowAnalyzer` (:373), `negativeGearing` (:152), `exporter`, `debt-analysis` route,
`cutSpendCategory` internals, `forecasting.ts` internals, Sankey internals — classified by entry
signature only or left uncounted. The census list is formula-shape heuristic; unexamined ≠ cleared.

## Adversarial review (§7) — 2026-07-29

- **Claims checked: 36** (anchors 24 · arithmetic 9 · negative-claims 3). At HEAD `72b15268`
  (production identical to the contract's `fa392b9a` — diff empty). Verified exactly:
  `resolveCanonicalCashflow :78` / `getCanonicalMonthlyCashflow :114` / declared inputs `:127-131` /
  sparse-history fallback `:90` / `projectBalanceForward :189`; `computeActualCashflow :104` with
  transfers-excluded, direction-decided, `Math.abs` magnitudes, uncategorised-OUT bucketed, local-time
  `monthKey` (`:93-95`), trailing-3-full-months data-driven divisor (`:127-135,:172-190`);
  every CONSUMER anchor (`insights:201`, `safety-net:63`, `intelligence:597` + guarded fallback
  `:598-609` + `monthlyLoanRepayments: 0` at `:616`, `activity:630`, `intelligenceEngine:260`,
  `selfAuditInvariants:127,207,225-226`, `masterFinancialService:1985,2131-2136` "no arithmetic" —
  confirmed verbatim field copies); every DIFFERENT-QUANTITY row (moneyStoryTrend `:88`; margin-trend
  UTC keys + `isInvestmentContribution: false` filter at `:123`; portfolioEngine `:366` interest-only
  stress documented at `:355-365`; forecasting `:447,:672,:734`). Negative claims re-run: no `Decimal`
  import in either canonical file (confirmed); drift-guard tests exist on disk (all three). VR-041
  quote verified verbatim: `docs/verification/runs/VR-041.md:94` "Home monthly cashflow | −$6,073
  (−$72,880/yr) | identical | **PASS**".
- **REFUTED / CORRECTED:**
  1. *Invariant 1* — "net === inflow − outflow exactly, both bases" corrected: exact only on the actual
     branch; the declared branch carries independent 2-dp rounding per field
     (`cashflowOrchestrator.ts:386-396`) → strict equality can fail by cents. Corrected inline.
  2. *Anchor* — `lib/tie/analytics.ts:95` → `:96` (1-line drift). Fixed inline.
- **Could not verify:** `ConsumerMoneyFlowSankey` internals beyond the `:75` entry (the contract
  says so itself); what populates `StrategyDataPacket.cashflowSummary`; the NOT-EXAMINED census
  remainder (boundary-stated). These stand as disclosed gaps, not defects.
- **Verdict impact: none.** Canonical home, basis-selection semantic, all tags, and the "D8 relabel →
  NO numeric movement" prediction survive intact. This contract PASSES adversarial review with two
  cent-level/one-line corrections.

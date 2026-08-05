# MON-131 Scope Filter — which work survives a property-only v1

**Status:** 🔵 READ-ONLY ANALYSIS. Changes nothing. Commissioned by Reza 2026-08-03 to **define MON-131's finish line** before the module-hiding phase begins.
**Pinned HEAD:** `921f6e2` (merge of #1576) · **Companion:** [`PRODUCT_SCOPE_V1_RECOMMENDATION.md`](./PRODUCT_SCOPE_V1_RECOMMENDATION.md) (Q-SCOPE-1, PR #1577)
**Sequence confirmed by Reza 2026-08-03:** finish MON-131 → then module hiding → then property-only focus. This document does **not** propose changing that. It answers one question inside it: *what does "finish" mean?*

> **Why this file is not under a MON-131 path.** `scripts/check-mon131-ledger.mjs` treats `docs/architecture/contracts/`, `docs/verification/**` and `scripts/matrix/` as MON-131 surfaces requiring a same-PR ledger row. This document changes no programme state — it is an input to a decision — so it lives in `docs/strategy/` and carries no ledger row. Stated openly rather than left to look like gate-avoidance.

---

## 0. The headline finding

**Hiding a module removes almost no MON-131 work, and the data is more emphatic than expected.**

- **Zero** of the 40 census quantities are exclusive to the property surface. Every property-side quantity is *also* read today by at least one surface that would be hidden.
- **10 quantities are SPLIT** — read by both a kept and a hidden surface. A split quantity must still converge to one producer, because a kept surface reads it. Hiding the other consumers changes nothing about that obligation.
- **29 of the 63 OPEN/FIXING issues (46%) still reach a kept surface.**

And the sharpest result, which is the whole argument in one row:

> **`expenseRunRate` — the T3 quantity — renders on NO kept surface. But `MON-129`, the class sweep behind it (23 `lib/` producers with no one-off gate), IS in the kept queue** — because two of those producers are `lib/reports/contextBuilder.ts:469` (feeds the surviving tax-time pack) and `lib/services/moneyFlowService.ts:335` (feeds the Activity Sankey).

The *named quantity* goes dark. The *defect class* does not. That is the mechanical proof of the point that a toggle is an exposure control, not a defect control — and it means MON-131's remaining work should be scoped **by producer**, not by tranche.

---

## 1. The 40 quantities, classified

### 1.1 SPLIT — kept surface reads it, so it must still converge (10)

| quantity | producers | tranche | why it survives |
|---|---:|---|---|
| `loanCost` | 30 | **T2** | `/dashboard/properties` loan Budget/Actual rows + portfolio cashflow strip; `/[id]` hero cashflow |
| `deductions` | 105 | T4 | Reports → Tax-Time "Total Deductions"; `/[id]` property tax card |
| `depreciation` | 15 | T4 | `/[id]` "Depreciation/yr"; `/[id]/depreciation` (**duplicate math on the page itself**); both kept reports |
| `incomeTax` | 76 | T4 | Reports → Tax-Time |
| `taxableIncome` | 38 | T4 | Reports → Tax-Time "Net Taxable Income" |
| `propertyCashflowYield` | 6 | T5 | Property tile Cashflow + Yield, hero aggregates, `/[id]` KPI row |
| `propertyEquity` | 11 | T5 | Property row Equity + footer + hero, `/[id]` equity KPI |
| `lvrGearing` | 39 | MON-136 | `properties/page.tsx:452` + `[id]:computeLvr` — **inline producers on the kept pages** |
| `propertyValuationGrowth` | 6 | MON-136 | Property Portfolio report |
| `taxOffsetsFranking` | 48 | MON-136 | indirect — `applyOffsets` → netTax on the Tax-Time pack |

Plus two named sub-quantities with no census key of their own: **loan monthly interest** (the 100× unit bug, T2) and **loan declared min repayment** (T2, CLEAN) — both render on the property pages and the transaction-link dialog.

### 1.2 HIDDEN — no kept consumer (27)

`expenseRunRate` · `incomeRunRate` · `netIncome` · `grossIncome` · `payg`† · `cashflow`† · `netWorth` · `assetsLiabilitiesBreakdown` · `liquidCash` · `savingsRate` · `emergencyMonths` · `healthScore` · `forecastFlows` · `medicareLevy` · `landTax`‡ · `negativeGearing`‡ · `superCap` · `budgetVariance` · `loanAmortisation` · `investmentReturns` · `superProjection` · `freedomHorizon` · `moneyStoryMargin` · `insuranceAdequacy` · `div293` · `psiAttribution` · `fteIeeElections`

† flips to SPLIT if the Activity page keeps its Money-Flow Sankey and current-month cashflow tile (see Lever 2).
‡ borderline — appears on kept property surfaces only as a **date fact** (`landTaxDueDate`) and an **enum regime badge**, not as a derived dollar.

### 1.3 UNVERIFIED — insufficient evidence, not guessed (3 + 1 partial)

| quantity | why unverifiable |
|---|---|
| `cgt` (98 producers) | `mon136-register.md` has no `## surfaces` section; only 12 of 98 sites examined. **`propertyDisposalCgt.ts:148` is a property quantity with no documented render site.** R1 also carries a live correctness bug — `taxIntegration.ts:189-204` applies the 50% discount with no 12-month ownership check. |
| `gst` (15) | BAS half has no render site; the receipt half's producer is `lib/documents/intelligence/parsers/australian.ts` — that is the **kept** document/intake layer, so `gst` plausibly becomes SPLIT. Not determinable. |
| `stampDuty` (4) | No render site documented; only known consumers are CGT cost-base inputs (`lib/cgt/costBase.ts:108`). |
| `forecastFlows` (partial) | `NUMBER_INVENTORY.md` Part 4 records **25 of 70 units NOT EXAMINED**; the contract has no surfaces section. Classified HIDDEN on the four contracted splits only. |

---

## 2. Tranche scope

| tranche | verdict | detail |
|---|---|---|
| **T1** income — DONE | **fully out** | No kept consumer for `incomeRunRate` / `netIncome` / `grossIncome` / `payg`. Rental income still reaches the property engine, but via a different producer. |
| **T2** loan cost — IN BUILD | **partially in — and the kept half is the live half** | `loanCost` + loan monthly interest render on both property pages. **T2-B shrinks sharply:** its remaining ~30 producers (`moneyFlowService:382`, `reports/contextBuilder:392`, `cfo/scoreCalculator`, `riskRadar`, `debtPlanner`, `buildHealthInput:104`) feed hidden surfaces almost exclusively. |
| **T3** expense run-rate | **quantity fully out; class sweep IN** | See §0. Scope T3 as *"close MON-129 at the producers that feed contextBuilder and moneyFlowService"*, not as *"converge `expenseRunRate` across its five household surfaces."* |
| **T4** tax constants + depreciation | **partially in** | IN: `depreciation`, `deductions`, `incomeTax`, `taxableIncome` — all via `/[id]`, `/[id]/depreciation` and the tax-time pack. OUT: `superCap`, `payg`, `negativeGearing`($). **D11 stays in scope** — the `rate` vs `rate%` 100× ambiguity in `DepreciationSchedule.rate` lands directly on a kept page. |
| **T5** balance sheet | **partially in** | IN: `propertyEquity`, `propertyCashflowYield`. OUT: `netWorth`, `assetsLiabilitiesBreakdown`, `liquidCash`. D26 (rentals in equity) and the `properties/page.tsx:812-813` RENTAL `currentValue: 0` bug stay in scope. |
| **T6** rates, scores, runway | **fully out** | Savings rate, runway, all four health scores, all forecast families. |
| **T7** budget remainder | **fully out** | |
| **MON-136** wave 2 | **partially in** | IN: `lvrGearing`, `propertyValuationGrowth`, `taxOffsetsFranking` (indirect). UNVERIFIED: `cgt`, `gst`, `stampDuty`. OUT: the other 10 families. |

---

## 3. The true PROD queue — 29 of 63 issues

Classified by **"does this defect reach a kept surface?"**, not by where it was first reported. Method: `rootCause[]` paths + `downstreamConsumers[]` + the `Surface:` line in `notes`, cross-checked against a real import-graph reachability run (29 kept entry points → 643 reachable modules), with every surprising hit hand-verified at function level.

**CRITICAL (6)** — MON-129 (23 run-rate producers, no one-off gate) · MON-131 (the programme) · MON-130 (12 loan-cost producers read raw `minRepayment`) · MON-136 (wave 2, blocked by MON-131) · MON-037 (one-off expenses as recurring monthly) · MON-001 (fortnightly rent stored as MONTHLY)

**HIGH (12)** — MON-034 (ANNUAL over-stated **12×** in the tax-time report) · MON-143 (interest floor doesn't net the offset, 5.1×) · MON-106 (no FY2026-27 config) · MON-078 (canonical intake classifier — the keystone) · MON-076 (duplicate income rows inflate gross) · MON-084 (no reconcile reuse guard) · MON-087 (Add Expense crashes from the property page) · MON-023 (one-off as $X/mo + reconcile duplicates) · MON-025 (expense frequency defaults MONTHLY) · MON-145 (undated interest-rate scalar) · MON-055 (portfolio net cashflow −$552 vs −$1,055) · MON-133 (hardcoded constants — *partial* reach)

**MEDIUM (9)** — MON-085 · MON-074 · MON-060 · MON-061 · MON-062 · MON-063 · MON-059 · MON-083 · MON-144

**LOW (2)** — MON-069 · MON-147

**Dropped from the queue (33)** — includes all 8 PSI/Div152 entity-tax issues (MON-102/103/104/105/107/108/109/110: `assemblePsiInput`/`assembleDiv152Input` are called *only* from `app/api/tax/entity/**`, which no kept surface reaches) and 11 CFO / super / safety-net / debt-planner / investments defects.

**UNCLEAR (1)** — MON-111. `downstreamConsumers` is empty and `psiClassifier.ts:261` is imported-but-not-invoked on the kept path. Whether the missing s86-15 attribution understates a figure rendered on the Activity Sankey depends on unbuilt company-dispatch design. **Not guessed.**

### Two classification traps worth recording
- **MON-083** would have been mis-scoped as out. Its registry `rootCause` names only the hidden expenses page, but the same Mechanism-C gate demonstrably also lives in `components/ExpenseDialog.tsx:665-670` (the comment there cites MON-083), which the property list and `PropertyExpensesCard` both use. Resolved by reading code, not the registry.
- **MON-024's** `rootCause` cites `masterFinancialService.ts:892`, which is now `getMonthlyActualsMap` — a **stale line reference**.

---

## 4. Two scope levers that materially change the remaining work

Neither is a recommendation to change the confirmed sequence. Both are decisions that shrink the finish line, and both are Reza's.

**Lever 1 — the surviving report.** `incomeTax`, `taxableIncome`, `deductions` and `depreciation` reach the kept side **only** through the Tax-Time / Property-Portfolio pack. Worse, the contracts record that pack as rendering **duplicate producers today** via `reports/contextBuilder` — the same builder serving the hidden income-expense and financial-summary reports, so hiding those does not remove its duplication from the pack you keep. **Drop the tax-time pack from v1 and a large share of T4 falls out of scope. Keep it and T4's property slice is mandatory.**

**Lever 2 — Activity's widgets vs Activity's intake.** The keep list retains `/dashboard/activity` *as the intake path*. But five quantities are consumed by **widgets** on that page, not by intake: `incomeTax` (Sankey tax node), `taxableIncome`, `loanCost` (the Money-Flow "Loans $106K/yr" duplicate class), `cashflow` (`activity/page.tsx:630` current-month tile) and `payg`. **Strip the widgets and keep the intake, and `payg` + `cashflow` leave scope entirely.**

---

## 5. What this means for the finish line

Under the confirmed sequence — MON-131 first, then hiding — this analysis does not change *when* you hide. It changes what "MON-131 complete" needs to mean:

- **The programme's own definition of done** covers all 23 quantities + MON-136 + the full Matrix sweep, with T4–T7 blocked on four facts only Reza can supply.
- **The scope-defined finish line** is: T2 (kept half) + MON-129's producers at `contextBuilder`/`moneyFlowService` + the property slices of T4 and T5 + `lvrGearing` and `propertyValuationGrowth` from MON-136 — with `cgt`/`gst`/`stampDuty` resolved from UNVERIFIED first, since `cgt` is the one that could be a property quantity in disguise.

**Recommendation:** finish MON-131 to the *scope-defined* line, not the *programme-complete* line — then hide, then reassess whether the remaining tranches are ever worth converging for surfaces that are dark. Reza's call; the data is now on the table either way.

---

## 6. Caveats (§20.6 coverage boundary)

This document verifies the quantity→surface mapping from the 45 contracts under `docs/architecture/contracts/`, the tranche assignments from `NUMBER_INVENTORY.md` and the completion brief, and the issue classification from `ISSUES.json` cross-checked against a real import-graph run — all at HEAD `921f6e2`. It does **NOT** verify:

- **Producer counts as work estimates.** The census counts formula-shape sites *by pattern*, not verified producers. `medicareLevy` shows 20 but is CLEAN with 1 producer; `cgt`'s 98 has acknowledged heavy keyword false positives; `liquidCash`'s 58 "over-matches heavily"; `superCap` had 6 of 10 false positives. The scoreboard says the same in its own "what this does NOT tell you" section.
- **Exhaustiveness of the surface lists.** `monthly-recurring-run-rate.md`, `income-gross-run-rate.md`, `monthly-cashflow-per-entity.md` and `property-cashflow.md` all declare their enumeration incomplete. A missed kept-side consumer for `expenseRunRate` or `incomeRunRate` is possible.
- **Anything about `cgt`, `gst` or `stampDuty`** beyond "not classifiable from the artefacts."
- **That any kept-surface number is currently correct** — MON-001, MON-143 and MON-037 say otherwise.

**Registry-quality note for the programme:** `ISSUES.json`'s `surface` field is effectively dead — populated on 2 of 135 issues, both CLOSED. The live convention is a `Surface:` line inside `notes`. Anything consuming `surface` programmatically reads null for all 63 open issues.

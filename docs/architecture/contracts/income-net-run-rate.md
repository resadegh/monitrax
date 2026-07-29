# incomeNetRunRate (net income — the D9 quantity)

> Phase A Quantity Contract — MON-131 / MON-128 (T1). READ-ONLY census at HEAD `fa392b9a`, 2026-07-29.
> D9 (SETTLED input, not re-opened here): income "net" becomes after-tax across ALL sources,
> **or the field is renamed** — net may never exceed gross. This contract documents what
> "net" actually is today (it is neither), and the fork D9 leaves open.

## classification

**DERIVED** (D1). Never stored. (The per-row `Income.netAmount` FACT column is an input,
not this quantity — and it is itself a *derived-value-stored-as-fact*, see decisionsRequired.)

## semantic

**There is no single semantic — "net income" is FIVE different computations today.
Each is stated below; the splits are UNNAMED and this is the contract's core finding.**

| # | producer | per-row semantic for SALARY | non-salary rows | one-off gate |
|---|---|---|---|---|
| A | `incomeAggregator.getNetAmount` (:92) | GROSS+`netAmount`→ netAmount(annual)/12; NET→ amount×freq; **GROSS without netAmount → GROSS passthrough (no tax deducted)** | gross passthrough (:105-106 "tax calculated at year end") | **none** (loop :160; `isRecurring` not in the input type) |
| B | `lib/income/netIncomeCalculator.getNetMonthlyIncome` (:59) | GROSS→ netAmount/12 (:69) or ENGINE take-home fallback (:73 via `calculateTakeHomePay`); NET→ amount×freq | gross passthrough | **yes → contributes 0** (:64, MON-053) |
| C | `cashflowOrchestrator.calculateIncomeAmounts` (:131) | NET→ amount; **GROSS → ALWAYS engine take-home (:158), ignoring stored `netAmount`** (so salary-sacrifice baked into netAmount is lost) | gross passthrough | none |
| D | `incomeNormalizer.normalizeIncomeStream` (:87) | NET→ netAmount/12 or amount; GROSS+netAmount→ netAmount/12; GROSS w/o netAmount→ `calculateNetSalary` (:49 — PAYG+Medicare, **NO LITO**) | gross passthrough, `isAfterTax:false` | none |
| E | `buildHealthInput.getNetMonthlyIncome` (lib/health/buildHealthInput.ts:37) | **ALWAYS engine take-home on `amount`, regardless of `salaryType` — a NET-entered salary is taxed a second time** | gross passthrough | none |

- **basis:** declared `Income` rows (A–E all declared; the actuals-based income figure is a
  different quantity, `quickMetrics.actual*` — not in this contract's scope).
- **window:** run-rate (monthly/annual steady state).
- **units:** AUD/month (B, C, D, E) or per `targetFrequency` (A). FACT columns
  `netAmount`/`grossAmount`/`paygWithholding` are ALREADY-ANNUAL (schema :1930-1933).
- **inclusions/exclusions:** per the table — the D9 target semantic (*after-tax across all
  sources*) is implemented **nowhere**: every variant passes non-salary income through gross.

**Headline consumer:** `quickMetrics.monthlyIncome` = `monthlyIncome.all.netTotal`
(masterFinancialService.ts:2100, built from variant A at :1865/:1130), **labelled
"monthly NET income (after PAYG)" at :354.** Verified-in-code enablers of the reported
net($495,636/yr) > gross($317,751/yr) inversion: (i) no one-off gate in A — a one-off
receipt annualises ×frequency into netTotal; (ii) A trusts stored `netAmount`/`grossAmount`
FACTs with no `net ≤ gross` clamp — a stale or invented pair (see wrong-inputs) inverts the
pair silently; (iii) GROSS-salary-without-netAmount counts at gross inside "net".
The rendered dollar figures themselves could not be reproduced read-only (no DB access).

## canonicalHome

**NOT ESTABLISHED — needs a decision (the D9 execution fork, decisionsRequired #1).**
Candidate survivor if D9-(a): `incomeAggregator.aggregateIncome` (:143) + Decimal twin
`aggregateIncomeDecimal` (:286), re-founded to deduct tax for all sources via the tax
engine. Candidate if D9-(b) rename: same home, field renamed (e.g.
`declaredIncomeNetOfStoredPayg`). Variant B's one-off gate must survive either way.

## callSites

| file:line | tag | what it actually computes |
|---|---|---|
| lib/calculations/incomeAggregator.ts:92 (+Decimal :255) | DUPLICATE-CANDIDATE / survivor-candidate (variant A) | netTotal as table above; feeds master snapshot |
| lib/income/netIncomeCalculator.ts:59 (+:84 annual) | DUPLICATE (variant B) — **only variant with the one-off gate**; no Decimal twin exists | income page effective amounts |
| lib/calculations/cashflowOrchestrator.ts:131/:175 (+Decimal :491) | DUPLICATE (variant C) | cashflow endpoints' monthlyNetIncome; also the :147/:505 grossAmount-units bug (see gross contract) |
| lib/cashflow/incomeNormalizer.ts:87/:183/:213 (+Decimal :340/:429/:454) | DUPLICATE (variant D) | per-stream net; `normalizeAllIncome` totals |
| lib/health/buildHealthInput.ts:37 | DUPLICATE (variant E, **WRONG for NET-entered salaries — double-taxes**) | health-score income input |
| lib/services/masterFinancialService.ts:2100 `quickMetrics.monthlyIncome` | CONSUMER (of A) | the SSOT contract field, label :354 |
| lib/services/masterFinancialService.ts:1413-1423 | CONSUMER | savingsRate + debtToIncome derived from A's netTotal |
| lib/calculations/canonicalCashflow.ts:168 | CONSUMER | declared-basis fallback for canonical savings rate |
| app/api/budget-analysis/generate/route.ts:267 | CONSUMER | budget generator's monthlyNetIncome |
| app/api/dashboard/insights/route.ts:282/:626 | CONSUMER | reads BOTH `income.monthly.all.netTotal` and `quickMetrics.monthlyIncome` |
| lib/cfo/scenarios/cutSpendCategory.ts:37/:154 | CONSUMER | scenario income base off quickMetrics |
| lib/cfo/aiAdvisor.ts:327/:444 | CONSUMER | AI context income |
| lib/neobrain/factPack.ts:245 | CONSUMER | fact `cashflow.monthlyIncome` "Monthly net income" |
| app/api/cashflow/intelligence/route.ts:112 | DUPLICATE (aggregation loop over variant D) | Σ normalizeIncomeStream().netMonthlyAmount |
| app/api/cashflow/summary/route.ts:54-70 | DUPLICATE (same loop re-typed) | identical Σ over variant D |
| app/dashboard/income/page.tsx:737-745 | CONSUMER (of B) | `totalNetMonthly` — **the income page and quickMetrics disagree whenever a one-off income row exists** (B gates, A doesn't) |
| lib/cashflow/buildCFEInput.ts:37 | NOT EXAMINED for net path (income rows fetched; per-stream handling not read to end) | — |
| remaining census `netIncome` candidates (45 heuristic hits: trustDistribution, xero snapshotPuller, entityTaxFactsAssembler, EntityCashflowSummary, Phase2Enhancements, budget page, debt-analysis route, moneyFlowService, forecastEngine, etc.) | NOT EXAMINED | see coverageBoundary |

## invariants

1. **`netTotal ≤ grossTotal` — ALWAYS, Float and Decimal, per-row and aggregate** (the
   day-one T1 test, design record §8). Requires the FACT-cleanup precondition below or it
   fails on data, not code.
2. One-off gate: `isRecurring === false` row contributes 0 to the net RUN-RATE (B's
   semantic becomes universal), while the tax side counts it once.
3. A NET-entered salary is never passed through a tax engine again (kills variant E's
   double-tax class).
4. Same input rows ⇒ same net on every surface (income page vs quickMetrics vs cashflow —
   A3 convergence).
5. Float ≡ Decimal parity; a Decimal twin must exist for the survivor (variant B currently
   has none).
6. If D9-(a): `netTotal === grossTotal − taxTotal` where taxTotal reconciles to the tax
   engine's household position for the same rows.

## independentExpectation

For salary rows: net = gross − (PAYG + Medicare − offsets, floored at 0) per
`TAX_YEAR_CONFIGS` (ITAA 1997 / Medicare Levy Act rates) — hand-computable worked example
per §19.2. For the aggregate under today's variant A: arithmetic identity over stored FACT
columns (hand-summable from the Income table). For non-salary sources under D9-(a): the
governing rule is the household marginal tax position — **no independent expectation exists
until the D9 fork is decided** (which engine, which offsets). Until then the aggregate
"net" is verifiable only as an arithmetic identity, not as "after-tax truth".

## surfaces

| route | label |
|---|---|
| /dashboard/income | "Monthly (net)" totals row (page.tsx:1347), per-item effective amounts, salary preview "Net" (:1985) |
| /dashboard (Home) | Money Story / insights income (api/dashboard/insights :282/:626); MoneyStoryHero "Kept" line (net − essentials, component header comment) |
| /dashboard/budget-analysis | income sanity line = quickMetrics.monthlyIncome (generate route :18/:267) |
| /dashboard/cashflow | declared-fallback savings rate + forecast net (canonicalCashflow :168; summary route Σ variant D) |
| /dashboard/cfo + what-if levers | scenario bases (cutSpendCategory :37; aiAdvisor :327) |
| /dashboard/plan | MoneyInSection (census hit plan/page.tsx:195 — NOT EXAMINED) |
| My Guide / health | health score income input via variant E (buildHealthInput :37) |
| NeoBrain chat answers | factPack `cashflow.monthlyIncome` (:245) |

## expectedMoves

Prefix: `lib/services/masterFinancialService.ts:getMasterFinancialSnapshot`.

| pathPrefix | prediction | arithmetic |
|---|---|---|
| `…quickMetrics.monthlyIncome` | MOVES (direction depends on D9 fork + data). D9-(a): DOWN by the tax on currently-gross-passthrough sources; one-off gate: DOWN by Σ annualised(one-offs)/12. Must satisfy new value ≤ `income.monthly.all.grossTotal`. | pre-compute per row from the Income table before merge |
| `…income.monthly.all.netTotal` (+ per-type `byType.*.net`, `primary/secondary/passive.netTotal`) | MOVES identically | same |
| `…quickMetrics.savingsRate`, `…quickMetrics.debtToIncome` (:1413/:1422) | MOVE mechanically (denominator/base changes) | savingsRate' = (net' − exp − loans)/net'; debtToIncome' = debt/(net'×12) |
| `…quickMetrics.monthlyExpenses`, loan costs, net worth, all non-income subtrees | **NO MOVEMENT** | any move = defect |
| Health score inputs (variant E fix) | MOVES for NET-entered salaries only | net' = amount×freq (was engine(amount)) — score delta flows through MON-134-deterministic engine |

## decisionsRequired

1. **The D9 execution fork (D9 itself is settled; the HOW is not):**
   (a) compute after-tax across all sources — requires choosing the engine variant
   (with/without LITO, Medicare, MLS; household vs per-owner marginal rate) and accepting
   run-rate↔tax coupling; or (b) rename the field to what it is (declared income net of
   stored PAYG) and surface true after-tax only on tax surfaces. Consequence: (a) changes
   every consumer's number; (b) changes labels only but leaves "net" ≠ after-tax for
   non-salary forever.
2. **Stored `netAmount` vs engine recompute for GROSS salaries:** variant A/D trust the
   stored FACT (which embeds salary sacrifice), variant C/E recompute. Trusting keeps
   user-visible fidelity but inherits invented/stale FACTs; recomputing loses sacrifice
   unless the engine takes it as input. Pick one.
3. **LITO in or out of per-stream take-home:** `calculateTakeHomePay` includes LITO
   (:249-256), its sibling `calculateNetSalary` (:49-76) does not — see
   salary-take-home-pay contract. The survivor's formula must be named.
4. **Which variant's one-off treatment governs the run-rate:** B's contributes-0 (recommended
   by the design record) — confirm, and confirm A gains the gate in the same PR that deletes B.

## coverageBoundary

Files read end-to-end: incomeAggregator.ts, incomeNormalizer.ts, lib/income/netIncomeCalculator.ts.
Read in targeted sections: masterFinancialService (:246-390, :1050-1170, :1400-1430,
:1845-1880, :2090-2140), cashflowOrchestrator (:1-200, :290-400, :491-533), buildHealthInput
(:25-60), income page (:320-370, :555-570, :720-760, grep of render sites), cashflow
intelligence/summary routes (:30-75/:105-135), canonicalCashflow (:155-185). NOT examined:
~25 census `netIncome` candidates listed above as NOT EXAMINED; app/api/income PUT re-sync
behaviour; EntityCashflowSummary; plan page; forecastEngine; moneyFlowService; Xero puller;
trust-distribution "net" hits (likely a different quantity — distributable income). Rendered
values ($41,303/mo, $317,751/yr) not reproducible read-only; mechanisms verified in code only.

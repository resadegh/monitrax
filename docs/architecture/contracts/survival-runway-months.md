# survival-runway-months (today: emergency-fund-months)

**Proposed names:**
- **Current shipped quantity:** `emergency-fund-months` — "how many months would my liquid cash cover
  my average total outflow?"
- **D3/D4 target quantity (MON-132):** `survival-runway-months` — **"if you lose your salary income,
  how long can you survive?"** (that sentence MUST appear on the page — D3, DECIDED). The migration
  REDEFINES the canonical quantity; this one contract covers both the as-is and the to-be, with the
  expectedMoves bridging them.

Phase A Quantity Contract (MON-131, brief §3; census section `emergencyMonths` = 14).
READ-ONLY analysis at HEAD `2f9f2e16`.

## classification

**DERIVED** (D1). Months (ratio, AUD ÷ AUD/month). Never stored.

## semantic

**As-is (canonical today,** `masterFinancialService.ts:1380–1402` + call `:2035–2041`**):**
`monthsCovered = liquidCash / burn`, where
- `liquidCash` = `computeLiquidCash(...)` net of revolving credit (`:1978`, MON-031/064 — cash
  equivalents; D5 basis)
- `burn` = `actualCashflow.avgMonthlyOutflow` (trailing actual OUT txns incl. loans + uncategorised)
  when transactions exist, else `monthlyExpenses.recurring.total` (declared recurring, MON-011);
- `burn ≤ 0 ⇒ monthsCovered = 0`; `targetMonths = 6`; `gap = max(0, 6×burn − liquid)`;
  status danger <1 / warning <3 / good <6 / excellent ≥6.
This answers "cover of TOTAL outflow" and **ignores that rental income keeps flowing when salary
stops** — why it reads 11.6 while true salary-loss survival is ~72 months.

**To-be (D3+D4, DECIDED):**
`survivalRunwayMonths = liquidCash / netSurvivalBurn`
- `netSurvivalBurn = essentialExpenses INCLUDING loan repayments − salaryIndependentIncome`
- D4 worked figures: essential = $1,482 bills + $12,779 loans = **$14,261/mo**; salary-independent
  (rental) ≈ **$10,102/mo**; net burn ≈ **$4,159/mo**
- `netSurvivalBurn ≤ 0 ⇒ runway is INDEFINITE` (income outlives salary loss) — an explicit
  representable state, never 0, never a fake large number (the 999/12 sentinels below are the
  anti-pattern).
- Units: months; liquid basis stays D5 (cash equivalents only; shares a separate labelled line;
  SMSF excluded).

## canonicalHome

**As-is:** `lib/services/masterFinancialService.ts:1380` `buildEmergencyFundMetrics` →
`snapshot.emergencyFund` (MON-017 already routed /api/safety-net onto it).
**Decimal twin: NOT ESTABLISHED** (no Decimal sibling exists for this producer).
**To-be:** MON-132 decision — extend `buildEmergencyFundMetrics` in place vs a pure
`lib/calculations/survivalRunway.ts` engine consumed by master (decision 1 below). Either way ONE
producer + a Decimal twin created in the same PR (design-record rule 4).

## callSites

Producer census (the "14" regex family, enumerated and tagged; C=CONSUMER, D=DUPLICATE,
DQ=DIFFERENT-QUANTITY):

| Site | Formula found | Tag |
|---|---|---|
| `lib/services/masterFinancialService.ts:1385` | liquid ÷ burn (canonical) | **CANONICAL** |
| `app/api/safety-net/route.ts:50–54, :152` | reads `snapshot.emergencyFund` | C |
| `app/api/dashboard/insights/route.ts:350–352, :515–529` | reads `snapshot.emergencyFund` | C |
| `app/api/cfo/advice/chat/route.ts:113` | reads `.monthsCovered` | C |
| `components/portal/clients/ClientCanonicalDashboard.tsx:199–215` | renders snapshot EF | C |
| `lib/cfo/scenarios/cutSpendCategory.ts:48` | `snapshot.emergencyFund.liquidCash / expensesAfterCut` | DQ (what-if months AFTER a spend cut — legitimately different; uses canonical numerator) |
| `app/api/safety-net/route.ts:103, :109, :115` | `(liquid − shockCost) / outgoings` | DQ (post-shock runway scenarios; derived from canonical inputs) |
| `lib/health/metricAggregation.ts:171` | liquid-INCL-SHARES (`:129`) ÷ ALL declared expenses; **expenses = 0 ⇒ 12** | DQ per D5 (the "investable buffer months" other-named quantity) — but its 12-month zero-burn sentinel is an invention; see decision 4 |
| `lib/health/metricAggregation.ts:450` | same formula re-typed inside the same file (risk section) | **D** (intra-file duplicate of `:171` — should call one internal helper) |
| `lib/cfo/scoreCalculator.ts:210` (+ Decimal `:512`; audit mirror `lib/calc-audit/engines/decimal-cfo-score-risk.ts:119`) | liquid net-of-cards ÷ ESSENTIAL declared expenses (no loans); `essential = 0 ⇒ score 100/50` | DQ (essential-only buffer feeding the CFO emergencyBuffer action-signal; loans excluded — D4 says loans ARE essential → decision 3) |
| `lib/cashflow-intelligence/healthScoreAggregator.ts:88–89` | availableCash ÷ burnRate (fallback path) | D (re-derivation inside a score engine; should receive the canonical months) |
| `app/api/cashflow/intelligence/route.ts:168` | totalBalance ÷ monthlyOutflow | D (route-level re-derivation) |
| `app/api/cashflow/summary/route.ts:112` | totalBalance ÷ monthlyOutflow | D |
| `lib/intelligence/insightsEngine.ts:650` | totalCash ÷ monthlyExpenses | D |
| `lib/strategy/analyzers/cashflowAnalyzer.ts:383` | availableCash ÷ monthlyExpenses | D |
| `lib/reports/contextBuilder.ts:236` | liquidAssets ÷ monthlyBurn; **burn ≤ 0 ⇒ 999** | D (999 sentinel is a fabricated number on a report surface) |
| `app/(dashboard)/cashflow/components/LiquidityHealth.tsx:186` | totalLiquidity ÷ monthlyExpenses **in a component** | D (§12.2.1 violation — UI-side derivation) |
| `lib/cashflow/forecasting.ts:757` | balance ÷ DAILY burn ⇒ days | DQ (days-of-cash forecast, different unit + window) |
| `app/api/transactions/[id]/link/route.ts:1771` | daysCovered/30.44 | DQ (transaction-pattern span months — not a money runway at all) |

Every Phase B deletion of a **D** row must cite this table.

## invariants

- `runway ≥ 0`; `burn > 0` required for a finite figure.
- **Zero/negative-burn semantics (the load-bearing invariant):** canonical must state the absent case
  explicitly — as-is `burn ≤ 0 ⇒ 0`; to-be `netSurvivalBurn ≤ 0 ⇒ INDEFINITE` (representable state,
  page copy "your other income outlasts a salary loss"). The 12 (`metricAggregation.ts:171`), 999
  (`contextBuilder.ts:236`) and 100/50-score (`scoreCalculator.ts:208`) sentinels are three MORE
  answers to the same absent case — Phase B must collapse to ONE stated semantic per named quantity.
- Identity: `gap = max(0, targetMonths×burn − liquid)` consistent with `monthsCovered` (same burn).
- D5 numerator law: liquid = cash equivalents net of revolving credit; never shares, never SMSF.
- To-be additivity: `netSurvivalBurn = essentialBills + loanRepayments − salaryIndependentIncome`,
  each term traceable to its own canonical producer (loan cost via `resolveLoanMonthlyCost` — IO
  loans never $0).

## independentExpectation

**Arithmetic identity (this one IS independently checkable):** runway is a pure ratio of three
canonically-produced terms. D4's worked example: **$301,808 ÷ ($14,261 − $10,102) = $301,808 ÷
$4,159 ≈ 72.57 months** — reproducible by hand from the census figures without reading any screen.
The 6-month target itself is policy (Barefoot/CFPB convention) — **NONE FOUND** as legislation;
target is a preference, the ratio is arithmetic.

## surfaces

| Route | Label |
|---|---|
| `/dashboard/safety-net` | Emergency-fund hero: months (currently **11.6-class figure**), target 6, liquid, monthly outgoings, gap, weeks-to-target (`safety-net/page.tsx:222–274`). **Must carry the D3 sentence post-migration.** |
| `/dashboard` (Home) | `GlassEmergencyFund` tile + `InsightWidgets` EF widget (`page.tsx:965–970`; `GlassInsightTiles.tsx:107,155–184`; `InsightWidgets.tsx:144–216`) via `/api/dashboard/insights` |
| `/dashboard` TRAIL stage logic | `TrailStageIndicator.tsx:181` (months <3 gates stage 2) — behavioural consumer |
| `/portal/clients/[id]` | "Emergency fund — X months covered" card (`ClientCanonicalDashboard.tsx:199`) |
| `/dashboard/cfo` (chat) | AI context `emergencyFundMonths` |
| `/cashflow` | `LiquidityHealth` months (component-side duplicate — currently a DIFFERENT number than the tile; converges when D row deleted) |
| Reports | `contextBuilder` cashflowRunway (999 sentinel surface) |

## expectedMoves

Written BEFORE migration (MON-132):

| pathPrefix | Why | Arithmetic |
|---|---|---|
| `data.emergencyFund.monthsCovered` (`/api/safety-net`), `emergencyFund.monthsCovered` (`/api/dashboard/insights`), portal EF card | D3/D4 redefinition: burn changes from avg TOTAL outflow (~$26k class → 11.6 mo) to essential-incl-loans NET of salary-independent income | **11.6 → ≈72.6** (301,808 ÷ 4,159 = 72.57; expect ±1–2 mo as live rental/essential figures drift from the census snapshot) |
| `emergencyFund.monthlyExpenses` / `monthlyOutgoings` labels | denominator becomes net survival burn | ~$25,973-class avg outflow → **$4,159** net burn (page must relabel: "net monthly burn if salary stops", showing the $14,261 − $10,102 composition) |
| `emergencyFund.gap` | 6×burn − liquid | 6×4,159 = $24,954 < $301,808 ⇒ **gap → 0** ("target reached") |
| `emergencyFund.status` | thresholds unchanged, months saturate | good/excellent boundary — **→ excellent** |
| The four scores (`overall-financial-health-score`, `snapshot-health-score`, `cashflow-health-score`, `safety-net-score`) | all EF components saturate at ≥6 months; three engines don't read this producer at all | **NO movement — stated explicitly** (see each score contract's arithmetic; the strongest, easiest-to-falsify prediction here) |
| `weeksToTarget` (`/api/safety-net`) | gap ⇒ 0 | → 0 |

## decisionsRequired

1. **Home of the survivor:** extend `buildEmergencyFundMetrics` in place, or a pure
   `lib/calculations/survivalRunway.ts` engine (testable, Decimal twin alongside) that master calls?
   (Architect lens favours the pure engine; either satisfies one-producer.)
2. **"Salary-independent income" definition:** rental net cashflow only (D4's arithmetic uses
   ~$10,102 rental), or also dividends/interest/royalties? And GROSS vs NET-of-property-costs rental?
   (D4's $10,102 must be traced to its producer before build — a fork Reza must pin; the Phase 58 FI
   engine already chose per-property NET, `insights/route.ts:477–502` — consistency argues NET.)
3. **The CFO essential-buffer signal excludes loan repayments** (`scoreCalculator.ts:204–206`) while
   D4 rules loans essential — align the action-signal's denominator, or name it as its own
   quantity ("essential-bills buffer") and keep? (DQ vs semantic-bug fork — do not silently fix.)
4. **Zero/negative-burn display semantics:** approve INDEFINITE/∞ as a representable state + page
   copy; simultaneously outlaw the 12 / 999 / 0 sentinel divergence (one stated absence semantic
   per named quantity).
5. **Does `targetMonths = 6` survive the reframe?** 6 months of net survival burn = $24,954 — the
   user is 12× past it. Keep 6-of-burn, switch target to a dollar floor, or stage-based target?
   (Behaviour-psychology lens: "72 months, target 6" reads as permission to stop holding cash —
   the page needs a next-action, not just a bigger number.)
6. **Retention of the as-is quantity:** does "months of total-outflow cover" survive anywhere as its
   own named line (it answers a real question: cover WITHOUT income loss), or is it deleted
   everywhere in favour of survival runway? D13-style naming decision.

## coverageBoundary

Read at HEAD: `masterFinancialService.ts:1380–1402, 1970–2051`, `safety-net/route.ts:30–170`,
`insights/route.ts:330–540`, `metricAggregation.ts:90–200, 440–460`, `scoreCalculator.ts:190–220,
487–522`, `healthScoreAggregator.ts:77–106`, plus one-line verification of every census row above.
NOT read end-to-end: `actualCashflow.ts` internals (avgMonthlyOutflow window mechanics),
`contextBuilder.ts`, `insightsEngine.ts:650` context, `cashflowAnalyzer.ts:383` context,
`forecasting.ts` — tagged from their formula lines + immediate context only; the Phase B file-owner
agents must re-read before deleting. FACT-input trust (MON-001 fortnightly-rent class) NOT verified
here — a correct runway over a wrong rental figure is still wrong, and decision 2's $10,102 trace is
the gate.

*Drift:* brief's "~:1380" exact at HEAD (`:1380`). Census regex count 14 vs 19 enumerated rows here:
the regex misses reads-via-snapshot consumers and the days/pattern DQ variants — the table above is
the fuller map.

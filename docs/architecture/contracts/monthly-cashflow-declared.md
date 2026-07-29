# declaredMonthlyCashflow — planned monthly cashflow from declared records

> Quantity Contract — MON-131 Phase A. READ-ONLY census at HEAD `fa392b9a`, 2026-07-29.
> This is the PLAN-side quantity (§19.1: fallback + budget/plan labelling only). It is a
> **legitimately different quantity** from `canonicalMonthlyCashflow` — never delete one for the
> other; the 2026-06-25 case study (+$10,505 dashboard vs −$20,914 /cashflow) was exactly the
> failure of conflating them.

## classification

**DERIVED.** From FACT rows `Income`/`Expense`/`Loan` × frequency. Never stored.
FACT trust: MON-001 (rent frequency) and MON-135 (`isRecurring` stamping) sit upstream —
a correct formula over those rows is still wrong until they are fixed (brief §6).

## semantic

- **Basis:** declared/planned records only. This is "what the plan says should happen monthly",
  shown as actuals ONLY via the canonical fallback when no transactions exist; otherwise it must
  be labelled budget/plan (§19.1).
- **Window:** none (a run-rate, not a calendar bucket). Frequency conversion via
  `toMonthly`/`toMonthlyDecimal`.
- **Formula:** `monthlyCashflow = monthlyNetIncome − monthlyExpenses − monthlyLoanRepayments`.
  Income is NET for SALARY (PAYG via `calculateTakeHomePay`, `cashflowOrchestrator.ts:143-168`);
  all other income types pass through as-entered (the D9/T1 "net may exceed gross" exposure).
- **Loan-repayment treatment per D8:** the FULL declared repayment
  (`toMonthly(minRepayment, repaymentFrequency)`) is subtracted — principal not split out.
  D8 relabel = display only, no arithmetic change.
- **One-off gate — INCONSISTENT, load-bearing finding:** the orchestrator itself applies NO
  `isRecurring` gate (`toMonthly` over every expense, `cashflowOrchestrator.ts:348`). The gate is
  applied by SOME callers at input: master filters `isRecurring !== false` before calling
  (`masterFinancialService.ts:1919-1920`, MON-011); `cashflow/summary` uses `monthlyRunRate`;
  `portfolio/snapshot` uses `annualRunRate`. A caller passing raw rows gets a DIFFERENT declared
  cashflow. The basis is therefore currently caller-defined, not producer-defined (DR-5).
- **Units:** AUD/month (and ×12 annual siblings), Float; Decimal twin exact (no mid-calc rounding).

## canonicalHome

- `lib/calculations/cashflowOrchestrator.ts:302` `calculateCashflow` — **Decimal twin**
  `cashflowOrchestrator.ts:533` `calculateCashflowDecimal` (migrate together, rule 4).
- **Internal duplication inside the canonical file (finding):**
  `calculateMonthlyCashflow` (:187) re-implements the same math independently of
  `calculateCashflow` (separate loops, no delegation), and `calculateAnnualCashflow` (:237) /
  `calculateSimpleCashflow` (:256) build on IT — two Float paths for one quantity in one file
  (DR-4). `portfolioEngine.ts:371` consumes the simple path.

## callSites

Anchors re-verified at HEAD `fa392b9a`.

| file:line | tag | arithmetic in words |
|---|---|---|
| `lib/services/masterFinancialService.ts:1933` | CONSUMER (assembler) | feeds recurring-only expenses + `minRepayment`-truthy loans; result → `cashflow` block + `quickMetrics.monthlyCashflow/savingsRate` (:2106,:2111). **Wrong-input finding:** the loan filter `l.minRepayment && l.repaymentFrequency` (:1927) DROPS interest-only loans with `minRepayment = 0` entirely — declared outflow understates IO interest (MON-130/T2 class, ≈$3,709/mo at census) |
| `app/api/portfolio/snapshot/route.ts:700-701,996` | DUPLICATE (hybrid basis) | re-derives `monthlyNetCashflow = (netIncome − annualRunRate expenses − loanCost×12)/12` — but loan cost is `totalLoanMonthlyCost` (ACTUALS-FIRST resolver), i.e. a declared figure with an actuals ingredient: a THIRD basis nobody named (DR-6). Is the Home page's declared FALLBACK (`app/dashboard/page.tsx:452-453`) |
| `app/api/cashflow/summary/route.ts:35` (buildSummaryInput, ~:54-80) | DUPLICATE (hybrid) | net income via `normalizeIncomeStream`, expenses via `monthlyRunRate`, loans via actuals-first `loanCosts` — same hybrid family as portfolio/snapshot |
| `app/api/cashflow/intelligence/route.ts:598-609` | DUPLICATE (guarded fallback) | inline declared re-derive, fires only when master snapshot fetch throws |
| `lib/cfo/scoreCalculator.ts:125` `calculateCashflowStrength` (+Decimal :423) | DUPLICATE (wrong inputs) | re-derives net cashflow from raw reduces: **GROSS** `i.amount` (no PAYG netting), no one-off gate, raw `minRepayment` (IO → $0); maps ratio → 0-100 score. The RATIO re-derive is the duplicate; the score mapping is its own quantity (see `savings-rate.md` pattern) |
| `lib/cfo/riskRadar.ts:192` `detectCashflowShortfallRisks` (~:200-207) | DUPLICATE (wrong inputs) | same raw-reduce pattern (gross income, no gate, raw `minRepayment`) to detect deficit |
| `lib/health/metricAggregation.ts:219` `calculateCashflowMetrics` (:225) | DUPLICATE (wrong inputs) or DIFFERENT-QUANTITY | `surplus = income − expenses` — **omits loan repayments entirely**, contradicting D8. Either a bug to migrate (health surplus drops by ≈$12,779/mo) or a to-be-named "pre-debt-service surplus" (DR-1). Escalate — product decision |
| `lib/services/masterFinancialService.ts:1404` `buildHealthScore` (:1413-1414) | DUPLICATE | re-derives `(income − recurringExpenses − loanRepayments)` inline for the health-score savings component instead of reading `cashflow.monthlyCashflow` (inputs match, arithmetic re-typed) |
| `lib/intelligence/portfolioEngine.ts:366` | DIFFERENT-QUANTITY | consumes `calculateSimpleCashflow` with `loans: []` then adds interest-only cost — stress-test basis, deliberate (documented :360-365) |
| `lib/reports/generators/incomeExpense.ts:8` (:17-19) | DUPLICATE (wrong inputs) | `annualIncome − annualExpenses` from context rows — **omits loans** AND no one-off gate; report's "Net Annual Cashflow" disagrees with every D8-conformant surface |
| `lib/strategy/forecasting/forecastEngine.ts:182` (:217-221) | CONSUMER (of a snapshot summary) | `annualSurplus = (monthlyIncome − monthlyExpenses) × 12` from `cashflowSummary` — loan treatment depends on what populated `cashflowSummary`; NOT traced further (boundary) |
| `lib/cfo/scenarios/*.ts`, `lib/cfo/aiAdvisor.ts`, `app/api/cfo/*` | CONSUMER | read `quickMetrics.monthlyCashflow` as scenario baseline (canonical contract DR-2) |
| `app/api/dashboard/insights/route.ts:452` | CONSUMER | `monthlyRemaining = snapshot.cashflow.monthlyCashflow` (plan-basis use inside budget insight — plan basis is correct here IF labelled) |

## invariants

1. `monthlyCashflow === monthlyNetIncome − monthlyExpenses − monthlyLoanRepayments` exactly.
2. `annual* === monthly* × 12` for every pair (holds by construction; pin it).
3. `netTotal ≤ grossTotal` on the income side (the T1/D9 day-one test) — currently NOT guaranteed
   (non-salary income passes through un-netted).
4. D8: an IO loan with `minRepayment = 0` must still contribute its real interest cost —
   currently VIOLATED at `masterFinancialService.ts:1927` (dropped) and by every raw
   `minRepayment` reduce (scoreCalculator, riskRadar). Becomes enforceable only after T2.
5. Float ≡ Decimal parity to the cent (`calculateCashflow` vs `calculateCashflowDecimal`).
6. `essentialExpenses + discretionaryExpenses === monthlyExpenses`.

## independentExpectation

Arithmetic identity from FACT rows: hand-convert each declared row via the frequency table and
sum — `Σ toMonthly(income net) − Σ toMonthly(recurring expense) − Σ toMonthly(full repayment)`.
Computable without any other screen. (Golden Household fixture form: Ring 2.)

## surfaces

| route | label |
|---|---|
| `/dashboard` (Home) | KPI tile FALLBACK only, pre-insights-load (`declaredCf`, page.tsx:449-453) — via portfolio/snapshot's DUPLICATE, not the orchestrator |
| `/dashboard/cfo` + what-if levers | scenario "before/after monthly cashflow" (quickMetrics.monthlyCashflow) |
| CFO AI advisor / chat | context figures fed to the model |
| `/dashboard/reports` | "Net Annual Cashflow" (income-expense generator, loans omitted — see above) |
| health report surfaces | surplus metric via `metricAggregation` (loans omitted) |
| `/api/portfolio/snapshot` JSON | `cashflow.monthlyNetCashflow/annualNetCashflow` (hybrid) |

## expectedMoves (written before any migration)

- **D8 relabel: NO numeric movement** on any declared figure — already full-repayment.
- Fixing the `:1927` IO-loan drop (T2): `quickMetrics.monthlyCashflow` moves DOWN by the dropped
  IO interest (≈$3,709/mo at census data); `pathPrefix: quickMetrics.monthlyCashflow`,
  `cashflow.monthly*`, and every CFO scenario baseline.
- Migrating `metricAggregation` surplus to D8 basis: `health.cashflow.surplus` moves DOWN by
  monthly loan repayments (≈$12,779/mo census); dependent risk bands shift.
- Migrating scoreCalculator/riskRadar reduces onto orchestrator output: score components move
  where gross≠net income or IO loans exist (direction: cashflowStrength DOWN at census data).
- Collapsing `calculateMonthlyCashflow` onto `calculateCashflow` (DR-4): predicted NO movement
  (same math today) — strongest prediction, easiest to falsify.

## decisionsRequired

1. **DR-1** — `metricAggregation` surplus/savings omit loan repayments: bug (align to D8; health
   scores drop) or named "pre-debt-service" quantity? Reza call.
2. **DR-4** — collapse the orchestrator's internal twin Float path
   (`calculateMonthlyCashflow`/`calculateSimpleCashflow`) onto `calculateCashflow`.
3. **DR-5** — one-off gate belongs in the PRODUCER, not per-caller. Making the orchestrator gate
   `isRecurring===false` internally changes every ungated caller's number (enumerate at T3;
   precondition MON-135).
4. **DR-6** — name or converge the portfolio/snapshot + cashflow/summary HYBRID basis (declared
   income/expenses + actuals-first loan cost). Today three declared-family bases coexist:
   pure-declared (orchestrator), hybrid (snapshot/summary), raw-reduce (scores/risk).
5. **DR-9** — income-expense report "Net Annual Cashflow" omits loans: fix to D8 basis or relabel
   "Income vs Expenses (excl. debt service)".

## coverageBoundary

Same examined set as `monthly-cashflow-canonical.md` §coverageBoundary. Additionally NOT EXAMINED:
`lib/cashflow/buildCFEInput.ts` + the COE/CFE engine internals behind `app/api/cashflow/route.ts`
(:34 entry read only), `lib/strategy/analyzers/cashflowAnalyzer.ts:373`, `lib/bank/budgetComparison.ts`,
what populates `StrategyDataPacket.cashflowSummary` for the forecast engine, onboarding wizard
declared previews, and all `calc-audit` fixture engines (test infra). Unexamined ≠ cleared.

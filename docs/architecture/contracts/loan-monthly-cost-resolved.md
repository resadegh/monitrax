# loanMonthlyCostResolved

> MON-131 Phase A Quantity Contract (MON-130, Tranche 2). Prepared 2026-07-29 at HEAD `2f9f2e16`.
> The headline quantity of the loan-cost family. Sibling contracts: `loan-declared-min-repayment.md`
> (the FACT), `loan-monthly-interest.md` (the floor/deductible), `loan-required-minimum-repayment.md`
> (the amortised DIFFERENT-QUANTITY).

## classification

**DERIVED.** Never stored. Computed per loan from three FACT inputs (`Loan.minRepayment`,
`Loan.repaymentFrequency`, `Loan.principal` × `Loan.interestRateAnnual`) plus reconciled
linked repayment transactions.

## semantic

- **basis:** actuals-first. Resolution order per loan: (1) reconciled linked repayment
  transactions (cadence-normalised to monthly by `resolveMonthly`), (2) declared
  `minRepayment` cadence-normalised via `toMonthly`, (3) **interest floor** =
  `max(0, principal × interestRateAnnual) / 12`. Never silently $0 for a live loan.
- **window:** trailing 12 months for the actuals feed — `propertyActualsWindowStart()`
  (MON-035 DECISION 2), shared with every property surface. NOT FY-scoped.
- **inclusions:** the FULL repayment (principal + interest) — D8 (settled): cashflow subtracts
  the full repayment; the principal portion is *labelled* "wealth transfer, not spending",
  never excluded from the cash number.
- **exclusions:** nothing is excluded by recurrence — **`Loan` has no `isRecurring` field
  (schema-verified, design record §4 T2); the one-off gate NEVER applies to loans.**
- **units:** AUD per month, Float. `interestRateAnnual` is a **decimal fraction**
  (0.0625 = 6.25%), never a percent — the 100× trap class.
- **output shape:** `ResolvedLoanCost { monthly, monthlyInterest, usedActuals, flooredToInterest }`
  (`lib/calculations/propertyCashflow.ts:172-180`).

## canonicalHome

- **Producer:** `lib/calculations/propertyCashflow.ts:195` — `resolveLoanMonthlyCost(loan, txs)`
  (Calc-SSOT Wall B1). Verified at HEAD.
- **Canonical transaction feed (server):** `lib/services/loanCosts.ts:45` —
  `resolveLoanCostsForUser(userId, loans)`; sum convenience `lib/services/loanCosts.ts:89` —
  `totalLoanMonthlyCost`. A resolver is only as canonical as its feed (the MON-028 lesson —
  same engine, different inputs).
- **Decimal twin: NOT ESTABLISHED.** `grep resolveLoanMonthlyCostDecimal` across `lib/` returns
  nothing at HEAD. The Decimal paths that exist (`aggregateLoanRepaymentsDecimal`,
  `scoreCalculator` Decimal reducers, `cashflowOrchestrator.ts:593`) are Decimal twins of the
  **raw-minRepayment DUPLICATE arithmetic**, not of this producer. Phase B must create the
  Decimal twin or record the gap; twins migrate together (design record §7.4).

## callSites

Anchors verified at HEAD. Census signature anchors that name a nearby unrelated function are
flagged "census anchor imprecise" with the real line.

| Site | Tag | Actual arithmetic in words |
|---|---|---|
| `lib/calculations/propertyCashflow.ts:301-308` | CONSUMER | per-property loop calls the producer per loan with that loan's linked txs; emits `loanLines`; Σ lines == `monthlyLoanRepayment` by construction |
| `lib/services/loanCosts.ts:45,89` | CONSUMER (canonical feed) | batch-fetches linked repayments over the trailing-12-mo window, resolves each loan through the producer |
| `app/api/loans/route.ts:128,177` | CONSUMER | attaches `resolvedCost` per loan (census anchor `:17 lastTxDate` imprecise) |
| `app/api/cashflow/summary/route.ts:82` | CONSUMER | `totalLoanMonthlyCost` for the summary's loan line |
| `app/api/cashflow/intelligence/route.ts:141-156` | CONSUMER | `totalLoanMonthlyCost` |
| `app/api/cfo/scenarios/context/route.ts:59+` and `run/route.ts:62+` | CONSUMER | `fetchLoanViews` resolves via `resolveLoanCostsForUser` |
| `app/api/portfolio/snapshot/route.ts:688-697` | CONSUMER | `totalLoanMonthlyCost × 12` for annual repayments (census anchor `:143 calculateLinkageHealth` imprecise — linkage counting, not loan cost) |
| `app/dashboard/expenses/page.tsx:577-578,1023` | CONSUMER | `loan.resolvedCost ?? resolveLoanMonthlyCost(loan)` — client fallback calls producer with NO txs (declared→floor); acceptable degradation, documented in `loanCosts.ts` header |
| `components/loans/LoanDetailDialog.tsx` | CONSUMER | renders `resolvedCost` from `/api/loans` |
| `app/dashboard/properties/[id]/page.tsx:840-876` | CONSUMER | Recent Activity reads engine `loanLines`; the `:872` branch prints raw declared `minRepayment` **at its own cadence, labelled with that cadence** — a FACT display, not a re-derivation (census anchor `:817 RecentActivityCard` imprecise) |
| `lib/services/moneyFlowService.ts:383-389` | **DUPLICATE** | **`if (!loan.minRepayment \|\| loan.minRepayment <= 0) continue;` — skips interest-only loans ENTIRELY**, then annualises raw declared `minRepayment`. Root of Activity "Loans $106K/yr" vs canonical $12,779/mo. Verified verbatim at `:385` |
| `lib/calculations/cashflowOrchestrator.ts:217-220,368,593` | DUPLICATE (+Decimal `:593`) | sums `toMonthly(minRepayment, freq)` raw — IO loans contribute $0 |
| `lib/services/masterFinancialService.ts:1926-1934` | DUPLICATE | cashflow input **filters `l.minRepayment && l.repaymentFrequency`, dropping IO loans from cashflow entirely**, then feeds the orchestrator's raw sum |
| `lib/services/masterFinancialService.ts:1936-1946` | DUPLICATE | `debtSummary`/`debtMetrics` via `aggregateLoanRepayments` on raw `minRepayment \|\| 0` |
| `lib/calculations/loanAggregator.ts:69` (`:213` Decimal) | DUPLICATE | `totalRepayments` = Σ converter(raw `minRepayment`) — IO reads $0 (its `totalInterest` is a different quantity — see `loan-monthly-interest.md`) |
| `lib/cfo/scoreCalculator.ts:132,165,334` (Decimal `:437,470,642`) | DUPLICATE | Σ `toMonthly(minRepayment, freq)` inside cashflowStrength / debtCoverage / savingsRate |
| `lib/cfo/riskRadar.ts:202,274,310` | DUPLICATE | Σ `toMonthly(minRepayment, freq)` in shortfall / repayment-shock / DSR detectors |
| `lib/cfo/aiAdvisor.ts:386-391` | DUPLICATE | hand-rolled cadence conversion (`× 52/12`, `× 26/12`, else raw) on raw `minRepayment` — duplicates `toMonthly` AND the cost quantity |
| `lib/cfo/decisionSupport/loanDecisionSupport.ts:209,397` | DUPLICATE | via `aggregateLoanRepayments` + raw `toMonthly(minRepayment)` |
| `lib/health/buildHealthInput.ts:101-114` | DUPLICATE | own composite: IO → `principal × rate / 12`; else `Number(minRepayment)` **with NO cadence conversion**, else `monthlyInterest × 1.2` (an invented 20% uplift). Brief's ":95 is correct" is only true for the IO branch; the non-IO branches carry two defects (see wrong-inputs). **Anchor drift: brief cites `:95`; at HEAD the mapping is `:101-114`** |
| `lib/reports/contextBuilder.ts:373-392` | DUPLICATE + wrong-input | `monthlyRepayment: l.minRepayment \|\| 0` — assigns the raw amount at ANY cadence as "monthly"; IO reads $0 (census anchor `fetchLoanData` correct) |
| `app/api/portfolio/snapshot/route.ts:846` | DUPLICATE | per-loan `annualRepayment = toAnnual(raw minRepayment)` on GRDCS loan snapshots — coexists with the route's canonical `:688` total (two bases in one payload) |
| `app/api/calculate/cashflow/route.ts:100-107` | DUPLICATE (feeder) | `transformLoanData` passes raw `minRepayment` into the orchestrator; note `l.frequency ?? l.repaymentFrequency` field guess |
| `app/dashboard/properties/page.tsx:1420-1421` | DUPLICATE | `loanBudget` = Σ normalised raw `minRepayment`, feeds a page-local `cashflowBudget = income − expenses − loanBudget` (census anchor `:1281 findUrgency` imprecise) |
| `app/dashboard/properties/page.tsx:1364-1367,1677` | FACT display | "Budget" column prints declared minRepayment labelled as budget — see Decisions D-b |
| `lib/calc-audit/engines/decimal-cfo-score-risk.ts:71,88,192` | DUPLICATE-BY-DESIGN (audit mirror) | intentional Float shadows of `scoreCalculator` for fixture parity — must migrate in lockstep with `scoreCalculator`, never independently (§22.2.2) |
| `lib/testing/normalizer.ts:399,410` | DUPLICATE (test-only) | *(§7 corrected)* stores `monthlyRepayment ?? minRepayment ?? 0` into the `minRepayment` field while PRESERVING the declared frequency (`:411`) — a scenario-supplied MONTHLY figure is silently re-labelled at the declared cadence (the "calculate from frequency" comment at `:398` does nothing); a raw `minRepayment` + matching frequency passes through correctly |
| `components/onboarding/wizard/types.ts:933,940-942` | DIFFERENT-QUANTITY | annualised **declared commitment at intake** (no transactions exist yet; HECS excluded because income-contingent) — see `loan-declared-min-repayment.md`. Inherits the IO=$0 hole (census anchor `:876 frequencyToAnnual` imprecise) |
| `components/transactions/TransactionLinkDialog.tsx:1389-1404` | DIFFERENT-QUANTITY | declared `minRepayment` used as a **match heuristic** (|tx − min| < $1 or <10%) — a FACT read, not a cost (census anchor `:855 formatDate` imprecise) |
| `lib/planning/debtPlanner.ts:156,306` | DIFFERENT-QUANTITY | amortised required minimum + simulation schedule — own contract `loan-required-minimum-repayment.md` |
| `app/api/transactions/[id]/link/route.ts:51` | FALSE-POSITIVE | `learnCanonicalFromLink` is category-KB learning; the census signature matched a comment mentioning "loan repayments". No loan-cost arithmetic in this function |
| `app/api/budget-analysis/generate/route.ts:149-150` | CONSUMER *(added §7)* | `resolveLoanCostsForUser` → reduce over the resolver's outputs (source-lock-allowed); missed by the census's 32 sites |
| `app/api/ai/debt-analysis/route.ts:198` | CONSUMER *(added §7)* | `totalLoanMonthlyCost` for the AI debt-analysis context (`:506` additionally prints declared minRepayment WITH its cadence label — a FACT display) |
| `lib/cashflow/buildCFEInput.ts:115` | DUPLICATE (feeder) *(added §7)* | `monthlyRepayment: Number(l.minRepayment)` — raw declared amount labelled MONTHLY with NO cadence conversion, IO → $0, feeding the CFE forecast engine behind `/api/cashflow`. Same class as `transformLoanData` (:100-107 row) which WAS catalogued |
| `components/dashboard/DebtQualityWidget.tsx:364` | CONSUMER of the `:846` DUPLICATE *(added §7)* | `monthlyRepayment = (loan.annualRepayment ?? 0) / 12` — Home Debt Quality widget consumes the portfolio-snapshot per-loan raw-declared annualRepayment; moves when `:846` migrates (unlisted in expectedMoves/surfaces) |
| `lib/services/propertyActuals.ts:190` | CONSUMER (actuals feed) *(added §7)* | attaches `monthlyAverageActual` per loan via the SHARED `calculateMonthlyAverage` producer (same one `resolveMonthly` uses, same trailing-12-mo window) — the properties-page "Actual" column path, unlisted though its surface row was |

## invariants

1. **An interest-only loan is never $0:** `minRepayment = 0 ∧ principal > 0 ∧ rate > 0 ∧ NO
   reconciled actuals ⇒ monthly ≥ principal × rate / 12` (`flooredToInterest = true`).
   *(§7 correction: the floor fires only when `resolveMonthly` returns 0 —
   `propertyCashflow.ts:210`. A loan with `minRepayment = 0` AND actuals below interest
   yields `monthly = actuals mean < P×r/12`, legitimately.)*
2. `flooredToInterest = true ⇒ monthly == monthlyInterest` exactly.
3. **Σ per-loan rows == stated aggregate:** Σ `loanLines[].monthly` == `monthlyLoanRepayment`
   (propertyCashflow, by construction — lock with a test); Σ `resolveLoanCostsForUser` values ==
   `totalLoanMonthlyCost`.
4. Declared fallback: no actuals ∧ `minRepayment > 0` ⇒ `monthly == toMonthly(minRepayment, freq)`.
5. `monthly ≥ 0` always; `annualLoanRepayment == monthlyLoanRepayment × 12`.
6. Same loan, same window, same txs ⇒ identical number on every surface (A3 convergence).
7. Post-migration cross-surface: Money Flow "Loans" total == Σ per-entity loan rows ==
   `totalLoanMonthlyCost × 12` (annual basis).

## independentExpectation

- **Actuals path:** arithmetic identity against the bank statement — the cadence-normalised
  monthly mean of the loan's reconciled repayment transactions over the trailing-12-month
  window. Checkable from the raw `UnifiedTransaction` rows without reading any other screen.
- **Declared path:** `toMonthly(minRepayment, repaymentFrequency)` — pure frequency identity.
- **Floor path (IO):** `balance × annualRate / 12` — standard bank monthly-compounding interest.
- **Plausibility bound (P&I):** the declared/actual figure should be ≥ the IO floor and roughly
  ≈ the amortisation formula `M = P·r(1+r)^n / ((1+r)^n − 1)` — see
  `loan-required-minimum-repayment.md` for that quantity.

## surfaces

| Route | Label |
|---|---|
| `/dashboard/balances` | Debt section — per-loan repayment (via `/api/loans` `resolvedCost`) |
| `/dashboard/expenses` | loan cost rows (resolvedCost, client fallback) |
| `/dashboard/properties` | per-property loan "Budget"/"Actual" rows; portfolio cashflow strip |
| `/dashboard/properties/[id]` | hero cashflow; Recent Activity loan repayment / interest rows |
| `/dashboard/activity` | Money Flow "Loans" node (currently the DUPLICATE $106K/yr class) |
| `/dashboard/entities` | MoneyFlowSankey per-entity loan flows |
| `/portal/clients/[id]/view` | portal money flow (same duplicate) |
| `/dashboard/plan` | cashflow summary + intelligence loan line (canonical) |
| `/dashboard/cfo` | score components (cashflowStrength / debtCoverage / savingsRate), risk radar cards, scenario context |
| Home `/dashboard` | cashflow / surplus tiles fed by masterFinancialService (duplicate raw path) |
| `/dashboard/insights` + financial-health consumers | health score debt inputs (buildHealthInput duplicate) |
| Reports (contextBuilder consumers) | loan table "monthlyRepayment" column (duplicate + wrong-input) |

## expectedMoves

Golden-baseline pathPrefixes (`lib/matrix/goldenBaseline.ts` keys verified:
`lib/services/moneyFlowService.ts:getMoneyFlow` `:97`, `lib/services/loanCosts.ts:resolveLoanCostsForUser` `:103`):

- **NO movement (strongest predictions):** `lib/services/loanCosts.ts:resolveLoanCostsForUser` ·
  `lib/calculations/propertyCashflow.ts:*` · `/api/loans` `resolvedCost` ·
  `/api/cashflow/summary`+`intelligence` loan lines · `/api/cfo/scenarios/*` loan views ·
  `/api/portfolio/snapshot` `totalAnnualLoanRepayments` (`:688`) — all already read the producer.
- **`lib/services/moneyFlowService.ts:getMoneyFlow` — MOVES:** Loans totals RISE by the IO loans'
  interest (the skipped `$3,709/mo ≈ $44,508/yr` class) and by cadence-normalisation deltas;
  per-entity surplus falls by the same amount. Direction: loans ↑, surplus ↓.
- **`lib/services/masterFinancialService.ts` (cashflow, quickMetrics, debtSummary, debtMetrics)
  — MOVES:** monthly cashflow ↓ ~$3,709/mo; `debtSummary.totalRepayments` ↑ by the same;
  savings rate ↓; DSR ↑. *(§7 mechanism correction: merely REMOVING the `:1927` filter moves
  $0 for IO loans with `minRepayment = 0` — the orchestrator's raw sum yields `toMonthly(0) = 0`
  either way. The ≈$3,709/mo move materialises only when the loan feed migrates to the resolved
  producer's interest floor. Note also the filter drops a second class: loans with
  `minRepayment > 0` but NULL `repaymentFrequency`.)*
- **CFO trees (`lib/cfo/scoreCalculator.ts`, `riskRadar.ts`, `aiAdvisor.ts`,
  `loanDecisionSupport.ts`) — MOVE:** cashflowStrength / savingsRate ↓, debtCoverage DSR ↑,
  shortfall-risk severity may cross a threshold. Audit mirrors in
  `decimal-cfo-score-risk.ts` move in lockstep or the fixture fails.
- **`lib/health/buildHealthInput.ts` — MOVES only for** non-monthly-cadence loans (no-conversion
  defect fixed) and non-IO loans with `minRepayment=0` (×1.2 heuristic → floor/actuals). IO
  branch already ≈ floor: minimal movement predicted there.
- **`lib/reports/contextBuilder.ts` — MOVES:** IO rows 0 → interest; non-monthly rows raw → converted.
- **`app/api/portfolio/snapshot` per-loan `annualRepayment` (`:846`) — MOVES** to resolved basis
  (the route total at `:688` does NOT move).
- **`lib/planning/debtPlanner.ts` — NO movement:** different quantity, out of this migration.

## decisionsRequired

- **D-a (Money Flow basis).** The Sankey is otherwise declared-basis (income/expenses annualised
  from rows). Options: (1) migrate loans to the actuals-first resolved cost — loans on a
  different basis from the rest of the diagram; (2) declared-basis with interest floor only
  (fixes the IO-skip without mixing bases); (3) whole diagram to actuals-first (larger scope).
  Consequence: (1) is most truthful per-number but the diagram's columns stop reconciling to
  the declared rows beside them; (2) is internally consistent but diverges from the canonical
  $12,779/mo where actuals differ from declared. **Do not choose — Reza's call.**
- **D-b (Properties "Budget" column).** Is the loan "Budget" the declared minRepayment (a FACT
  display — keep raw, IO shows $0 *labelled as budget*) or the resolved cost? Consequence: keeping
  raw preserves budget-vs-actual semantics but shows $0 budget for IO loans that cost $3,709/mo.
- **D-c (buildHealthInput ×1.2 heuristic).** The non-IO fallback `monthlyInterest × 1.2` is an
  invented multiplier. Replace with resolved cost (recommended by architecture) or amortised
  required minimum? Changes health-score inputs either way.
- **D-d (aiAdvisor scenario feed).** Migrating `fetchLoanViews` to `resolveLoanCostsForUser`
  makes the advisor's repayment actuals-based; keeping declared is defensible for *projection*
  inputs the user adjusts. Name which quantity scenario projections consume.
- **D-e (onboarding wizard IO preview).** At intake, IO debts with `minRepayment=0` show a $0
  annual commitment. Apply the interest floor pre-persist, or accept $0 with copy?

## coverageBoundary

**Verifies:** all 32 census loanCost sites read at HEAD in source, tags + arithmetic stated from
the actual code; producer/feed semantics from `propertyCashflow.ts` + `loanCosts.ts` in full;
golden-baseline keys for moneyFlow + loanCosts confirmed present. **Does NOT verify:**
`lib/calculations/monthlyResolver.ts` internals (the actuals cadence math is trusted from its
call contract, not re-derived); what-if levers, wealthCheck, forecast engines (separate census
families `loanAmortisation`/`forecastFlows`); any live number against Reza's data (Phase A is
read-only — expectedMoves magnitudes use the design-record figures $3,709/mo · $12,779/mo ·
$106K/yr, not fresh captures); Neomatrix node reconciliation for these sites.

## Adversarial review (§7) — 2026-07-29

- **Claims checked: 46** (anchors 34 · arithmetic 9 · negative-claims 3). Every producer/feed/callSite
  anchor opened at HEAD `72b15268` (production dirs byte-identical to the contract's `2f9f2e16` —
  `git diff --stat` empty). Verbatim checks passed: `moneyFlowService.ts:385` skip-line exact;
  `masterFinancialService.ts:1927` filter exact; `propertyCashflow.ts:195,199,203-216,301-311` exact;
  `loanCosts.ts:45,89`; goldenBaseline keys `:97,:103`; $3,709×12 = $44,508 ✓. Negative claims
  independently re-run: `resolveLoanMonthlyCostDecimal` — zero hits across `lib/app/components`
  (NOT ESTABLISHED confirmed); `Loan.isRecurring` absent from schema (confirmed); `:51`
  FALSE-POSITIVE confirmed (category-KB learning only).
- **REFUTED / CORRECTED:**
  1. *callSites completeness* — original claim "all 32 census loanCost sites" ≠ all sites. An
     independent `minRepayment` sweep found five uncatalogued sites, now added inline:
     `app/api/budget-analysis/generate/route.ts:149-150` (CONSUMER), `app/api/ai/debt-analysis/route.ts:198`
     (CONSUMER), `lib/cashflow/buildCFEInput.ts:115` (DUPLICATE feeder, raw minRepayment as monthly, IO→$0),
     `components/dashboard/DebtQualityWidget.tsx:364` (consumer of the `:846` duplicate — a surface that
     MOVES with `:846` but was in neither surfaces[] nor expectedMoves), `lib/services/propertyActuals.ts:190`
     (the "Actual"-column feed). The census, not just the contract, missed them.
  2. *Invariant 1* — "IO never $0 ⇒ monthly ≥ P×r/12" corrected: guarantee holds only when NO
     reconciled actuals exist (`propertyCashflow.ts:210` floors only on `r.monthly ≤ 0`); actuals below
     interest legitimately produce monthly < floor.
  3. *normalizer.ts:399,410 arithmetic description* — corrected direction: declared frequency IS
     preserved (`:411`); the defect is a monthly figure re-labelled at declared cadence, not "declared
     treated as monthly regardless of cadence".
  4. *expectedMoves mechanism* — "IO loans stop being dropped" corrected: un-filtering `:1927` alone is
     arithmetically inert for IO `minRepayment=0` loans; the move requires floor adoption. Second
     dropped class (minRepayment>0, null frequency) added.
- **Could not verify:** the $3,709/mo · $12,779/mo · $106K/yr magnitudes (design-record figures; Ring-3
  scope, per the contract's own boundary — consistent); `monthlyResolver.ts` internals (boundary-stated);
  whether `buildCFEInput.ts:115` was intended to sit in the `forecastFlows` census family — the contract's
  boundary names "forecast engines" but not their input builders, so it is treated as an omission.
- **Verdict impact: none.** Canonical home, DUPLICATE/DIFFERENT-QUANTITY tags, and NO-movement
  predictions all survive. The coverage-boundary sentence "all 32 census loanCost sites" is now
  qualified by finding 1; the callSites table is the corrected register.

# MON-131 T2 — the INPUT-FEED census

**Stage 1 of the method** (`MON-131_COMPLETION_BRIEF.md` §3.0, step 1). Read in source 2026-08-03, at
`7285302e`. No fix code is written until this exists — FIX_PROTOCOL §3.

**Why this census and not just the producer list.** The producer census says *who computes the number*.
It does not say *what each producer is fed*, and that is where T1 was bitten: MON-140 was **one engine
with two feeds** — the banked income producer was handed a `select`-narrowed row missing `isRecurring`,
so the same correct engine returned a different answer depending on who called it. **Same engine ≠ same
inputs.** A migration that points every consumer at `resolveLoanCostsForUser` and stops there would
reproduce exactly that failure with loan costs.

---

## §1 The finding, before the detail

**Every producer issues its own Prisma `select`, and no two agree.** There is no shared loan-row
contract — each caller decides for itself which columns the cost calculation is allowed to see. The
canonical resolver can only ever be as correct as the narrowest feed that reaches it.

| Producer | Loan columns it selects | Can it compute the canonical cost? |
|---|---|---|
| `masterFinancialService.ts:702` | `id · ownerEntityId · name · principal · minRepayment · repaymentFrequency · interestRateAnnual · type · isInterestOnly · propertyId · offsetAccountId` | **Nearly** — has rate, IO flag and offset *account id*, but **no linked repayment transactions and no offset balance** |
| `moneyFlowService.ts:245` | `ownerEntityId · minRepayment · repaymentFrequency` | **No.** Three columns. No principal, no rate, no IO flag — a loan with no `minRepayment` is invisible, which is precisely why the two IO loans read $0 |
| `contextBuilder.ts:187` | `principal` only | **No.** Cannot compute a cost at all from this feed |
| `loanAggregator.ts:88,232` | takes `minRepayment`/`principal` off whatever row it is handed | **Depends entirely on its caller** — no feed of its own |
| `cashflowOrchestrator.ts` | `{ minRepayment, repaymentFrequency }` per loan leg | **No** — by construction; it is fed legs, not loans |
| `propertyCashflow.ts` | per-property loan subset | partial |
| `loanCosts.ts` (**the canonical resolver**) | fetches its own offsets + trailing-12-month linked repayments | **Yes — the only one that can** |

**`loanCosts.ts` is the only producer that fetches what the calculation actually needs.** Every other
feed is a subset, and three of them are missing columns the correct answer depends on.

---

## §2 What this means for the migration

1. **Repointing consumers is not enough.** A consumer calling `resolveLoanCostsForUser` while still
   passing its own narrow row would starve the engine — the MON-140 shape. The engine must **fetch its
   own inputs** (offsets, linked repayments), which `loanCosts.ts` already does. That is the pattern to
   preserve, not to work around.
2. **`moneyFlowService`'s three-column feed is the $3,792.92 understatement.** It selects
   `minRepayment` and nothing else, so `moneyFlowService.ts:382`'s skip drops any loan without a
   declared repayment — both interest-only loans **and** HECS. The capture measured exactly that.
3. **`contextBuilder` cannot be "migrated" in place** — it selects `principal` alone. It needs the
   resolver's output handed to it, not a wider `select`.
4. **The feed contract is already declared.** `.audit/expected-moves-t2.json` `_meta.feedContract`
   requires unrounded per-loan costs for **every** loan, no `minRepayment` filter. This census is what
   makes that requirement concrete per call site.

---

## §3 Consumer census — where the number surfaces

Recorded from the T2 contract's 13 declared paths + the capture's rendered evidence:
`cashflow.monthlyLoanRepayments` · `.monthlyCashflow` · `.monthlySurplus` · `.annualLoanRepayments` ·
`.annualCashflow` · `.annualSurplus` · `.savingsRate` · `.debtServiceRatio` ·
`debt.metrics.debtServiceRatio` · `.monthlyRepayments` · `quickMetrics.monthlyCashflow` ·
`.monthlyLoanRepayments` · `.savingsRate`.

Rendered: Home budget tile (**$8,817 today → $12,779**) and `/dashboard/expenses` (**already $12,779** —
canonical, and it must not move).

---

## §4 Status

**Stage 1 is NOT complete.** This file records the producer feeds for the seven migration targets and
the consumer set. Still outstanding before any fix code:

- the exact per-call-site list behind the census's **31** `loanCost` sites (a raw grep finds 40 *files*
  touching `minRepayment`; the census counts deriving *functions* — the migration needs the precise
  list, not either approximation);
- for each site, whether it is a **producer** to delete or a **consumer** to repoint.

Recorded now rather than held, so the next session inherits the map instead of re-deriving it (§21.2.2).

**Coverage, stated precisely:** establishes what each of seven producers is fed, read in source. It does
**not** yet enumerate all 31 sites, and it verifies no number.

---

## Appendix — the exact 31 `loanCost` sites

Produced by `node scripts/census/producers-census.mjs --list` (the census's own output, not a
re-derivation). This is the authoritative work-list for the T2 migration.

**Do not substitute a grep for this list.** A `minRepayment`-arithmetic grep over `lib/ app/
components/` returns a *different* set: it misses ten sites the census catches — `riskRadar` (×2),
`scoreCalculator` (×3), `debtPlanner` (×2) and the `calc-audit` decimal mirrors (×3) — because those
derive a loan cost without the literal `minRepayment` arithmetic the grep keys on. It also counts
matching *lines* where the census counts deriving *functions*, so the two totals are not comparable
and neither is a check on the other. Migrating from the grep would silently leave those ten behind.

| Site | Line |
|---|---|
| `app/api/calculate/cashflow/route.ts:transformLoanData` | 120 |
| `app/api/cashflow/intelligence/route.ts:calculateMonthlyLoanRepayments` | 129 |
| `app/api/cashflow/summary/route.ts:buildSummaryInput` | 33 |
| `app/api/cfo/scenarios/context/route.ts:fetchLoanViews` | 59 |
| `app/api/cfo/scenarios/run/route.ts:fetchLoanViews` | 62 |
| `app/api/loans/route.ts:lastTxDate` | 17 |
| `app/api/portfolio/snapshot/route.ts:calculateLinkageHealth` | 117 |
| `app/api/transactions/[id]/link/route.ts:learnCanonicalFromLink` | 51 |
| `app/dashboard/properties/[id]/page.tsx:RecentActivityCard` | 817 |
| `app/dashboard/properties/page.tsx:findUrgency` | 1281 |
| `components/onboarding/wizard/types.ts:frequencyToAnnual` | 876 |
| `components/transactions/TransactionLinkDialog.tsx:formatDate` | 855 |
| `lib/calc-audit/engines/decimal-cfo-score-risk.ts:calculateCashflowStrengthFloat` | 64 |
| `lib/calc-audit/engines/decimal-cfo-score-risk.ts:calculateDebtCoverageFloat` | 85 |
| `lib/calc-audit/engines/decimal-cfo-score-risk.ts:calculateSavingsRateFloat` | 184 |
| `lib/calculations/loanAggregator.ts:aggregateLoanRepayments` | 69 |
| `lib/calculations/loanAggregator.ts:aggregateLoanRepaymentsDecimal` | 213 |
| `lib/calculations/propertyCashflow.ts:resolveLoanMonthlyCost` | 206 |
| `lib/calculations/propertyCashflow.ts:txFor` | 178 |
| `lib/cfo/aiAdvisor.ts:fetchLoanViews` | 360 |
| `lib/cfo/riskRadar.ts:detectCashflowShortfallRisks` | 192 |
| `lib/cfo/riskRadar.ts:detectDebtRatioDeteriorationRisks` | 304 |
| `lib/cfo/scoreCalculator.ts:calculateCashflowStrength` | 125 |
| `lib/cfo/scoreCalculator.ts:calculateDebtCoverage` | 159 |
| `lib/cfo/scoreCalculator.ts:calculateSavingsRate` | 326 |
| `lib/planning/debtPlanner.ts:calculateMinRepaymentIO` | 156 |
| `lib/planning/debtPlanner.ts:simulateRepayments` | 306 |
| `lib/reports/contextBuilder.ts:fetchLoanData` | 373 |
| `lib/services/masterFinancialService.ts:computeMasterFinancialSnapshot` | 1762 |
| `lib/services/moneyFlowService.ts:getMoneyFlow` | 222 |
| `lib/testing/normalizer.ts:normalizeScenario` | 339 |

**Coverage, stated precisely:** this appendix enumerates every site the census counts, with its
`file:function` and declaration line. It does **not** classify each site producer-vs-consumer — that
needs each function's body read in full (a declaration-line window is not sufficient, since the
census flags a match anywhere in the body). That classification is the remaining Stage-1 step before
the migration is written.

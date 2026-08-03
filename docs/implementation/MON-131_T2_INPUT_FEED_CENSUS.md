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

| # | File | Census label | Decl | **True match line(s)** |
|---|---|---|---|---|
| 1 | `app/api/calculate/cashflow/route.ts` | `transformLoanData` | 120 | **123** |
| 2 | `app/api/cashflow/intelligence/route.ts` | `calculateMonthlyLoanRepayments` | 129 | **140** |
| 3 | `app/api/cashflow/summary/route.ts` | `buildSummaryInput` | 33 | **74** |
| 4 | `app/api/cfo/scenarios/context/route.ts` | `fetchLoanViews` | 59 | **84** |
| 5 | `app/api/cfo/scenarios/run/route.ts` | `fetchLoanViews` | 62 | **87** |
| 6 | `app/api/loans/route.ts` | `lastTxDate` ⚠️ | 17 | **126** |
| 7 | `app/api/portfolio/snapshot/route.ts` | `calculateLinkageHealth` ⚠️ | 117 | **675** |
| 8 | `app/api/transactions/[id]/link/route.ts` | `learnCanonicalFromLink` ⚠️ | 51 | **1966** |
| 9 | `app/dashboard/properties/[id]/page.tsx` | `RecentActivityCard` | 817 | **872** |
| 10 | `app/dashboard/properties/page.tsx` | `findUrgency` ⚠️ | 1281 | **1364** |
| 11 | `components/onboarding/wizard/types.ts` | `frequencyToAnnual` ⚠️ | 876 | **933** |
| 12 | `components/transactions/TransactionLinkDialog.tsx` | `formatDate` ⚠️ | 855 | **1390** |
| 13 | `lib/calc-audit/engines/decimal-cfo-score-risk.ts` | `calculateCashflowStrengthFloat` | 64 | **71** |
| 14 | `lib/calc-audit/engines/decimal-cfo-score-risk.ts` | `calculateDebtCoverageFloat` | 85 | **88** |
| 15 | `lib/calc-audit/engines/decimal-cfo-score-risk.ts` | `calculateSavingsRateFloat` | 184 | **192** |
| 16 | `lib/calculations/loanAggregator.ts` | `aggregateLoanRepayments` | 69 | **90** |
| 17 | `lib/calculations/loanAggregator.ts` | `aggregateLoanRepaymentsDecimal` | 213 | **234** |
| 18 | `lib/calculations/propertyCashflow.ts` | `resolveLoanMonthlyCost` | 206 | **218** |
| 19 | `lib/calculations/propertyCashflow.ts` | `txFor` | 178 | **184** |
| 20 | `lib/cfo/aiAdvisor.ts` | `fetchLoanViews` | 360 | **388, 390, 391** |
| 21 | `lib/cfo/riskRadar.ts` | `detectCashflowShortfallRisks` | 192 | **202** |
| 22 | `lib/cfo/riskRadar.ts` | `detectDebtRatioDeteriorationRisks` | 304 | **310** |
| 23 | `lib/cfo/scoreCalculator.ts` | `calculateCashflowStrength` | 125 | **132** |
| 24 | `lib/cfo/scoreCalculator.ts` | `calculateDebtCoverage` | 159 | **165** |
| 25 | `lib/cfo/scoreCalculator.ts` | `calculateSavingsRate` | 326 | **334** |
| 26 | `lib/planning/debtPlanner.ts` | `calculateMinRepaymentIO` ⚠️ | 156 | **161** |
| 27 | `lib/planning/debtPlanner.ts` | `simulateRepayments` | 306 | **389, 427** |
| 28 | `lib/reports/contextBuilder.ts` | `fetchLoanData` | 373 | **392** |
| 29 | `lib/services/masterFinancialService.ts` | `computeMasterFinancialSnapshot` | 1762 | **1872** |
| 30 | `lib/services/moneyFlowService.ts` | `getMoneyFlow` | 222 | **382** |
| 31 | `lib/testing/normalizer.ts` | `normalizeScenario` | 339 | **399** |

**Coverage, stated precisely:** this appendix enumerates every site the census counts, with its
`file:function` and declaration line. It does **not** classify each site producer-vs-consumer — that
needs each function's body read in full (a declaration-line window is not sufficient, since the
census flags a match anywhere in the body). That classification is the remaining Stage-1 step before
the migration is written.

### Label drift — why the work-list is the match line, not the function name

7 of the 31 labels (⚠️ above) name the **wrong function**. The census's
`functionUnits` splitter defines a body as everything from one recognised `FN_START` to the next, so
when a declaration form isn't recognised, its code is absorbed into the preceding unit and the match
is reported under that neighbour's name. Cross-checked here by brace-matching each real body: in all
7 cases the match sits *after* the labelled function closes.

Every one of the 31 matches is real code — nothing here is a false positive, and the census count is
sound. What is unreliable is the **label**. A migration that navigated by function name would find
nothing at 7 of the 31 sites and could record them as already-clean. Use the true match line.

**Coverage, stated precisely:** every site is located to an exact line, and each is confirmed to
contain the census pattern. This does **not** establish what each site *does* with the value — a
match may derive a cost, aggregate one already derived, or guard on it. That per-site read is the
remaining Stage-1 step, and it must start from these lines rather than the labels.

---

## Stage-1 classification — what each of the 31 sites actually does

Read at the true match line (above), not inferred from the function label.

### Correction to the previous commit

The prior commit stated *"every one of the 31 matches is real code — nothing here is a false
positive."* **That is wrong, and this section supersedes it.** Reading each site shows four sites
that are not loan-cost derivations at all:

| Site | Match | Why it is not a producer |
|---|---|---|
| `app/api/loans/route.ts:126` | comment text | a comment *describing* the rule ("read `resolvedCost` instead of re-deriving from raw minRepayment") |
| `lib/calculations/propertyCashflow.ts:184` | JSDoc | doc comment on the `ResolvedLoanCost` interface |
| `lib/planning/debtPlanner.ts:161` | JSDoc | `/** Validate and correct minRepayment if needed */` |
| `lib/planning/debtPlanner.ts:389` | different field | reads `minRepaymentMonthly` (already monthly), not the raw field |

The census pattern is text-based and does not exclude comments, so prose about the rule matches the
same way code implementing it does. The count of 31 is therefore an **upper bound** on producers.
I asserted otherwise before reading the sites; the correct claim was available only after reading.

### The classification

| Class | Count | Migration treatment |
|---|---|---|
| **Not a producer** — comment / doc / different field | 4 | none; exclude from the work-list |
| **Match heuristic** — compares a transaction amount to `minRepayment` to suggest a link | 2 | none; not a money number shown to the user |
| **Raw display** — renders `minRepayment` directly as a cost | 2 | read the canonical resolver (source-lock class) |
| **Input feed** — copies raw fields into a DTO handed to an engine | 8 | the starve-the-engine risk; feed must carry what the engine needs |
| **True derivation** — computes a monthly/annual cost from raw fields | 15 | migrate onto the one engine |

4 + 2 + 2 + 8 + 15 = 31.

### Direct source confirmation of the $0 mechanism

`lib/services/moneyFlowService.ts:382`:

```
if (!loan.minRepayment || loan.minRepayment <= 0) continue;
```

Loans with no `minRepayment` are **skipped outright**, so an interest-only loan or a HECS debt
contributes nothing. This is the mechanism behind the $3,792.92 understatement, read in source
rather than inferred from the totals — and it is exactly what the `_meta.feedContract` in
`.audit/expected-moves-t2.json` forbids ("every loan, no `minRepayment` filter").

**Coverage, stated precisely:** every site is classified from its own match line. This establishes
what each site *does*; it does **not** establish that the 15 derivations produce equal values today
(they demonstrably do not), nor that the 8 feeds carry sufficient inputs (the census above shows
they do not). It verifies no number.

---

## T2 scope addition — record the rate basis and the age of the actuals (VR-046 / F1c)

**Added on Reza's instruction, 2026-08-03**, from VR-046's F1c finding.

`resolveLoanMonthlyCost` is actuals-first with **no recency requirement**. A linked repayment is taken
as today's cost regardless of its age, so a repayment from an earlier rate epoch silently becomes the
canonical figure. VR-046 shows this live on Broadbeach, same loan, same day:

| Producer | Basis | Value |
|---|---|---|
| tax position | stored rate × balance (today's rate) | $1,271/mo |
| loan cost | actuals-first (repayments from the earlier epoch) | $1,191/mo |

Neither producer is wrong for its own definition — they read **different points in time**, and no
surface says so.

**This does NOT block T2.** The contract is measured on live data and will be verified on the same
live data; the 13 declared paths and the 12,779.29 after-value stand. It is a property of the
canonical resolver, not a defect in the contract.

**What T2 must add:** the migration records, alongside each resolved cost, **which basis produced it**
(charged-interest ledger / interest-only repayment / stored rate) and **the age of the actuals
consumed**. That pair is exactly the input MON-142's alert needs once MON-145 gives the rate a date.
Recording it while the 31 sites collapse onto one producer is cheap; retrofitting it afterwards means
re-opening the producer.

**Pre-declared data movement (not a regression).** If Reza imports statements at the current rate,
Broadbeach's canonical cost moves 1,191.25 → ~1,271.10 and Thornland Lot 2 2,518.34 → ~2,687.15
(+$248.66/mo combined) **with no code change**. Declaring it here so a later Ring-3 run reads it as
expected data movement rather than a T2 regression.

**Coverage, stated precisely:** this records a scope requirement and a forecast. It verifies no
number, and the forecast figures are the Matrix's arithmetic, not a source-read of the producer.

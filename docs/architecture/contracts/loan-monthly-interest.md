# loanMonthlyInterest (and annualLoanInterest)

> MON-131 Phase A Quantity Contract (MON-130 family). Prepared 2026-07-29 at HEAD `2f9f2e16`.
> The interest component: simultaneously (a) the FLOOR of the resolved cost, (b) the
> tax-deductible figure (D8: interest = expense; principal = balance-sheet movement),
> (c) the "wealth transfer" split's counterpart. Siblings: `loan-monthly-cost-resolved.md`,
> `loan-declared-min-repayment.md`, `loan-required-minimum-repayment.md`.

## classification

**DERIVED.** `max(0, principal × interestRateAnnual) / 12` per loan. Never stored.
`interestRateAnnual` is a **decimal fraction** (0.0625 = 6.25%) — the loanAggregator P0 fix
(2026-06-23) exists because a `/100` on the already-decimal rate made this 100× too low.

## semantic

- **basis:** declared FACTS only (`principal`, `interestRateAnnual`) — a simple
  monthly-compounding approximation (`P × r / 12`), NOT an amortisation-schedule interest
  figure (interest on a declining balance is the amortisation family's job).
- **window:** none — an instantaneous run-rate on the current principal.
- **inclusions/exclusions:** gross of offset in the canonical producer; **offset-netted in the
  debt planner** (`effectivePrincipal = max(0, principal − offsetBalance)`) — a genuine
  semantic fork inside "monthly interest", named below, NOT a duplicate to collapse blindly.
- **units:** AUD/month (annual = ×12).

## canonicalHome

Two coexisting producers at HEAD — **verdict: MULTIPLE, no single canonical home established.**
Phase B must pick the survivor (or name the offset-netted variant separately):

1. `lib/calculations/propertyCashflow.ts:199` — `monthlyInterest` inside `resolveLoanMonthlyCost`
   (gross of offset); exposed on `ResolvedLoanCost.monthlyInterest`; `annualLoanInterest`
   (the tax figure) on `PropertyCashflow:136`.
2. `lib/planning/debtPlanner.ts:106-110` — `calculateMonthlyInterest(principal, rate, offset)`
   (**offset-netted**; used by the IO required minimum `:157` and the simulation loop `:344,360`).

Decimal twin: `lib/calculations/loanAggregator.ts:240-242` computes the same gross arithmetic
in Decimal inside `aggregateLoanRepaymentsDecimal.totalInterest` — a Decimal twin of the
aggregate, not of the per-loan producer. **Per-loan Decimal twin: NOT ESTABLISHED.**

## callSites

| Site | Tag | Actual arithmetic in words |
|---|---|---|
| `lib/calculations/propertyCashflow.ts:199,212-213` | producer 1 | `max(0, principal × rate) / 12`; becomes the resolved cost when floored |
| `lib/calculations/loanAggregator.ts:99-101` (Float), `:240-242` (Decimal) | DUPLICATE of producer 1 (aggregate) | `principal × rate / 12` per loan, summed as `totalInterest`; ×12 for annual |
| `lib/planning/debtPlanner.ts:106-110` | DIFFERENT-QUANTITY (offset-netted) | `(principal − offset) × rate / 12` — the true carrying interest for a borrower WITH an offset; a distinct, legitimate number that needs its own name (candidate: `loanMonthlyInterestOffsetNet`) |
| `lib/planning/debtPlanner.ts:157,344,360` | CONSUMER of the offset-netted variant | IO required minimum + per-month simulation interest |
| `lib/health/buildHealthInput.ts:102` | DUPLICATE of producer 1 | `(principal × rate) / 12` re-typed locally (the health builder's own floor; brief anchor `:95` drifted → `:102`) |
| `components/dashboard/EntityCashflowSummary.tsx:693` | **DUPLICATE + UNIT DEFECT** *(added §7)* | `loan.principal × (loan.interestRate / 100) / 12` — treats the rate as a PERCENT, but its feed (`app/api/portfolio/snapshot/route.ts:852` `interestRate: loan.interestRateAnnual`) supplies the schema DECIMAL → the interest-portion estimate (and the widget's `taxBenefit = interest × 0.37`) is **100× too low at HEAD**. Live violation of invariant 2 on the Home Entity Cashflow widget |
| `lib/cfo/decisionSupport/loanDecisionSupport.ts:713` (+ `:420`; audit mirror `lib/calc-audit/engines/decimal-cfo-decision-support.ts:168`) | DUPLICATE of producer 1 *(added §7)* | `monthlyInterest = principal × (annualRate/12)` inside `calculatePayoffMonths` (never-amortises guard) and the rate-differential `/12` at `:420` — gross basis, correct decimal unit |
| `lib/cfo/aiAdvisor.ts` / scenario views | not re-derived here | rate passed through as a FACT; interest computed downstream by scenario engines (not read in this pass — see boundary) |

## invariants

1. `monthlyInterest ≥ 0`; zero only when `principal = 0` or `rate = 0`.
2. **100× guard:** for `principal=480,000`, `rate=0.0625` → `monthlyInterest = 2,500.00`
   exactly — never 25.00 (rate treated as percent) on any path, Float or Decimal.
   *(§7: currently VIOLATED at `EntityCashflowSummary.tsx:693` — see callSites row added above.)*
3. `annualLoanInterest == monthlyInterest × 12` (propertyCashflow, by construction).
4. Offset-netted variant ≤ gross variant, always; equal iff `offsetBalance ≤ 0`.
5. D8 split: `repayment − interest = principal component ≥ 0` for a P&I loan on the declared
   path (a declared repayment below interest indicates a mis-entered FACT or true negative
   amortisation — surface, never clamp silently).
6. Resolved cost ≥ monthlyInterest whenever `flooredToInterest` (equality) — links this
   contract to invariant 1-2 of the resolved-cost contract.

## independentExpectation

Standard bank monthly-compounding approximation: `interest ≈ balance × annualRate / 12`
(offset-netted: `(balance − offset) × rate / 12`), verifiable against a loan statement's
monthly interest charge line. Illustrative worked example: $480,000 × 0.0625 / 12 =
$2,500.00/mo. The design record's "$3,709/mo of real interest reads $0" for the two IO loans
is this same arithmetic on their real principals/rates (not re-derived here — Phase A is
read-only; verify at Ring 3). For exact-to-the-cent verification the daily-accrual formula
(`balance × rate/365 × days`) applies (`debtPlanner.ts:128-136` has it, disabled); the /12
approximation is the app's stated convention.

## surfaces

| Route | Label |
|---|---|
| `/dashboard/properties/[id]` | "interest (no repayment set)" activity row; tax cashflow (rent − expenses − interest) |
| `/dashboard/properties` | tax-basis property cashflow figures |
| `/dashboard/debt-planner` | interest paid per strategy, total interest saved (offset-netted variant) |
| `/dashboard/balances` | debt metrics fed by `loanAggregator.totalInterest` |
| tax position surfaces | deductible interest (negative gearing feed — separate census family) |

## expectedMoves

- **Producer 1 sites (propertyCashflow, loanAggregator.totalInterest): NO movement** — the
  arithmetic is already identical; only the HOME consolidates.
- **`lib/health/buildHealthInput.ts:102`: NO movement** — identical formula, deleted and
  re-imported (movement only via the sibling repayment defects in the resolved-cost contract).
- **`lib/planning/debtPlanner.ts`: NO movement** — the offset-netted variant is
  DIFFERENT-QUANTITY and survives under its own name.
- Any movement in an interest figure during Tranche 2 is a defect: this quantity's migration
  is pure consolidation.

## decisionsRequired

- **D-f (offset netting in the canonical floor).** Should `resolveLoanMonthlyCost`'s interest
  floor net the linked offset balance (truer carrying cost; requires feeding offset balances
  into the producer) or stay gross (current; conservative, overstates cost for offset
  holders)? Consequence: netting lowers the floor for IO loans with offsets — a real-money
  change on cashflow surfaces; gross keeps floor ≥ actual charge. Not settled in §6 —
  **Reza's call.**
- **D-g (naming).** Confirm the offset-netted variant's register name
  (`loanMonthlyInterestOffsetNet`) so Phase B deletions can cite it.

## coverageBoundary

**Verifies:** both producers + the health/aggregator duplicates read in source at HEAD;
formula identity established by inspection. **Does NOT verify:** scenario/what-if engines'
own interest math (`lib/cfo/scenarioEngine`-class files — not read; census families
`loanAmortisation`/`forecastFlows`), tax-engine deductible-interest consumers (negative
gearing family), or any live figure against a statement.

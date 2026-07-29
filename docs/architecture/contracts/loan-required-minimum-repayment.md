# loanRequiredMinimumRepayment (amortised)

> MON-131 Phase A Quantity Contract — **DIFFERENT-QUANTITY register entry** split out of the
> loanCost census family (MON-130). Prepared 2026-07-29 at HEAD `2f9f2e16`. This is the
> "what the repayment SHOULD be" number — not what the user declared (FACT), not what the
> loan actually costs (resolved). It overlaps the `loanAmortisation` census family (8 sites);
> per brief §3, MON-136-scope quantities get register-entry depth — full contract when
> MON-136 starts. Recorded here because its sites appear inside MON-130's call-site list and
> the most dangerous Phase B failure would be deleting it as a "duplicate" of loan cost.

## classification

**DERIVED.** Computed from FACTS (`principal`, `interestRateAnnual`, `termMonthsRemaining`,
`isInterestOnly`, `offsetBalance`). Never stored.

## semantic

- **P&I:** the standard amortisation minimum `M = P·r(1+r)^n / ((1+r)^n − 1)`,
  `r = annualRate/12`, `n = termMonthsRemaining`.
- **IO:** the offset-netted monthly interest `(P − offset) × r` (see
  `loan-monthly-interest.md` D-g variant).
- **Validation semantics** (`validateMinRepayment`): the declared FACT is floored against
  this quantity — IO: `max(declared, required)`; P&I: declared accepted if
  `≥ required × 0.95`, else replaced by required. The planner therefore simulates with a
  *corrected* repayment that may legitimately differ from BOTH the declared FACT and the
  resolved cost — this is the semantic that makes it a different quantity.
- **units:** AUD/month.

## canonicalHome

`lib/planning/debtPlanner.ts:143-151` (`calculateMinRepaymentPI`) · `:156-158`
(`calculateMinRepaymentIO`) · `:163-179` (`validateMinRepayment`). All verified at HEAD.
**Decimal twin: NOT ESTABLISHED** (none exists). Edge case noted honestly:
`calculateMinRepaymentPI` returns `principal` (pay off immediately) when `termMonths ≤ 0`
or `annualRate ≤ 0` — a 0%-rate loan's true minimum is `P/n`, not `P`; candidate defect for
the MON-136 contract, recorded, not fixed (read-only phase).

## callSites

| Site | Tag | Actual arithmetic in words |
|---|---|---|
| `lib/planning/debtPlanner.ts:196` (`initSimulationLoan`) | CONSUMER | seeds `minRepaymentMonthly` for the simulation |
| `lib/planning/debtPlanner.ts:306+` (`simulateRepayments`), `:376,389,427` | CONSUMER | monthly loop: interest on declining balance, principal = repayment − interest, surplus rollover; IO with no surplus flagged non-payoffable |
| `app/api/calculate/debt-plan/route.ts` | CONSUMER | thin route → planner |
| everything in `loan-monthly-cost-resolved.md` | — | none of those sites compute this quantity; no cross-contamination found at HEAD |

## invariants

1. P&I required minimum ≥ IO interest floor for any finite term; → floor as `n → ∞`.
2. Worked example (independent expectation): `P=500,000, r=0.06/12=0.005, n=360` →
   `M = 500000 × 0.005×1.005^360/(1.005^360−1) = $2,997.75/mo`.
3. Simulation identity: Σ(principal portions) over the schedule == original principal for
   every paid-off loan; interest each month == declining balance × r.
4. `validateMinRepayment` output ≥ declared × 0.95 (P&I) and ≥ IO floor (IO), always.

## independentExpectation

The closed-form amortisation formula above — checkable on any lender's repayment calculator
without reading another screen. **Cited: standard annuity formula, stated in-source at
`debtPlanner.ts:139-141`.**

## surfaces

`/dashboard/debt-planner` → per-loan minimum repayment, payoff date, months-to-payoff,
interest saved per strategy.

## expectedMoves

**NO movement in any Tranche-2 (loan cost) migration** — this quantity is untouched by it.
A debt-planner figure moving during Tranche 2 falsifies the migration.

## decisionsRequired

- **D-h (register placement):** confirm this quantity lives in the `loanAmortisation`
  family register (MON-136) with this name, so Phase B loan-cost deletions can cite it as
  the survivor it must not touch.

## coverageBoundary

**Verifies:** the three producer functions + simulation consumers read in source at HEAD.
**Does NOT verify:** the other ~5 `loanAmortisation` census sites (what-if levers, scenario
engines — MON-136 scope), the simulation's strategy logic beyond the repayment arithmetic,
or any output against a lender calculator run.

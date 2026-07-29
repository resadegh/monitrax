# loanDeclaredMinRepayment

> MON-131 Phase A Quantity Contract (MON-130 family). Prepared 2026-07-29 at HEAD `2f9f2e16`.
> The FACT the DERIVED loan-cost family reads. Siblings: `loan-monthly-cost-resolved.md`,
> `loan-monthly-interest.md`, `loan-required-minimum-repayment.md`.

## classification

**FACT.** Asserted by the user (or a document) at intake: `Loan.minRepayment` +
`Loan.repaymentFrequency`. Stored ONCE on the `Loan` row; guarded by intake dedup
(REFERENCE_NUMBERS.md FACTS table). Never derived, never overwritten by a calculation.

## semantic

- **basis:** the lender's stated minimum periodic repayment as the user declared it.
- **window:** none — a standing declaration, not a period measure.
- **inclusions:** the full periodic payment amount at its declared cadence.
- **exclusions:** nothing. **`Loan` has no `isRecurring` field (schema-verified) — the one-off
  gate never applies.** `minRepayment = 0` is a legitimate stored state for interest-only
  loans — the FACT is honest; treating it as a *cost* is the defect (that conversion belongs
  to `loanMonthlyCostResolved`).
- **units:** AUD per `repaymentFrequency` period (WEEKLY | FORTNIGHTLY | MONTHLY | … —
  UPPERCASE `RepaymentFrequency` enum; lowercase strings fall through `toAnnual`'s default
  branch unchanged, per the `loanAggregator.ts:59-68` contract note).
- **The load-bearing rule:** the raw value is only meaningful WITH its frequency. Any read that
  uses `minRepayment` as a monthly number without `toMonthly` is a wrong-input defect, not a
  different quantity.

## canonicalHome

- **Stored at:** `prisma/schema.prisma` → `Loan.minRepayment`, `Loan.repaymentFrequency`.
  Written by `components/loans/LoanFormDialog.tsx` and the onboarding wizard.
- **Decimal twin: N/A** — a stored FACT has no computing producer; Float/Decimal applies to
  the derived quantities that read it.

## callSites

Legitimate FACT reads (display / heuristic / input-feed — these survive Phase B):

| Site | Tag | Actual arithmetic in words |
|---|---|---|
| `app/dashboard/properties/[id]/page.tsx:866-874` | CONSUMER (labelled display) | prints declared amount at its OWN cadence with the cadence label, only when the engine used the declared path |
| `app/dashboard/properties/page.tsx:1364-1367,1677` | CONSUMER (labelled "Budget") | budget column = declared amount normalised; pending Decision D-b in the resolved-cost contract |
| `components/transactions/TransactionLinkDialog.tsx:1389-1404` | CONSUMER (match heuristic) | suggests a loan link when the transaction amount is within $1 or 10% of the declared repayment — a signal, not a cost |
| `components/onboarding/wizard/types.ts:933,940-942` | CONSUMER (intake preview) | annualises declared commitments pre-persist (`frequencyToAnnual`); HECS/STUDENT excluded because income-contingent (no fixed minimum). Inherits IO=$0 — Decision D-e |
| `lib/planning/debtPlanner.ts:164` | CONSUMER (input to validation) | `validateMinRepayment` reads the FACT then floors it against the amortised minimum — the output is the DIFFERENT-QUANTITY in `loan-required-minimum-repayment.md` |
| every DUPLICATE row in `loan-monthly-cost-resolved.md` | — | reads this FACT but *presents the result as the loan's cost* — those are defects of the DERIVED quantity, catalogued there, not here |

## invariants

1. `minRepayment ≥ 0` always; `null`/`0` means "no declared minimum", never "free loan".
2. The stored pair `(minRepayment, repaymentFrequency)` round-trips unchanged through every
   surface — a FACT is displayed, never recomputed.
3. Cadence identity: `toAnnual(toMonthly(x, f) …)` conversions of the same FACT agree across
   surfaces to within float tolerance.
4. Intake dedup: one loan row per real-world loan (MON-074/084 class is the FACT-side failure).

## independentExpectation

The loan statement / lender letter — the declared minimum is checkable against the source
document, not against any formula. **Plausibility cross-check (not an identity):** for P&I
loans the declared minimum should be within tolerance of the amortisation formula
`M = P·r(1+r)^n/((1+r)^n−1)`; `debtPlanner.ts:163-179` already implements exactly this check
(5% tolerance). A declared value far below the amortised minimum indicates a mis-entered FACT
(MON-001 class: wrong cadence or wrong amount at intake).

## surfaces

| Route | Label |
|---|---|
| `/dashboard/balances` | loan rows — declared repayment + frequency (via `/api/loans`) |
| `/dashboard/properties` | loan "Budget" column, `$X/frequency` + `/year` lines |
| `/dashboard/properties/[id]` | Recent Activity declared-cadence branch |
| transaction link dialog | suggested-match hint |
| onboarding wizard review step | annual commitments preview |

## expectedMoves

**NO movement anywhere.** A FACT migration moves nothing — Phase B does not touch stored
values. Any golden-baseline delta in a raw `minRepayment` display is a defect. (The IO-$0
*displays* labelled as declared/budget are correct FACT renders and must NOT be "fixed" to
show interest — that number belongs to the resolved-cost or interest quantity, relabelled per
Decisions D-b/D-e.)

## decisionsRequired

None owned here. D-b (budget column semantics) and D-e (intake IO preview) are logged in
`loan-monthly-cost-resolved.md` — they decide which *derived* quantity those surfaces show,
not the FACT itself.

**Input-trust statement (brief §6, MON-001 class):** this FACT is only as good as intake.
There is no cadence-plausibility guard on loan repayments at HEAD (the MON-093 guard covers
rent only) — a fortnightly repayment declared MONTHLY silently deflates every declared-path
derived number by ~54%. Flagged as a candidate precondition, not invented as a finding: no
concrete mis-declared loan row was verified in this read-only pass.

## coverageBoundary

**Verifies:** schema fields exist and are the ones read at every catalogued site; the
legitimate-FACT-read sites listed were read in source at HEAD. **Does NOT verify:** intake
write paths line-by-line (`LoanFormDialog`, wizard persist), the dedup guard's actual
behaviour, or any live row's correctness against a real loan statement.

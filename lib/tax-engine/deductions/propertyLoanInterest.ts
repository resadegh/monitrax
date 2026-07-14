/**
 * MON-045 — the ONE canonical source of a property loan's DEDUCTIBLE annual
 * interest (stage 1 of the negative-gearing consolidation).
 *
 * WHY THIS EXISTS. Four producers computed property loan interest / negative
 * gearing on different bases (CLAUDE.md §12.2.1 violation) — the CFO card's
 * `calculateNegativeGearingBenefit` auto-computed `Σ principal×rate` while the
 * canonical tax position never auto-derived interest at all, so the CFO benefit
 * ($157,746) exceeded total deductions ($39,554) — mathematically impossible.
 * This helper is the single, verified interest figure the canonical tax engine
 * will deduct (stage 2 wires it into `calculateTaxPosition.deductions.property`).
 *
 * REFORM-INDEPENDENT (design refinement, 2026-07-14). The Phase-41E Measure-1
 * reform ("negative gearing → new builds only") does NOT change whether interest
 * is deductible — interest is always a rental expense against the property's own
 * income. What the reform restricts is whether a resulting rental LOSS offsets
 * OTHER income (quarantining) — that is the job of `applyNegativeGearing`, a
 * SEPARATE step (stage 2). So this helper takes no regime and applies no reform
 * gate.
 *
 * CORRECTNESS (CLAUDE.md §19.2):
 *  - ACTUALS-FIRST (§19.1): when the loan's ledger has real `INTEREST_CHARGED`
 *    rows for the FY, that sum IS the interest incurred (it already reflects any
 *    offset, redraw, rate changes). Deductible = actual × deductibleFraction.
 *  - THEORETICAL fallback (no ledger): interest accrues on the balance NET of the
 *    offset account, at the annual rate. Deductible =
 *    max(0, principal − offsetBalance) × interestRateAnnual × deductibleFraction.
 *  - `deductibleFraction` (Loan schema, ATO TR 2000/2 mixed-purpose apportionment,
 *    default 1.0) scales BOTH branches — only the income-producing portion of a
 *    mixed-purpose loan's interest is claimable.
 *  - `interestRateAnnual` is a DECIMAL (0.0649 = 6.49%), NOT a percent
 *    (Loan.interestRateAnnual convention — a wrong assumption here is a 100× bug).
 *
 * WORKED EXAMPLES (§19.2):
 *  1. Thornland Lot 1: principal 947076, rate 0.0649, no offset, fraction 1.0, no
 *     ledger → theoretical = 947076 × 0.0649 = 61,465.23.
 *  2. With a 100,000 offset → (947076 − 100000) × 0.0649 = 54,975.23.
 *  3. deductibleFraction 0.5 on example 1 → 61,465.23 × 0.5 = 30,732.62.
 *  4. Actuals present: INTEREST_CHARGED sum 60,000, fraction 1.0 → 60,000
 *     (basis 'actual'; the offset/rate are already baked into the charged amount).
 */

export interface DeductiblePropertyLoanInterestInput {
  /** Current loan balance (Loan.principal). */
  principal: number;
  /** Annual interest rate as a DECIMAL, e.g. 0.0649 (Loan.interestRateAnnual). */
  interestRateAnnual: number;
  /** Balance in the linked offset account (reduces the interest-bearing balance).
   *  Omit / null / 0 when there is no offset. */
  offsetBalance?: number | null;
  /** ATO TR 2000/2 deductible fraction (Loan.deductibleFraction, default 1.0). */
  deductibleFraction?: number | null;
  /** Σ of the loan's INTEREST_CHARGED ledger rows for the FY, if available.
   *  When a finite non-negative number, it is the actuals-first source. */
  actualInterestCharged?: number | null;
}

export interface DeductiblePropertyLoanInterestResult {
  /** The deductible annual interest for this loan (never negative). */
  deductibleInterest: number;
  /** Which branch produced it — 'actual' (ledger) or 'theoretical' (computed). */
  basis: 'actual' | 'theoretical';
}

/** Clamp the deductible fraction to a sane [0, 1]; default 1.0 (fully deductible). */
function resolveFraction(f: number | null | undefined): number {
  if (f == null || !Number.isFinite(f)) return 1;
  return Math.min(1, Math.max(0, f));
}

export function deductiblePropertyLoanInterest(
  input: DeductiblePropertyLoanInterestInput,
): DeductiblePropertyLoanInterestResult {
  const fraction = resolveFraction(input.deductibleFraction);

  // ACTUALS-FIRST (§19.1): a real charged-interest total already reflects offset,
  // redraw and rate movements — apply only the deductible fraction.
  const actual = input.actualInterestCharged;
  if (actual != null && Number.isFinite(actual) && actual >= 0) {
    return { deductibleInterest: actual * fraction, basis: 'actual' };
  }

  // THEORETICAL fallback: interest accrues on the balance net of the offset.
  const principal = Number.isFinite(input.principal) ? input.principal : 0;
  const rate = Number.isFinite(input.interestRateAnnual) ? input.interestRateAnnual : 0;
  const offset = Number.isFinite(input.offsetBalance ?? 0) ? (input.offsetBalance ?? 0) : 0;
  const interestBearing = Math.max(0, principal - offset);
  const theoretical = Math.max(0, interestBearing * rate);
  return { deductibleInterest: theoretical * fraction, basis: 'theoretical' };
}

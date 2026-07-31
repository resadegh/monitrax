/**
 * MON-142 — THE effective-loan-rate resolver. ONE producer for the question
 * "what interest rate is this loan actually at?" (CLAUDE.md §12.2.1).
 *
 * WHY THIS EXISTS. `Loan.interestRateAnnual` is a typed, user-maintained
 * field with no staleness signal. On Reza's account (2026-07-31) it read
 * 6.690% on both Bankwest interest-only loans while the repayments actually
 * in the data implied ~6.268%:
 *
 *     1191 × 12 ÷ 228,000 = 6.268%      stored 6.690%
 *     2518 × 12 ÷ 482,000 = 6.269%      stored 6.690%
 *
 * The SAME implied rate from two different balances — which a per-loan data
 * error cannot produce, but one lender changing one rate can. Reza confirmed
 * rates moved and that he does not recall updating them here. Nothing in the
 * app said so, and the stale rate reaches real money: the deductible-interest
 * THEORETICAL fallback (propertyLoanInterest.ts:85) and the loan-cost
 * interest floor (propertyCashflow.ts:199) both multiply by it.
 *
 * THE RULE — evidence beats a typed input, and divergence is SURFACED, never
 * silently resolved. This is D17's FACT hierarchy applied to a rate:
 *
 *   1. DERIVED_CHARGED    — Σ INTEREST_CHARGED from the loan's own Phase 51
 *                           ledger. The bank's own number: the strongest
 *                           evidence there is.
 *   2. DERIVED_IO_REPAYMENT — interest-only loans only. An IO repayment IS
 *                           the interest, so the repayment run-rate is
 *                           evidence of the rate. NOT valid for P&I, where a
 *                           repayment mixes principal in and would imply a
 *                           wildly overstated rate.
 *   3. STORED             — no evidence. The typed value stands, flagged
 *                           RATE_UNVERIFIED so "we don't know" is visible
 *                           rather than mistaken for "we checked".
 *
 * The stored value is NEVER overwritten here — this engine reports. Fixing
 * the stored rate is the user's action, which is why RATE_STALE exists.
 *
 * D21: interest accrues on the balance NET of the offset, so the implied
 * rate divides by (principal − offset). Dividing by the gross balance would
 * understate the rate on any offset loan — Guildford's offset is 80% of its
 * balance, which would imply a 5× error.
 *
 * PURE: no DB, no fetch (CLAUDE.md §6.4). Float + Decimal co-located.
 *
 * COVERAGE, stated precisely (§22.2.4): this resolves the rate and reports
 * divergence. It does NOT write anything, does NOT change any rendered
 * number (nothing consumes it yet — wiring is a separate, number-moving PR
 * with its own expectedMoves + Ring 3), and does NOT tell you WHICH value is
 * right when they diverge — only that they do, and what the evidence says.
 */

import { Decimal, toDecimal } from '@/lib/decimal';

/**
 * Divergence beyond this many percentage points marks the stored rate STALE.
 *
 * 0.10pp: lenders move variable rates in 0.25pp steps (the RBA cash-rate
 * increment), so a real change always clears this comfortably. Below it sit
 * the artefacts we must NOT cry wolf on — partial first/last periods, a fee
 * bundled into one repayment, day-count rounding. Observed divergence on the
 * originating defect was 0.422pp, i.e. 4× the threshold.
 */
export const RATE_STALE_THRESHOLD_PP = 0.10;

export type EffectiveRateBasis = 'DERIVED_CHARGED' | 'DERIVED_IO_REPAYMENT' | 'STORED';

export type EffectiveRateFlag =
  /** Evidence disagrees with the stored rate by more than the threshold. */
  | 'RATE_STALE'
  /** No evidence available — the stored rate is unconfirmed, not confirmed. */
  | 'RATE_UNVERIFIED'
  /** Interest-bearing balance is zero/negative (fully offset) — no rate derivable. */
  | 'NO_INTEREST_BEARING_BALANCE';

export interface EffectiveLoanRateInput {
  /** Loan.principal — the current balance. */
  principal: number;
  /** Loan.interestRateAnnual — a DECIMAL (0.0669 = 6.69%), never a percent. */
  storedRateAnnual: number;
  /** Balance in the linked offset account; reduces the interest-bearing balance (D21). */
  offsetBalance?: number | null;
  /** Loan.isInterestOnly — gates the IO-repayment evidence path. */
  isInterestOnly?: boolean | null;
  /**
   * Σ of the loan's INTEREST_CHARGED ledger rows, ANNUALISED. The bank's own
   * figure — strongest evidence. Null/undefined when the ledger has none.
   */
  chargedInterestAnnual?: number | null;
  /**
   * The loan's resolved monthly repayment run-rate, from the canonical
   * loan-cost producer. Used as evidence ONLY when isInterestOnly is true.
   */
  resolvedMonthlyRepayment?: number | null;
}

export interface EffectiveLoanRate {
  /** The best-evidence annual rate, as a DECIMAL. */
  annualRate: number;
  basis: EffectiveRateBasis;
  /** What the loan record claims, for comparison. */
  storedRateAnnual: number;
  /** What the evidence implies; null when there is none. */
  impliedRateAnnual: number | null;
  /** implied − stored, in PERCENTAGE POINTS (0.422 = 0.422pp). Null with no evidence. */
  divergencePp: number | null;
  flags: EffectiveRateFlag[];
  /** principal − offset, floored at 0 (D21). */
  interestBearingBalance: number;
}

const fin = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * Resolve a loan's effective annual rate from the best available evidence.
 *
 * WORKED EXAMPLES (§19.2):
 *  1. Broadbeach IO, principal 228000, stored 0.0669, no offset, resolved
 *     monthly repayment 1191 → implied = 1191 × 12 / 228000 = 0.0626842…
 *     → divergence = (0.0626842 − 0.0669) × 100 = −0.4216pp → RATE_STALE,
 *     basis DERIVED_IO_REPAYMENT.
 *  2. Same loan with a charged-interest ledger summing 14,292/yr → implied =
 *     14292 / 228000 = 0.0626842…; basis DERIVED_CHARGED (the ledger wins
 *     over the repayment inference even though both are available).
 *  3. Guildford P&I, principal 377822, offset 303890, stored 0.0624, no
 *     ledger → interest-bearing = 73,932; the repayment is NOT evidence
 *     (P&I mixes principal), so basis STORED + RATE_UNVERIFIED.
 *  4. Fully offset (principal 100000, offset 100000) → interest-bearing 0 →
 *     basis STORED + NO_INTEREST_BEARING_BALANCE (no division by zero).
 */
export function resolveEffectiveLoanRate(
  input: EffectiveLoanRateInput,
): EffectiveLoanRate {
  const principal = Math.max(0, fin(input.principal));
  const stored = fin(input.storedRateAnnual);
  const offset = Math.max(0, fin(input.offsetBalance));
  const interestBearingBalance = Math.max(0, principal - offset);

  const base: Omit<EffectiveLoanRate, 'annualRate' | 'basis' | 'impliedRateAnnual' | 'divergencePp' | 'flags'> = {
    storedRateAnnual: stored,
    interestBearingBalance,
  };

  // No interest-bearing balance → nothing to divide by. Never NaN/Infinity.
  if (interestBearingBalance <= 0) {
    return {
      ...base,
      annualRate: stored,
      basis: 'STORED',
      impliedRateAnnual: null,
      divergencePp: null,
      flags: ['NO_INTEREST_BEARING_BALANCE', 'RATE_UNVERIFIED'],
    };
  }

  // 1. The bank's own charged interest — strongest evidence.
  const charged = input.chargedInterestAnnual;
  if (typeof charged === 'number' && Number.isFinite(charged) && charged > 0) {
    return finish(base, stored, charged / interestBearingBalance, 'DERIVED_CHARGED');
  }

  // 2. Interest-only repayments ARE interest. Never applied to P&I.
  const repay = input.resolvedMonthlyRepayment;
  if (
    input.isInterestOnly === true &&
    typeof repay === 'number' &&
    Number.isFinite(repay) &&
    repay > 0
  ) {
    return finish(base, stored, (repay * 12) / interestBearingBalance, 'DERIVED_IO_REPAYMENT');
  }

  // 3. No evidence — the typed value stands, and says so.
  return {
    ...base,
    annualRate: stored,
    basis: 'STORED',
    impliedRateAnnual: null,
    divergencePp: null,
    flags: ['RATE_UNVERIFIED'],
  };
}

function finish(
  base: Pick<EffectiveLoanRate, 'storedRateAnnual' | 'interestBearingBalance'>,
  stored: number,
  implied: number,
  basis: EffectiveRateBasis,
): EffectiveLoanRate {
  const divergencePp = (implied - stored) * 100;
  const flags: EffectiveRateFlag[] = [];
  if (Math.abs(divergencePp) > RATE_STALE_THRESHOLD_PP) flags.push('RATE_STALE');
  return {
    ...base,
    annualRate: implied,
    basis,
    impliedRateAnnual: implied,
    divergencePp,
    flags,
  };
}

// ── Decimal twin ────────────────────────────────────────────────────────────

export interface EffectiveLoanRateDecimal {
  annualRate: Decimal;
  basis: EffectiveRateBasis;
  storedRateAnnual: Decimal;
  impliedRateAnnual: Decimal | null;
  divergencePp: Decimal | null;
  flags: EffectiveRateFlag[];
  interestBearingBalance: Decimal;
}

/**
 * Decimal twin — same decision tree, exact arithmetic. Basis and flags MUST
 * agree with the Float engine on every input (parity is fixtured).
 */
export function resolveEffectiveLoanRateDecimal(
  input: EffectiveLoanRateInput,
): EffectiveLoanRateDecimal {
  const ZERO = new Decimal(0);
  const principal = Decimal.max(ZERO, toDecimal(fin(input.principal)) ?? ZERO);
  const stored = toDecimal(fin(input.storedRateAnnual)) ?? ZERO;
  const offset = Decimal.max(ZERO, toDecimal(fin(input.offsetBalance)) ?? ZERO);
  const interestBearingBalance = Decimal.max(ZERO, principal.minus(offset));

  const unverified = (extra: EffectiveRateFlag[] = []): EffectiveLoanRateDecimal => ({
    annualRate: stored,
    basis: 'STORED',
    storedRateAnnual: stored,
    impliedRateAnnual: null,
    divergencePp: null,
    flags: [...extra, 'RATE_UNVERIFIED'],
    interestBearingBalance,
  });

  if (interestBearingBalance.lte(ZERO)) return unverified(['NO_INTEREST_BEARING_BALANCE']);

  const settle = (implied: Decimal, basis: EffectiveRateBasis): EffectiveLoanRateDecimal => {
    const divergencePp = implied.minus(stored).times(100);
    const flags: EffectiveRateFlag[] = [];
    if (divergencePp.abs().gt(RATE_STALE_THRESHOLD_PP)) flags.push('RATE_STALE');
    return {
      annualRate: implied,
      basis,
      storedRateAnnual: stored,
      impliedRateAnnual: implied,
      divergencePp,
      flags,
      interestBearingBalance,
    };
  };

  const charged = input.chargedInterestAnnual;
  if (typeof charged === 'number' && Number.isFinite(charged) && charged > 0) {
    return settle((toDecimal(charged) ?? ZERO).div(interestBearingBalance), 'DERIVED_CHARGED');
  }

  const repay = input.resolvedMonthlyRepayment;
  if (
    input.isInterestOnly === true &&
    typeof repay === 'number' &&
    Number.isFinite(repay) &&
    repay > 0
  ) {
    return settle(
      (toDecimal(repay) ?? ZERO).times(12).div(interestBearingBalance),
      'DERIVED_IO_REPAYMENT',
    );
  }

  return unverified();
}

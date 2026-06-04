import { Frequency, RepaymentFrequency } from '@/lib/types/prisma-enums';
import { Decimal, toDecimal } from '@/lib/decimal';

/**
 * Convert frequency-based amounts to annual equivalent
 */
export function toAnnual(amount: number, frequency: Frequency | RepaymentFrequency): number {
  switch (frequency) {
    case 'WEEKLY':
      return amount * 52;
    case 'FORTNIGHTLY':
      return amount * 26;
    case 'MONTHLY':
      return amount * 12;
    case 'QUARTERLY':
      return amount * 4;
    case 'ANNUAL':
      return amount;
    default:
      return amount;
  }
}

/**
 * Convert frequency-based amounts to monthly equivalent
 */
export function toMonthly(amount: number, frequency: Frequency | RepaymentFrequency): number {
  return toAnnual(amount, frequency) / 12;
}

/**
 * Convert frequency-based amounts to fortnightly equivalent
 */
export function toFortnightly(amount: number, frequency: Frequency | RepaymentFrequency): number {
  return toAnnual(amount, frequency) / 26;
}

/**
 * Convert frequency-based amounts to weekly equivalent
 */
export function toWeekly(amount: number, frequency: Frequency | RepaymentFrequency): number {
  return toAnnual(amount, frequency) / 52;
}

/**
 * Get periods per year for a given frequency
 */
export function periodsPerYear(frequency: Frequency | RepaymentFrequency): number {
  switch (frequency) {
    case 'WEEKLY':
      return 52;
    case 'FORTNIGHTLY':
      return 26;
    case 'MONTHLY':
      return 12;
    case 'QUARTERLY':
      return 4;
    case 'ANNUAL':
      return 1;
    default:
      return 12;
  }
}

// =============================================================================
// Q-DEC PR 2.B — Decimal-aware frequency converters
// =============================================================================
//
// SSOT (CLAUDE.md §12.2): every engine that previously called
// `toMonthly` / `toAnnual` for Decimal-side arithmetic must call the
// `*Decimal` variants below. The plain-`number` functions above stay
// live for back-compat (PR 3 removes them).

/**
 * Convert a frequency-based amount to annual equivalent, in Decimal.
 *
 * Accepts `number | string | Decimal | null | undefined`. Null/undefined
 * inputs return `Decimal(0)` — matches the Float path's `Number(x || 0)`
 * convention.
 */
export function toAnnualDecimal(
  amount: number | string | Decimal | null | undefined,
  frequency: Frequency | RepaymentFrequency,
): Decimal {
  const dec = toDecimal(amount);
  if (dec === null) return new Decimal(0);
  switch (frequency) {
    case 'WEEKLY':
      return dec.times(52);
    case 'FORTNIGHTLY':
      return dec.times(26);
    case 'MONTHLY':
      return dec.times(12);
    case 'QUARTERLY':
      return dec.times(4);
    case 'ANNUAL':
      return dec;
    default:
      return dec;
  }
}

/**
 * Convert a frequency-based amount to monthly equivalent, in Decimal.
 * `toAnnualDecimal(...) / 12`.
 */
export function toMonthlyDecimal(
  amount: number | string | Decimal | null | undefined,
  frequency: Frequency | RepaymentFrequency,
): Decimal {
  return toAnnualDecimal(amount, frequency).div(12);
}

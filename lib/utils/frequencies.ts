import { Frequency, RepaymentFrequency } from '@/lib/types/prisma-enums';

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

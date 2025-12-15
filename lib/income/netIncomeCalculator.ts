/**
 * Single source of truth for net income calculations
 * Used by both income page and dashboard to ensure consistency
 *
 * Logic:
 * - GROSS salary: use stored netAmount (calculated by tax engine when saved)
 * - NET salary / other income: convert entered amount to monthly using simple multipliers
 */

import { calculateTakeHomePay } from '@/lib/cashflow/incomeNormalizer';

// Simple monthly multipliers (not annual average)
// Weekly × 4 = Monthly, Fortnightly × 2 = Monthly
const MONTHLY_MULTIPLIERS: Record<string, number> = {
  WEEKLY: 4,
  FORTNIGHTLY: 2,
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  ANNUAL: 1 / 12,
  ANNUALLY: 1 / 12,
};

/**
 * Convert an amount to monthly based on frequency
 */
export function toMonthly(amount: number, frequency: string): number {
  const multiplier = MONTHLY_MULTIPLIERS[frequency] ?? 1;
  return amount * multiplier;
}

/**
 * Convert an amount to annual based on frequency
 */
export function toAnnual(amount: number, frequency: string): number {
  return toMonthly(amount, frequency) * 12;
}

/**
 * Income item interface - minimal fields needed for calculation
 */
export interface IncomeForCalculation {
  amount: number;
  frequency: string;
  type: string;
  salaryType?: string | null;
  netAmount?: number | null;
}

/**
 * Get the effective net monthly income for an income item.
 *
 * Logic:
 * - GROSS salary with stored netAmount: use netAmount / 12
 * - GROSS salary without netAmount: calculate tax using tax engine
 * - NET salary / other income: just convert to monthly (already net)
 */
export function getNetMonthlyIncome(item: IncomeForCalculation): number {
  if (item.type === 'SALARY' && item.salaryType === 'GROSS') {
    // GROSS salary: use pre-calculated netAmount if available
    if (item.netAmount != null) {
      return item.netAmount / 12;
    }
    // Fallback: calculate tax using tax engine
    const frequency = item.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
    const takeHome = calculateTakeHomePay(item.amount, frequency);
    return toMonthly(takeHome.netAmount, item.frequency);
  }

  // NET salary or other income: amount is already net, just convert to monthly
  return toMonthly(item.amount, item.frequency);
}

/**
 * Get the effective net annual income for an income item.
 */
export function getNetAnnualIncome(item: IncomeForCalculation): number {
  return getNetMonthlyIncome(item) * 12;
}

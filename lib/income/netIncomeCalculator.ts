/**
 * Single source of truth for net income calculations
 * Used by both income page and dashboard to ensure consistency
 */

import { calculateTakeHomePay } from '@/lib/cashflow/incomeNormalizer';

// Frequency multipliers for annual conversion
const ANNUAL_MULTIPLIERS: Record<string, number> = {
  WEEKLY: 52,
  FORTNIGHTLY: 26,
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUAL: 1,
  ANNUALLY: 1,
};

/**
 * Convert an amount to annual based on frequency
 */
export function toAnnual(amount: number, frequency: string): number {
  const multiplier = ANNUAL_MULTIPLIERS[frequency] ?? 12; // Default to monthly
  return amount * multiplier;
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
 * Calculate the effective net annual income for an income item.
 *
 * This is the SINGLE SOURCE OF TRUTH for net income calculations.
 * Both the income page and dashboard must use this function.
 *
 * Logic:
 * - SALARY with NET type: amount is already net, just annualize
 * - SALARY with GROSS type: use stored netAmount, or calculate tax if missing
 * - Other income types: use gross amount (tax calculated at year end)
 */
export function getNetAnnualIncome(item: IncomeForCalculation): number {
  if (item.type === 'SALARY') {
    // NET salary: the entered amount IS the net amount
    if (item.salaryType === 'NET') {
      if (item.netAmount != null) {
        return item.netAmount;
      }
      // Amount is already net, just annualize it
      return toAnnual(item.amount, item.frequency);
    }

    // GROSS salary: use pre-calculated netAmount if available
    if (item.salaryType === 'GROSS' && item.netAmount != null) {
      return item.netAmount;
    }

    // Fallback for legacy data: calculate PAYG tax
    const frequency = item.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
    const takeHome = calculateTakeHomePay(item.amount, frequency);
    return toAnnual(takeHome.netAmount, item.frequency);
  }

  // Non-salary income: use gross amount (tax calculated at year end)
  return toAnnual(item.amount, item.frequency);
}

/**
 * Calculate the effective net monthly income for an income item.
 */
export function getNetMonthlyIncome(item: IncomeForCalculation): number {
  return getNetAnnualIncome(item) / 12;
}

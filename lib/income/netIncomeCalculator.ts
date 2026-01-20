/**
 * Single source of truth for net income calculations
 * Used by both income page and dashboard to ensure consistency
 *
 * Logic:
 * - GROSS salary: use stored netAmount (calculated by tax engine when saved)
 * - NET salary / other income: convert entered amount to monthly using centralized utilities
 *
 * IMPORTANT: Uses lib/utils/frequencies.ts for all frequency conversions.
 * This ensures Weekly × 52/12 = 4.33 (not Weekly × 4) for accurate calculations.
 *
 * Blueprint §5.1: Never Duplicate Logic - delegates to centralized frequency utilities
 */

import { calculateTakeHomePay } from '@/lib/cashflow/incomeNormalizer';
import { toMonthly as centralizedToMonthly, toAnnual as centralizedToAnnual } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

/**
 * Convert an amount to monthly based on frequency
 * Wrapper around centralized utility for backward compatibility
 */
export function toMonthly(amount: number, frequency: string): number {
  return centralizedToMonthly(amount, frequency as Frequency);
}

/**
 * Convert an amount to annual based on frequency
 * Wrapper around centralized utility for backward compatibility
 */
export function toAnnual(amount: number, frequency: string): number {
  return centralizedToAnnual(amount, frequency as Frequency);
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

/**
 * Single source of truth for net income calculations
 * Used by both income page and dashboard to ensure consistency
 *
 * IMPORTANT: This does NOT calculate taxes. It simply uses stored values.
 * - If netAmount is stored, use it
 * - Otherwise, use the entered amount as-is
 */

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
 * Get the effective net annual income for an income item.
 *
 * Simple logic - NO tax calculations here:
 * - SALARY with GROSS type AND stored netAmount: use netAmount
 * - Everything else: just annualize the entered amount
 */
export function getNetAnnualIncome(item: IncomeForCalculation): number {
  // For GROSS salary with pre-calculated netAmount, use it
  if (item.type === 'SALARY' && item.salaryType === 'GROSS' && item.netAmount != null) {
    return item.netAmount;
  }

  // For everything else (NET salary, other income types, or missing netAmount):
  // Just annualize the entered amount - it's already the value to display
  return toAnnual(item.amount, item.frequency);
}

/**
 * Get the effective net monthly income for an income item.
 */
export function getNetMonthlyIncome(item: IncomeForCalculation): number {
  return getNetAnnualIncome(item) / 12;
}

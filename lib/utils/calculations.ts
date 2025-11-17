/**
 * Calculate Loan to Value Ratio (LVR)
 * @param loanBalance Total loan balance
 * @param propertyValue Current property value
 * @returns LVR as percentage (0-100)
 */
export function calculateLVR(loanBalance: number, propertyValue: number): number {
  if (propertyValue === 0) return 0;
  return (loanBalance / propertyValue) * 100;
}

/**
 * Calculate property equity
 * @param propertyValue Current property value
 * @param loanBalance Total loan balance
 * @returns Equity amount
 */
export function calculateEquity(propertyValue: number, loanBalance: number): number {
  return Math.max(0, propertyValue - loanBalance);
}

/**
 * Calculate rental yield (annual)
 * @param annualRent Annual rental income
 * @param propertyValue Current property value
 * @returns Yield as percentage
 */
export function calculateRentalYield(annualRent: number, propertyValue: number): number {
  if (propertyValue === 0) return 0;
  return (annualRent / propertyValue) * 100;
}

/**
 * Calculate effective principal for interest calculation
 * Accounts for offset balance reducing the interest-bearing amount
 * @param principal Loan principal
 * @param offsetBalance Offset account balance
 * @returns Effective principal for interest calculation
 */
export function calculateEffectivePrincipal(principal: number, offsetBalance: number): number {
  return Math.max(0, principal - offsetBalance);
}

/**
 * Calculate interest for a period
 * @param principal Principal amount
 * @param annualRate Annual interest rate (e.g., 0.0625 for 6.25%)
 * @param periodsPerYear Number of periods per year (12 for monthly, 26 for fortnightly, etc.)
 * @returns Interest amount for the period
 */
export function calculateInterestForPeriod(
  principal: number,
  annualRate: number,
  periodsPerYear: number
): number {
  const periodicRate = annualRate / periodsPerYear;
  return principal * periodicRate;
}

/**
 * Calculate monthly principal and interest repayment
 * @param principal Loan principal
 * @param annualRate Annual interest rate
 * @param termMonths Total loan term in months
 * @returns Monthly P&I repayment
 */
export function calculatePIRepayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (termMonths === 0 || annualRate === 0) return principal / Math.max(1, termMonths);

  const monthlyRate = annualRate / 12;
  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths);
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;

  return numerator / denominator;
}

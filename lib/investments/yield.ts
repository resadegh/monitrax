/**
 * Monitrax Investment Yield Engine
 * Phase 4 - Dividend & Distribution Analytics
 *
 * Pure functions for Australian dividend and distribution calculations.
 * Includes franking credit calculations per ATO rules.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface DividendPayment {
  date: Date;
  grossAmount: number;
  frankingPercent: number; // 0-100
  ticker?: string;
}

export interface DividendAnalytics {
  totalDividends: number;
  totalFrankingCredits: number;
  grossedUpDividends: number;
  averageFrankingPercent: number;
  dividendYield: number;
  grossedUpYield: number;
}

export interface YieldMetrics {
  currentYield: number;
  trailingTwelveMonthYield: number;
  forwardYield: number;
  grossedUpYield: number;
  frankingCreditValue: number;
}

export interface DistributionBreakdown {
  income: number;
  capitalGain: number;
  capitalGainDiscounted: number;
  foreignIncome: number;
  taxDeferred: number;
  taxFree: number;
}

// =============================================================================
// AUSTRALIAN TAX CONSTANTS
// =============================================================================

// Corporate tax rate for franking credit calculations
export const AU_CORPORATE_TAX_RATE = 0.30;
export const AU_CORPORATE_TAX_RATE_SMALL = 0.25;

// =============================================================================
// FRANKING CREDIT CALCULATIONS
// =============================================================================

/**
 * Calculate franking credit from a dividend payment.
 * Formula: Credit = Dividend × (Franking% / 100) × (Tax Rate / (1 - Tax Rate))
 *
 * @param dividendAmount - Cash dividend received
 * @param frankingPercent - Percentage franked (0-100)
 * @param corporateTaxRate - Corporate tax rate (default 30%)
 * @returns Franking credit amount
 */
export function calculateFrankingCredit(
  dividendAmount: number,
  frankingPercent: number,
  corporateTaxRate: number = AU_CORPORATE_TAX_RATE
): number {
  if (dividendAmount <= 0 || frankingPercent <= 0) return 0;

  const frankingRatio = Math.min(frankingPercent, 100) / 100;
  const frankedAmount = dividendAmount * frankingRatio;
  const creditMultiplier = corporateTaxRate / (1 - corporateTaxRate);

  return frankedAmount * creditMultiplier;
}

/**
 * Calculate grossed-up dividend (dividend + franking credit).
 *
 * @param dividendAmount - Cash dividend received
 * @param frankingPercent - Percentage franked (0-100)
 * @param corporateTaxRate - Corporate tax rate
 * @returns Grossed-up dividend amount
 */
export function calculateGrossedUpDividend(
  dividendAmount: number,
  frankingPercent: number,
  corporateTaxRate: number = AU_CORPORATE_TAX_RATE
): number {
  const frankingCredit = calculateFrankingCredit(dividendAmount, frankingPercent, corporateTaxRate);
  return dividendAmount + frankingCredit;
}

/**
 * Calculate tax payable on franked dividend.
 * Takes into account franking credit offset.
 *
 * @param dividendAmount - Cash dividend received
 * @param frankingPercent - Percentage franked
 * @param marginalTaxRate - Investor's marginal tax rate
 * @param corporateTaxRate - Corporate tax rate
 * @returns Tax payable (negative means refund)
 */
export function calculateDividendTax(
  dividendAmount: number,
  frankingPercent: number,
  marginalTaxRate: number,
  corporateTaxRate: number = AU_CORPORATE_TAX_RATE
): number {
  const grossedUp = calculateGrossedUpDividend(dividendAmount, frankingPercent, corporateTaxRate);
  const frankingCredit = calculateFrankingCredit(dividendAmount, frankingPercent, corporateTaxRate);

  const taxOnGrossedUp = grossedUp * marginalTaxRate;
  return taxOnGrossedUp - frankingCredit;
}

// =============================================================================
// YIELD CALCULATIONS
// =============================================================================

/**
 * Calculate dividend yield.
 *
 * @param annualDividend - Total annual dividend per share
 * @param currentPrice - Current share price
 * @returns Yield as decimal (e.g., 0.045 for 4.5%)
 */
export function calculateDividendYield(
  annualDividend: number,
  currentPrice: number
): number {
  if (currentPrice <= 0) return 0;
  return annualDividend / currentPrice;
}

/**
 * Calculate grossed-up yield including franking credits.
 *
 * @param annualDividend - Total annual dividend per share
 * @param currentPrice - Current share price
 * @param averageFrankingPercent - Average franking percentage
 * @param corporateTaxRate - Corporate tax rate
 * @returns Grossed-up yield as decimal
 */
export function calculateGrossedUpYield(
  annualDividend: number,
  currentPrice: number,
  averageFrankingPercent: number,
  corporateTaxRate: number = AU_CORPORATE_TAX_RATE
): number {
  if (currentPrice <= 0) return 0;

  const grossedUpDividend = calculateGrossedUpDividend(
    annualDividend,
    averageFrankingPercent,
    corporateTaxRate
  );

  return grossedUpDividend / currentPrice;
}

/**
 * Calculate trailing twelve month (TTM) yield.
 *
 * @param dividends - Array of dividend payments in the last 12 months
 * @param currentPrice - Current share price
 * @param sharesHeld - Number of shares held
 * @returns TTM yield as decimal
 */
export function calculateTTMYield(
  dividends: DividendPayment[],
  currentPrice: number,
  sharesHeld: number
): number {
  if (currentPrice <= 0 || sharesHeld <= 0) return 0;

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const ttmDividends = dividends
    .filter(d => d.date >= twelveMonthsAgo)
    .reduce((sum, d) => sum + d.grossAmount, 0);

  const perShareDividend = ttmDividends / sharesHeld;
  return perShareDividend / currentPrice;
}

// =============================================================================
// DIVIDEND ANALYTICS
// =============================================================================

/**
 * Calculate comprehensive dividend analytics for a holding.
 *
 * @param dividends - Array of dividend payments
 * @param currentValue - Current market value of holding
 * @param costBase - Total cost base of holding
 * @returns Comprehensive dividend analytics
 */
export function calculateDividendAnalytics(
  dividends: DividendPayment[],
  currentValue: number,
  costBase: number
): DividendAnalytics {
  if (dividends.length === 0) {
    return {
      totalDividends: 0,
      totalFrankingCredits: 0,
      grossedUpDividends: 0,
      averageFrankingPercent: 0,
      dividendYield: 0,
      grossedUpYield: 0
    };
  }

  let totalDividends = 0;
  let totalFrankingCredits = 0;
  let weightedFrankingSum = 0;

  for (const dividend of dividends) {
    totalDividends += dividend.grossAmount;
    const credit = calculateFrankingCredit(dividend.grossAmount, dividend.frankingPercent);
    totalFrankingCredits += credit;
    weightedFrankingSum += dividend.grossAmount * dividend.frankingPercent;
  }

  const grossedUpDividends = totalDividends + totalFrankingCredits;
  const averageFrankingPercent = totalDividends > 0 ? weightedFrankingSum / totalDividends : 0;

  // Calculate yield based on cost base (yield on cost)
  const dividendYield = costBase > 0 ? totalDividends / costBase : 0;
  const grossedUpYield = costBase > 0 ? grossedUpDividends / costBase : 0;

  return {
    totalDividends,
    totalFrankingCredits,
    grossedUpDividends,
    averageFrankingPercent,
    dividendYield,
    grossedUpYield
  };
}

/**
 * Calculate yield metrics for a holding.
 *
 * @param dividends - Array of dividend payments
 * @param currentPrice - Current price per unit
 * @param units - Number of units held
 * @param expectedAnnualDividend - Expected forward dividend (optional)
 * @param averageFrankingPercent - Average franking percentage
 * @returns Yield metrics
 */
export function calculateYieldMetrics(
  dividends: DividendPayment[],
  currentPrice: number,
  units: number,
  expectedAnnualDividend: number = 0,
  averageFrankingPercent: number = 100
): YieldMetrics {
  const currentValue = currentPrice * units;

  // TTM dividends
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const ttmDividends = dividends
    .filter(d => d.date >= twelveMonthsAgo)
    .reduce((sum, d) => sum + d.grossAmount, 0);

  const ttmPerUnit = units > 0 ? ttmDividends / units : 0;

  // Current yield (most recent annualized)
  const recentDividends = dividends
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 4); // Last 4 payments (assuming quarterly)

  const recentTotal = recentDividends.reduce((sum, d) => sum + d.grossAmount, 0);
  const annualizedRecent = recentDividends.length > 0
    ? (recentTotal / recentDividends.length) * 4
    : 0;
  const currentYield = currentValue > 0 ? annualizedRecent / currentValue : 0;

  // TTM yield
  const trailingTwelveMonthYield = currentValue > 0 ? ttmDividends / currentValue : 0;

  // Forward yield
  const forwardYield = currentPrice > 0 && expectedAnnualDividend > 0
    ? expectedAnnualDividend / currentPrice
    : trailingTwelveMonthYield;

  // Grossed-up yield
  const grossedUpYield = calculateGrossedUpYield(
    ttmPerUnit,
    currentPrice,
    averageFrankingPercent
  );

  // Franking credit value
  const frankingCreditValue = calculateFrankingCredit(ttmDividends, averageFrankingPercent);

  return {
    currentYield,
    trailingTwelveMonthYield,
    forwardYield,
    grossedUpYield,
    frankingCreditValue
  };
}

// =============================================================================
// DISTRIBUTION ANALYSIS (ETFs / Managed Funds)
// =============================================================================

/**
 * Calculate after-tax value of a distribution.
 * Useful for ETF/managed fund distributions with complex breakdowns.
 *
 * @param breakdown - Distribution breakdown by component
 * @param marginalTaxRate - Investor's marginal tax rate
 * @returns After-tax distribution value
 */
export function calculateAfterTaxDistribution(
  breakdown: DistributionBreakdown,
  marginalTaxRate: number
): number {
  // Income component - taxed at marginal rate
  const incomeTax = breakdown.income * marginalTaxRate;

  // Capital gain - taxed at marginal rate
  const capitalGainTax = breakdown.capitalGain * marginalTaxRate;

  // Discounted capital gain - only 50% included
  const discountedGainTax = (breakdown.capitalGainDiscounted * 0.5) * marginalTaxRate;

  // Foreign income - may have foreign tax credits (simplified)
  const foreignIncomeTax = breakdown.foreignIncome * marginalTaxRate;

  // Tax deferred - not taxed now (reduces cost base)
  const taxDeferredTax = 0;

  // Tax free - not taxed
  const taxFreeTax = 0;

  const totalDistribution =
    breakdown.income +
    breakdown.capitalGain +
    breakdown.capitalGainDiscounted +
    breakdown.foreignIncome +
    breakdown.taxDeferred +
    breakdown.taxFree;

  const totalTax = incomeTax + capitalGainTax + discountedGainTax + foreignIncomeTax + taxDeferredTax + taxFreeTax;

  return totalDistribution - totalTax;
}

/**
 * Calculate DRP (Dividend Reinvestment Plan) growth projection.
 *
 * @param initialUnits - Starting number of units
 * @param dividendPerUnit - Annual dividend per unit
 * @param pricePerUnit - Price per unit for DRP
 * @param years - Number of years to project
 * @param dividendGrowthRate - Annual dividend growth rate
 * @returns Projected units after DRP
 */
export function projectDRPGrowth(
  initialUnits: number,
  dividendPerUnit: number,
  pricePerUnit: number,
  years: number,
  dividendGrowthRate: number = 0.03
): number {
  if (pricePerUnit <= 0 || years <= 0) return initialUnits;

  let units = initialUnits;
  let currentDividend = dividendPerUnit;

  for (let year = 0; year < years; year++) {
    // Annual dividend
    const totalDividend = units * currentDividend;

    // New units from DRP
    const newUnits = totalDividend / pricePerUnit;
    units += newUnits;

    // Grow dividend for next year
    currentDividend *= (1 + dividendGrowthRate);
  }

  return units;
}

/**
 * Monitrax Investment Engine
 * Phase 3 Foundation - Australian Tax Rules
 *
 * Functions for calculating investment performance, dividend yields,
 * and franking credits according to Australian regulations.
 */

import { InvestmentHolding, InvestmentTransaction } from '@/lib/types/prisma-enums';

// =============================================================================
// TYPES
// =============================================================================

export interface HoldingValue {
  holdingId: string;
  ticker: string;
  units: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  costBase: number;
  unrealisedGain: number;
  unrealisedGainPercentage: number;
}

export interface InvestmentPerformance {
  totalInvested: number;
  totalMarketValue: number;
  totalUnrealisedGain: number;
  totalUnrealisedGainPercentage: number;
  totalDividendsReceived: number;
  totalFees: number;
  netReturn: number;
  netReturnPercentage: number;
}

export interface DividendYieldResult {
  holdingId: string;
  ticker: string;
  annualDividend: number;
  currentPrice: number;
  dividendYield: number; // as decimal (e.g., 0.045 for 4.5%)
  grossedUpYield: number; // including franking credits
}

export interface FrankingCreditResult {
  grossDividend: number;
  frankingCredit: number;
  netDividend: number;
  frankingPercentage: number;
}

// =============================================================================
// AUSTRALIAN TAX CONSTANTS
// =============================================================================

// Australian corporate tax rate for franking credit calculation
export const AU_CORPORATE_TAX_RATE = 0.30; // 30% for large companies
export const AU_CORPORATE_TAX_RATE_SMALL = 0.25; // 25% for small companies

// =============================================================================
// HOLDING VALUE CALCULATION
// =============================================================================

/**
 * Calculate the current value and unrealised gain for a holding.
 *
 * @param holding - The investment holding
 * @param currentPrice - Current market price per unit
 * @returns Holding value breakdown
 */
export function calculateHoldingValue(
  holding: Pick<InvestmentHolding, 'id' | 'ticker' | 'units' | 'averagePrice'>,
  currentPrice: number
): HoldingValue {
  const marketValue = holding.units * currentPrice;
  const costBase = holding.units * holding.averagePrice;
  const unrealisedGain = marketValue - costBase;
  const unrealisedGainPercentage = costBase > 0 ? (unrealisedGain / costBase) * 100 : 0;

  return {
    holdingId: holding.id,
    ticker: holding.ticker,
    units: holding.units,
    averagePrice: holding.averagePrice,
    currentPrice,
    marketValue,
    costBase,
    unrealisedGain,
    unrealisedGainPercentage,
  };
}

// =============================================================================
// INVESTMENT PERFORMANCE CALCULATION
// =============================================================================

/**
 * Calculate overall investment performance for a portfolio.
 *
 * @param holdings - Array of holdings with current prices
 * @param transactions - Array of investment transactions
 * @returns Investment performance summary
 */
export function calculateInvestmentPerformance(
  holdings: Array<Pick<InvestmentHolding, 'id' | 'ticker' | 'units' | 'averagePrice'> & { currentPrice: number }>,
  transactions: Array<Pick<InvestmentTransaction, 'type' | 'price' | 'units' | 'fees'>>
): InvestmentPerformance {
  // Calculate total invested from BUY transactions
  const totalInvested = transactions
    .filter((t) => t.type === 'BUY')
    .reduce((sum, t) => sum + t.price * t.units, 0);

  // Calculate total fees
  const totalFees = transactions.reduce((sum, t) => sum + (t.fees || 0), 0);

  // Calculate total dividends received
  const totalDividendsReceived = transactions
    .filter((t) => t.type === 'DIVIDEND' || t.type === 'DISTRIBUTION')
    .reduce((sum, t) => sum + t.price * t.units, 0);

  // Calculate current market value
  const totalMarketValue = holdings.reduce((sum, h) => sum + h.units * h.currentPrice, 0);

  // Calculate unrealised gain
  const totalCostBase = holdings.reduce((sum, h) => sum + h.units * h.averagePrice, 0);
  const totalUnrealisedGain = totalMarketValue - totalCostBase;
  const totalUnrealisedGainPercentage = totalCostBase > 0 ? (totalUnrealisedGain / totalCostBase) * 100 : 0;

  // Calculate net return (unrealised gain + dividends - fees)
  const netReturn = totalUnrealisedGain + totalDividendsReceived - totalFees;
  const netReturnPercentage = totalInvested > 0 ? (netReturn / totalInvested) * 100 : 0;

  return {
    totalInvested,
    totalMarketValue,
    totalUnrealisedGain,
    totalUnrealisedGainPercentage,
    totalDividendsReceived,
    totalFees,
    netReturn,
    netReturnPercentage,
  };
}

// =============================================================================
// DIVIDEND YIELD CALCULATION (AUSTRALIAN)
// =============================================================================

/**
 * Calculate dividend yield for a holding.
 * Includes grossed-up yield accounting for franking credits (Australian feature).
 *
 * @param holding - The investment holding
 * @param annualDividendPerUnit - Annual dividend per unit
 * @param currentPrice - Current market price per unit
 * @returns Dividend yield breakdown
 */
export function calculateDividendYieldAU(
  holding: Pick<InvestmentHolding, 'id' | 'ticker' | 'frankingPercentage'>,
  annualDividendPerUnit: number,
  currentPrice: number
): DividendYieldResult {
  const dividendYield = currentPrice > 0 ? annualDividendPerUnit / currentPrice : 0;

  // Calculate grossed-up yield including franking credits
  const frankingPercentage = holding.frankingPercentage ?? 0;
  const frankingMultiplier = 1 + (frankingPercentage / 100) * (AU_CORPORATE_TAX_RATE / (1 - AU_CORPORATE_TAX_RATE));
  const grossedUpDividend = annualDividendPerUnit * frankingMultiplier;
  const grossedUpYield = currentPrice > 0 ? grossedUpDividend / currentPrice : 0;

  return {
    holdingId: holding.id,
    ticker: holding.ticker,
    annualDividend: annualDividendPerUnit,
    currentPrice,
    dividendYield,
    grossedUpYield,
  };
}

// =============================================================================
// FRANKING CREDIT CALCULATION (AUSTRALIAN)
// =============================================================================

/**
 * Calculate franking credits for a dividend payment.
 * Australian franking credits represent tax already paid at the corporate level.
 *
 * Formula: Franking Credit = (Dividend / (1 - Corporate Tax Rate)) - Dividend
 *          when fully franked (100%)
 *
 * @param netDividend - The cash dividend received
 * @param frankingPercentage - Percentage of dividend that is franked (0-100)
 * @param corporateTaxRate - Corporate tax rate (default 30% for large companies)
 * @returns Franking credit breakdown
 */
export function calculateFrankingCreditAU(
  netDividend: number,
  frankingPercentage: number = 100,
  corporateTaxRate: number = AU_CORPORATE_TAX_RATE
): FrankingCreditResult {
  // Franked portion of the dividend
  const frankedPortion = netDividend * (frankingPercentage / 100);

  // Franking credit calculation
  // Credit = franked amount × (corporate tax rate / (1 - corporate tax rate))
  const frankingCredit = frankedPortion * (corporateTaxRate / (1 - corporateTaxRate));

  // Gross dividend (for tax purposes)
  const grossDividend = netDividend + frankingCredit;

  return {
    grossDividend,
    frankingCredit,
    netDividend,
    frankingPercentage,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate weighted average price after a new purchase.
 *
 * @param existingUnits - Current number of units held
 * @param existingAvgPrice - Current average price
 * @param newUnits - Number of units being purchased
 * @param newPrice - Price per unit for new purchase
 * @returns New weighted average price
 */
export function calculateWeightedAveragePrice(
  existingUnits: number,
  existingAvgPrice: number,
  newUnits: number,
  newPrice: number
): number {
  const totalUnits = existingUnits + newUnits;
  if (totalUnits === 0) return 0;

  const existingValue = existingUnits * existingAvgPrice;
  const newValue = newUnits * newPrice;
  return (existingValue + newValue) / totalUnits;
}

/**
 * Calculate realised gain/loss from a sale.
 *
 * @param soldUnits - Number of units sold
 * @param salePrice - Sale price per unit
 * @param averageCostBase - Average cost base per unit
 * @returns Realised gain (positive) or loss (negative)
 */
export function calculateRealisedGain(
  soldUnits: number,
  salePrice: number,
  averageCostBase: number
): number {
  return soldUnits * (salePrice - averageCostBase);
}

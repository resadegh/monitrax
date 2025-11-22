/**
 * Monitrax Capital Gains Tax (CGT) Engine
 * Phase 3 Foundation - Australian Tax Rules
 *
 * Implements CGT calculations following ATO rules including:
 * - Cost base calculation
 * - CGT discount (50% for assets held > 12 months)
 * - Net capital gain/loss tracking
 *
 * Note: Full CGT integration with tax engine planned for Phase 4
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CostBaseElement {
  description: string;
  amount: number;
  date: Date;
}

export interface CostBaseResult {
  assetId: string;
  acquisitionDate: Date;
  baseCost: number; // Original purchase price
  incidentalCosts: number; // Stamp duty, legal fees, etc.
  ownershipCosts: number; // Non-deductible holding costs
  capitalExpenditures: number; // Improvements, renovations
  capitalCostsToSell: number; // Estimated selling costs
  totalCostBase: number;
  reducedCostBase: number; // For calculating capital losses
}

export interface CGTCalculationResult {
  assetId: string;
  salePrice: number;
  costBase: number;
  capitalGain: number;
  capitalLoss: number;
  holdingPeriodDays: number;
  eligibleForDiscount: boolean;
  discountedGain: number;
  netCapitalGain: number;
}

export interface CGTEventSummary {
  financialYear: string;
  totalCapitalGains: number;
  totalCapitalLosses: number;
  priorYearLossesApplied: number;
  netCapitalGain: number;
  discountApplied: number;
  assessableCapitalGain: number;
}

// =============================================================================
// AUSTRALIAN CGT CONSTANTS
// =============================================================================

// CGT Discount - 50% for individuals and trusts (not companies)
export const CGT_DISCOUNT_RATE = 0.5;

// Minimum holding period for CGT discount (days)
export const CGT_DISCOUNT_HOLDING_PERIOD_DAYS = 365;

// Small business CGT concessions threshold (Phase 4)
export const SMALL_BUSINESS_CGT_THRESHOLD = 6000000;

// Main residence exemption flag (will be fully implemented in Phase 4)
export const MAIN_RESIDENCE_EXEMPT = true;

// =============================================================================
// COST BASE CALCULATION
// =============================================================================

/**
 * Calculate the cost base of an asset for CGT purposes.
 *
 * Cost base includes 5 elements under Australian tax law:
 * 1. Money paid for the asset
 * 2. Incidental costs of acquisition
 * 3. Costs of owning the asset (non-deductible)
 * 4. Capital expenditure to increase value
 * 5. Capital costs of selling the asset
 *
 * @param assetId - Unique identifier for the asset
 * @param acquisitionDate - Date the asset was acquired
 * @param purchasePrice - Original purchase price
 * @param incidentalCosts - Array of acquisition costs (stamp duty, legal, etc.)
 * @param ownershipCosts - Non-deductible holding costs
 * @param capitalExpenditures - Capital improvements
 * @param estimatedSellingCosts - Estimated costs to sell
 * @returns Cost base breakdown
 */
export function calculateCostBase(
  assetId: string,
  acquisitionDate: Date,
  purchasePrice: number,
  incidentalCosts: CostBaseElement[] = [],
  ownershipCosts: CostBaseElement[] = [],
  capitalExpenditures: CostBaseElement[] = [],
  estimatedSellingCosts: number = 0
): CostBaseResult {
  const totalIncidentalCosts = incidentalCosts.reduce((sum, c) => sum + c.amount, 0);
  const totalOwnershipCosts = ownershipCosts.reduce((sum, c) => sum + c.amount, 0);
  const totalCapitalExpenditures = capitalExpenditures.reduce((sum, c) => sum + c.amount, 0);

  const totalCostBase =
    purchasePrice + totalIncidentalCosts + totalOwnershipCosts + totalCapitalExpenditures + estimatedSellingCosts;

  // Reduced cost base excludes ownership costs
  const reducedCostBase =
    purchasePrice + totalIncidentalCosts + totalCapitalExpenditures + estimatedSellingCosts;

  return {
    assetId,
    acquisitionDate,
    baseCost: purchasePrice,
    incidentalCosts: totalIncidentalCosts,
    ownershipCosts: totalOwnershipCosts,
    capitalExpenditures: totalCapitalExpenditures,
    capitalCostsToSell: estimatedSellingCosts,
    totalCostBase,
    reducedCostBase,
  };
}

// =============================================================================
// CGT CALCULATION
// =============================================================================

/**
 * Calculate capital gain or loss on disposal of an asset.
 *
 * @param assetId - Unique identifier for the asset
 * @param acquisitionDate - Date the asset was acquired
 * @param disposalDate - Date the asset was sold
 * @param salePrice - Sale proceeds
 * @param costBase - Total cost base of the asset
 * @param applyDiscount - Whether to apply CGT discount (default true for eligible)
 * @returns CGT calculation result
 */
export function calculateCGT(
  assetId: string,
  acquisitionDate: Date,
  disposalDate: Date,
  salePrice: number,
  costBase: number,
  applyDiscount: boolean = true
): CGTCalculationResult {
  const holdingPeriodDays = Math.floor(
    (disposalDate.getTime() - acquisitionDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const eligibleForDiscount = holdingPeriodDays >= CGT_DISCOUNT_HOLDING_PERIOD_DAYS;

  let capitalGain = 0;
  let capitalLoss = 0;

  if (salePrice > costBase) {
    capitalGain = salePrice - costBase;
  } else if (salePrice < costBase) {
    capitalLoss = costBase - salePrice;
  }

  // Apply 50% CGT discount for eligible gains
  const discountedGain =
    capitalGain > 0 && eligibleForDiscount && applyDiscount
      ? capitalGain * (1 - CGT_DISCOUNT_RATE)
      : capitalGain;

  return {
    assetId,
    salePrice,
    costBase,
    capitalGain,
    capitalLoss,
    holdingPeriodDays,
    eligibleForDiscount,
    discountedGain,
    netCapitalGain: discountedGain,
  };
}

// =============================================================================
// CGT EVENT SUMMARY
// =============================================================================

/**
 * Calculate CGT summary for a financial year.
 *
 * @param financialYear - Financial year (e.g., "2024-25")
 * @param cgtEvents - Array of CGT calculations for the year
 * @param priorYearLosses - Capital losses carried forward from prior years
 * @returns CGT event summary
 */
export function calculateCGTEventSummary(
  financialYear: string,
  cgtEvents: CGTCalculationResult[],
  priorYearLosses: number = 0
): CGTEventSummary {
  // Sum all capital gains (before discount)
  const totalCapitalGains = cgtEvents.reduce((sum, e) => sum + e.capitalGain, 0);

  // Sum all capital losses
  const totalCapitalLosses = cgtEvents.reduce((sum, e) => sum + e.capitalLoss, 0);

  // Step 1: Apply current year losses against gains
  const gainsAfterCurrentLosses = Math.max(0, totalCapitalGains - totalCapitalLosses);

  // Step 2: Apply prior year losses
  const priorYearLossesApplied = Math.min(priorYearLosses, gainsAfterCurrentLosses);
  const gainsAfterAllLosses = gainsAfterCurrentLosses - priorYearLossesApplied;

  // Step 3: Apply CGT discount to eligible gains
  // Note: Simplified - assumes all gains are eligible for discount
  // Full implementation would track each asset's eligibility
  const discountApplied = gainsAfterAllLosses * CGT_DISCOUNT_RATE;
  const assessableCapitalGain = gainsAfterAllLosses - discountApplied;

  return {
    financialYear,
    totalCapitalGains,
    totalCapitalLosses,
    priorYearLossesApplied,
    netCapitalGain: gainsAfterAllLosses,
    discountApplied,
    assessableCapitalGain,
  };
}

// =============================================================================
// PROPERTY CGT HELPERS
// =============================================================================

/**
 * Calculate cost base for a property including typical acquisition costs.
 *
 * @param propertyId - Property identifier
 * @param purchasePrice - Original purchase price
 * @param purchaseDate - Date of purchase
 * @param stampDuty - Stamp duty paid
 * @param legalFees - Conveyancing/legal fees
 * @param renovationCosts - Capital improvements
 * @param estimatedSellingCosts - Agent fees, marketing, etc.
 * @returns Property cost base
 */
export function calculatePropertyCostBase(
  propertyId: string,
  purchasePrice: number,
  purchaseDate: Date,
  stampDuty: number = 0,
  legalFees: number = 0,
  renovationCosts: number = 0,
  estimatedSellingCosts: number = 0
): CostBaseResult {
  const incidentalCosts: CostBaseElement[] = [];

  if (stampDuty > 0) {
    incidentalCosts.push({
      description: 'Stamp duty',
      amount: stampDuty,
      date: purchaseDate,
    });
  }

  if (legalFees > 0) {
    incidentalCosts.push({
      description: 'Legal/conveyancing fees',
      amount: legalFees,
      date: purchaseDate,
    });
  }

  const capitalExpenditures: CostBaseElement[] = [];
  if (renovationCosts > 0) {
    capitalExpenditures.push({
      description: 'Renovations/improvements',
      amount: renovationCosts,
      date: purchaseDate, // Simplified - would track actual dates
    });
  }

  return calculateCostBase(
    propertyId,
    purchaseDate,
    purchasePrice,
    incidentalCosts,
    [], // No non-deductible ownership costs tracked yet
    capitalExpenditures,
    estimatedSellingCosts
  );
}

/**
 * Check if a property qualifies for main residence exemption.
 *
 * Note: Simplified implementation. Full rules include:
 * - Must be main residence for entire ownership period
 * - Absence rule (up to 6 years)
 * - Partial exemption calculations
 *
 * @param isMainResidence - Whether property was main residence
 * @param periodAsMainResidence - Days as main residence
 * @param totalOwnershipPeriod - Total days owned
 * @returns Exemption percentage (0-100)
 */
export function calculateMainResidenceExemption(
  isMainResidence: boolean,
  periodAsMainResidence: number,
  totalOwnershipPeriod: number
): number {
  if (!isMainResidence || totalOwnershipPeriod === 0) {
    return 0;
  }

  // Partial exemption based on time as main residence
  const exemptionPercentage = (periodAsMainResidence / totalOwnershipPeriod) * 100;
  return Math.min(100, Math.max(0, exemptionPercentage));
}

// =============================================================================
// INVESTMENT CGT HELPERS
// =============================================================================

/**
 * Calculate cost base for shares/ETFs.
 *
 * @param holdingId - Holding identifier
 * @param acquisitionDate - Date shares were acquired
 * @param purchasePrice - Total purchase price (units × price per unit)
 * @param brokerageFees - Brokerage fees on purchase
 * @param estimatedSellingFees - Estimated brokerage on sale
 * @returns Share cost base
 */
export function calculateShareCostBase(
  holdingId: string,
  acquisitionDate: Date,
  purchasePrice: number,
  brokerageFees: number = 0,
  estimatedSellingFees: number = 0
): CostBaseResult {
  const incidentalCosts: CostBaseElement[] = [];

  if (brokerageFees > 0) {
    incidentalCosts.push({
      description: 'Brokerage fees',
      amount: brokerageFees,
      date: acquisitionDate,
    });
  }

  return calculateCostBase(
    holdingId,
    acquisitionDate,
    purchasePrice,
    incidentalCosts,
    [],
    [],
    estimatedSellingFees
  );
}

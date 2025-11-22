/**
 * Monitrax CGT Calculation Engine
 * Phase 4 - Capital Gains Tax Calculations
 *
 * Implements Australian CGT calculations including:
 * - CGT Event A1 (disposal)
 * - 12-month discount
 * - Net capital gain/loss
 */

import { CostBaseResult } from './costBase';

// =============================================================================
// TYPES
// =============================================================================

export interface CGTEvent {
  eventId: string;
  eventType: CGTEventType;
  assetId: string;
  assetDescription: string;
  acquisitionDate: Date;
  disposalDate: Date;
  capitalProceeds: number;
  costBase: number;
  reducedCostBase: number;
}

export type CGTEventType =
  | 'A1_DISPOSAL'
  | 'A2_LOSS_OWNERSHIP'
  | 'C1_LOSS_DESTROY'
  | 'C2_CANCELLATION'
  | 'E1_TRUST_CREATION'
  | 'K6_PRE_CGT_SHARE';

export interface CGTCalculationResult {
  eventId: string;
  assetId: string;
  capitalProceeds: number;
  costBase: number;
  grossCapitalGain: number;
  grossCapitalLoss: number;
  holdingPeriodDays: number;
  eligibleForDiscount: boolean;
  discountAmount: number;
  netCapitalGain: number;
  mainResidenceExemptionApplied: boolean;
  mainResidenceExemptionAmount: number;
}

export interface CGTSummary {
  financialYear: string;
  events: CGTCalculationResult[];
  totalGrossGains: number;
  totalGrossLosses: number;
  currentYearLossesApplied: number;
  priorYearLossesApplied: number;
  netGainBeforeDiscount: number;
  totalDiscountAmount: number;
  netCapitalGain: number;
  taxableCapitalGain: number;
  carriedForwardLosses: number;
}

export interface MainResidenceExemption {
  totalOwnershipDays: number;
  daysAsMainResidence: number;
  absenceDays: number;
  incomeProducingDays: number;
  exemptionPercentage: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const CGT_DISCOUNT_RATE = 0.5; // 50% discount
export const CGT_DISCOUNT_HOLDING_DAYS = 365; // 12 months

// Main residence absence rule - 6 year limit
export const MAIN_RESIDENCE_ABSENCE_LIMIT_DAYS = 365 * 6;

// =============================================================================
// CGT EVENT A1 - DISPOSAL
// =============================================================================

/**
 * Calculate CGT for disposal of an asset (CGT Event A1).
 *
 * @param event - CGT event details
 * @param mainResidenceExemption - Main residence exemption if applicable
 * @returns CGT calculation result
 */
export function calculateCGTEventA1(
  event: CGTEvent,
  mainResidenceExemption?: MainResidenceExemption
): CGTCalculationResult {
  const holdingPeriodDays = Math.floor(
    (event.disposalDate.getTime() - event.acquisitionDate.getTime()) /
    (1000 * 60 * 60 * 24)
  );

  const eligibleForDiscount = holdingPeriodDays >= CGT_DISCOUNT_HOLDING_DAYS;

  // Calculate gross gain or loss
  let grossCapitalGain = 0;
  let grossCapitalLoss = 0;

  if (event.capitalProceeds > event.costBase) {
    grossCapitalGain = event.capitalProceeds - event.costBase;
  } else if (event.capitalProceeds < event.reducedCostBase) {
    // Losses are calculated using reduced cost base
    grossCapitalLoss = event.reducedCostBase - event.capitalProceeds;
  }

  // Apply main residence exemption if applicable
  let mainResidenceExemptionAmount = 0;
  let mainResidenceExemptionApplied = false;

  if (mainResidenceExemption && grossCapitalGain > 0) {
    mainResidenceExemptionApplied = true;
    mainResidenceExemptionAmount = grossCapitalGain * (mainResidenceExemption.exemptionPercentage / 100);
    grossCapitalGain -= mainResidenceExemptionAmount;
  }

  // Apply discount if eligible and there's a gain
  let discountAmount = 0;
  if (eligibleForDiscount && grossCapitalGain > 0) {
    discountAmount = grossCapitalGain * CGT_DISCOUNT_RATE;
  }

  const netCapitalGain = Math.max(0, grossCapitalGain - discountAmount);

  return {
    eventId: event.eventId,
    assetId: event.assetId,
    capitalProceeds: event.capitalProceeds,
    costBase: event.costBase,
    grossCapitalGain: grossCapitalGain + mainResidenceExemptionAmount, // Pre-exemption for reporting
    grossCapitalLoss,
    holdingPeriodDays,
    eligibleForDiscount,
    discountAmount,
    netCapitalGain,
    mainResidenceExemptionApplied,
    mainResidenceExemptionAmount
  };
}

// =============================================================================
// MAIN RESIDENCE EXEMPTION
// =============================================================================

/**
 * Calculate main residence exemption percentage.
 * Considers:
 * - Period as main residence
 * - Absence rule (up to 6 years)
 * - Income-producing period
 *
 * @param totalOwnershipDays - Total days owned
 * @param daysAsMainResidence - Days property was main residence
 * @param absenceDays - Days absent (up to 6 years can be exempt)
 * @param incomeProducingDays - Days property was rented out
 * @returns Main residence exemption details
 */
export function calculateMainResidenceExemption(
  totalOwnershipDays: number,
  daysAsMainResidence: number,
  absenceDays: number = 0,
  incomeProducingDays: number = 0
): MainResidenceExemption {
  if (totalOwnershipDays <= 0) {
    return {
      totalOwnershipDays,
      daysAsMainResidence,
      absenceDays,
      incomeProducingDays,
      exemptionPercentage: 0
    };
  }

  // Calculate eligible absence days (up to 6 years)
  const eligibleAbsenceDays = Math.min(absenceDays, MAIN_RESIDENCE_ABSENCE_LIMIT_DAYS);

  // Days covered by exemption
  const exemptDays = daysAsMainResidence + eligibleAbsenceDays;

  // Non-exempt days (income producing period not covered by absence rule)
  const nonExemptDays = Math.max(0, incomeProducingDays - eligibleAbsenceDays);

  // Calculate percentage
  const exemptionPercentage = ((totalOwnershipDays - nonExemptDays) / totalOwnershipDays) * 100;

  return {
    totalOwnershipDays,
    daysAsMainResidence,
    absenceDays: eligibleAbsenceDays,
    incomeProducingDays,
    exemptionPercentage: Math.min(100, Math.max(0, exemptionPercentage))
  };
}

// =============================================================================
// CGT SUMMARY FOR FINANCIAL YEAR
// =============================================================================

/**
 * Calculate CGT summary for a financial year.
 * Applies losses in the correct order per ATO rules:
 * 1. Current year losses against current year gains
 * 2. Prior year losses against remaining gains
 * 3. CGT discount on remaining gains
 *
 * @param financialYear - Financial year string
 * @param events - Array of CGT events for the year
 * @param priorYearLosses - Carried forward losses from prior years
 * @returns CGT summary
 */
export function calculateCGTSummary(
  financialYear: string,
  events: CGTCalculationResult[],
  priorYearLosses: number = 0
): CGTSummary {
  // Step 1: Calculate total gross gains and losses
  const totalGrossGains = events.reduce((sum, e) => sum + e.grossCapitalGain, 0);
  const totalGrossLosses = events.reduce((sum, e) => sum + e.grossCapitalLoss, 0);

  // Step 2: Apply current year losses
  const currentYearLossesApplied = Math.min(totalGrossLosses, totalGrossGains);
  const gainsAfterCurrentLosses = totalGrossGains - currentYearLossesApplied;

  // Step 3: Apply prior year losses
  const priorYearLossesApplied = Math.min(priorYearLosses, gainsAfterCurrentLosses);
  const netGainBeforeDiscount = gainsAfterCurrentLosses - priorYearLossesApplied;

  // Step 4: Calculate discount (simplified - applies proportionally)
  // In practice, need to track which gains are discountable
  const discountableEvents = events.filter(e => e.eligibleForDiscount && e.grossCapitalGain > 0);
  const discountableGains = discountableEvents.reduce((sum, e) => sum + e.grossCapitalGain, 0);
  const proportionDiscountable = totalGrossGains > 0 ? discountableGains / totalGrossGains : 0;

  const discountableAfterLosses = netGainBeforeDiscount * proportionDiscountable;
  const totalDiscountAmount = discountableAfterLosses * CGT_DISCOUNT_RATE;

  // Step 5: Calculate net and taxable capital gain
  const netCapitalGain = netGainBeforeDiscount;
  const taxableCapitalGain = netGainBeforeDiscount - totalDiscountAmount;

  // Step 6: Calculate carried forward losses
  const unusedCurrentLosses = totalGrossLosses - currentYearLossesApplied;
  const unusedPriorLosses = priorYearLosses - priorYearLossesApplied;
  const carriedForwardLosses = unusedCurrentLosses + unusedPriorLosses;

  return {
    financialYear,
    events,
    totalGrossGains,
    totalGrossLosses,
    currentYearLossesApplied,
    priorYearLossesApplied,
    netGainBeforeDiscount,
    totalDiscountAmount,
    netCapitalGain,
    taxableCapitalGain,
    carriedForwardLosses
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a CGT event from asset and sale details.
 *
 * @param assetId - Asset identifier
 * @param assetDescription - Description of asset
 * @param costBaseResult - Calculated cost base
 * @param saleProceeds - Sale proceeds
 * @param saleDate - Date of sale
 * @returns CGT event
 */
export function createCGTEvent(
  assetId: string,
  assetDescription: string,
  costBaseResult: CostBaseResult,
  saleProceeds: number,
  saleDate: Date
): CGTEvent {
  return {
    eventId: `CGT-${assetId}-${saleDate.getTime()}`,
    eventType: 'A1_DISPOSAL',
    assetId,
    assetDescription,
    acquisitionDate: costBaseResult.acquisitionDate,
    disposalDate: saleDate,
    capitalProceeds: saleProceeds,
    costBase: costBaseResult.totalCostBase,
    reducedCostBase: costBaseResult.reducedCostBase
  };
}

/**
 * Calculate tax on capital gain.
 *
 * @param taxableCapitalGain - Taxable capital gain
 * @param marginalTaxRate - Investor's marginal tax rate
 * @returns Tax payable on capital gain
 */
export function calculateCGTTax(
  taxableCapitalGain: number,
  marginalTaxRate: number
): number {
  if (taxableCapitalGain <= 0) return 0;
  return taxableCapitalGain * marginalTaxRate;
}

/**
 * Check if asset is pre-CGT (acquired before 20 September 1985).
 *
 * @param acquisitionDate - Date asset was acquired
 * @returns True if pre-CGT
 */
export function isPreCGT(acquisitionDate: Date): boolean {
  const cgtStartDate = new Date(1985, 8, 20); // 20 September 1985
  return acquisitionDate < cgtStartDate;
}

/**
 * Calculate effective CGT rate after discount.
 *
 * @param marginalRate - Marginal tax rate
 * @param holdingPeriodDays - Days held
 * @returns Effective CGT rate
 */
export function calculateEffectiveCGTRate(
  marginalRate: number,
  holdingPeriodDays: number
): number {
  if (holdingPeriodDays >= CGT_DISCOUNT_HOLDING_DAYS) {
    return marginalRate * (1 - CGT_DISCOUNT_RATE);
  }
  return marginalRate;
}

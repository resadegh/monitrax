/**
 * Monitrax CGT Cost Base Engine
 * Phase 4 - Capital Gains Tax Cost Base Calculations
 *
 * Implements Australian CGT cost base rules including
 * all 5 elements per ATO guidelines.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CostBaseElement {
  id: string;
  description: string;
  amount: number;
  date: Date;
  category: CostBaseCategory;
  isDeductible: boolean; // If true, not included in cost base
}

export type CostBaseCategory =
  | 'ACQUISITION_COST'     // Element 1: Purchase price
  | 'INCIDENTAL_ACQUISITION' // Element 2: Stamp duty, legal fees, etc.
  | 'OWNERSHIP_COST'       // Element 3: Non-deductible holding costs
  | 'CAPITAL_EXPENDITURE'  // Element 4: Improvements, renovations
  | 'INCIDENTAL_DISPOSAL'; // Element 5: Selling costs

export interface CostBaseResult {
  assetId: string;
  acquisitionDate: Date;
  element1_AcquisitionCost: number;
  element2_IncidentalAcquisition: number;
  element3_OwnershipCosts: number;
  element4_CapitalExpenditure: number;
  element5_IncidentalDisposal: number;
  totalCostBase: number;
  reducedCostBase: number;
  adjustments: CostBaseAdjustment[];
}

export interface CostBaseAdjustment {
  description: string;
  amount: number;
  adjustmentType: 'INCREASE' | 'DECREASE';
  reason: string;
}

export interface PropertyCostBase {
  propertyId: string;
  purchasePrice: number;
  purchaseDate: Date;
  stampDuty: number;
  legalFeesAcquisition: number;
  loanSetupFees: number;
  buildingInspection: number;
  pestInspection: number;
  renovationCosts: CostBaseElement[];
  capitalImprovements: CostBaseElement[];
  depreciationClawback: number;
  estimatedSellingCosts: number;
}

// =============================================================================
// ELEMENT 1: ACQUISITION COST
// =============================================================================

/**
 * Calculate Element 1 - Money paid to acquire the asset.
 * This is typically the purchase price.
 *
 * @param purchasePrice - Amount paid to acquire asset
 * @param gstIncluded - Whether GST was included (usually N/A for residential)
 * @returns Element 1 amount
 */
export function calculateElement1(
  purchasePrice: number,
  gstIncluded: boolean = false
): number {
  // For residential property, GST is typically not applicable
  // For commercial, GST may need to be excluded if claiming input credits
  return purchasePrice;
}

// =============================================================================
// ELEMENT 2: INCIDENTAL COSTS OF ACQUISITION
// =============================================================================

export interface AcquisitionCosts {
  stampDuty: number;
  legalFees: number;
  valuationFees: number;
  mortgageFees: number;
  buildingInspection: number;
  pestInspection: number;
  surveyFees: number;
  searchFees: number;
  agentFees: number; // Buyer's agent
  other: number;
}

/**
 * Calculate Element 2 - Incidental costs of acquisition.
 *
 * @param costs - Breakdown of acquisition costs
 * @returns Total Element 2 amount
 */
export function calculateElement2(costs: Partial<AcquisitionCosts>): number {
  return (
    (costs.stampDuty || 0) +
    (costs.legalFees || 0) +
    (costs.valuationFees || 0) +
    (costs.mortgageFees || 0) +
    (costs.buildingInspection || 0) +
    (costs.pestInspection || 0) +
    (costs.surveyFees || 0) +
    (costs.searchFees || 0) +
    (costs.agentFees || 0) +
    (costs.other || 0)
  );
}

// =============================================================================
// ELEMENT 3: COSTS OF OWNING THE ASSET
// =============================================================================

/**
 * Calculate Element 3 - Non-deductible costs of owning the asset.
 * Only applicable to assets acquired before 21 August 1991.
 *
 * @param acquisitionDate - Date asset was acquired
 * @param costs - Array of ownership costs
 * @returns Element 3 amount (0 if acquired after 21 Aug 1991)
 */
export function calculateElement3(
  acquisitionDate: Date,
  costs: CostBaseElement[]
): number {
  const cutoffDate = new Date(1991, 7, 21); // 21 August 1991

  // Element 3 only applies to assets acquired before 21 August 1991
  if (acquisitionDate >= cutoffDate) {
    return 0;
  }

  return costs
    .filter(c => c.category === 'OWNERSHIP_COST' && !c.isDeductible)
    .reduce((sum, c) => sum + c.amount, 0);
}

// =============================================================================
// ELEMENT 4: CAPITAL EXPENDITURE
// =============================================================================

/**
 * Calculate Element 4 - Capital expenditure to increase/preserve value.
 * Includes renovations, improvements, and non-deductible repairs.
 *
 * @param expenditures - Array of capital expenditures
 * @returns Element 4 amount
 */
export function calculateElement4(expenditures: CostBaseElement[]): number {
  return expenditures
    .filter(e => e.category === 'CAPITAL_EXPENDITURE' && !e.isDeductible)
    .reduce((sum, e) => sum + e.amount, 0);
}

// =============================================================================
// ELEMENT 5: COSTS OF DISPOSING THE ASSET
// =============================================================================

export interface DisposalCosts {
  agentCommission: number;
  legalFees: number;
  advertisingCosts: number;
  auctioneers: number;
  valuationFees: number;
  styling: number;
  other: number;
}

/**
 * Calculate Element 5 - Incidental costs of disposal.
 *
 * @param costs - Breakdown of disposal costs
 * @returns Total Element 5 amount
 */
export function calculateElement5(costs: Partial<DisposalCosts>): number {
  return (
    (costs.agentCommission || 0) +
    (costs.legalFees || 0) +
    (costs.advertisingCosts || 0) +
    (costs.auctioneers || 0) +
    (costs.valuationFees || 0) +
    (costs.styling || 0) +
    (costs.other || 0)
  );
}

// =============================================================================
// COST BASE ADJUSTMENTS
// =============================================================================

/**
 * Calculate depreciation clawback adjustment.
 * Reduces cost base by depreciation previously claimed.
 *
 * @param totalDepreciationClaimed - Total Division 40 depreciation claimed
 * @returns Cost base reduction amount
 */
export function calculateDepreciationClawback(totalDepreciationClaimed: number): number {
  // Cost base is reduced by Division 40 depreciation claimed
  // Division 43 depreciation does NOT reduce cost base
  return totalDepreciationClaimed;
}

/**
 * Calculate capital proceeds allocation for partial disposal.
 *
 * @param totalProceeds - Total sale proceeds
 * @param partDisposedPercent - Percentage of asset disposed (0-100)
 * @returns Allocated proceeds
 */
export function calculatePartialDisposalProceeds(
  totalProceeds: number,
  partDisposedPercent: number
): number {
  return totalProceeds * (partDisposedPercent / 100);
}

// =============================================================================
// COMPREHENSIVE COST BASE CALCULATION
// =============================================================================

/**
 * Calculate complete cost base for an asset.
 *
 * @param assetId - Asset identifier
 * @param acquisitionDate - Date of acquisition
 * @param purchasePrice - Original purchase price
 * @param acquisitionCosts - Element 2 costs
 * @param ownershipCosts - Element 3 costs (pre-1991 only)
 * @param capitalExpenditures - Element 4 costs
 * @param disposalCosts - Element 5 costs (if disposing)
 * @param depreciationClaimed - Total Div 40 depreciation claimed
 * @returns Complete cost base result
 */
export function calculateCompleteCostBase(
  assetId: string,
  acquisitionDate: Date,
  purchasePrice: number,
  acquisitionCosts: Partial<AcquisitionCosts>,
  ownershipCosts: CostBaseElement[],
  capitalExpenditures: CostBaseElement[],
  disposalCosts: Partial<DisposalCosts>,
  depreciationClaimed: number = 0
): CostBaseResult {
  const element1 = calculateElement1(purchasePrice);
  const element2 = calculateElement2(acquisitionCosts);
  const element3 = calculateElement3(acquisitionDate, ownershipCosts);
  const element4 = calculateElement4(capitalExpenditures);
  const element5 = calculateElement5(disposalCosts);

  const adjustments: CostBaseAdjustment[] = [];

  // Depreciation clawback reduces cost base
  if (depreciationClaimed > 0) {
    adjustments.push({
      description: 'Division 40 depreciation claimed',
      amount: depreciationClaimed,
      adjustmentType: 'DECREASE',
      reason: 'Cost base reduced by depreciation deductions claimed'
    });
  }

  const totalBeforeAdjustments = element1 + element2 + element3 + element4 + element5;
  const totalAdjustments = adjustments
    .filter(a => a.adjustmentType === 'DECREASE')
    .reduce((sum, a) => sum + a.amount, 0);

  const totalCostBase = totalBeforeAdjustments - totalAdjustments;

  // Reduced cost base excludes Element 3
  const reducedCostBase = totalCostBase - element3;

  return {
    assetId,
    acquisitionDate,
    element1_AcquisitionCost: element1,
    element2_IncidentalAcquisition: element2,
    element3_OwnershipCosts: element3,
    element4_CapitalExpenditure: element4,
    element5_IncidentalDisposal: element5,
    totalCostBase,
    reducedCostBase,
    adjustments
  };
}

// =============================================================================
// PROPERTY-SPECIFIC HELPERS
// =============================================================================

/**
 * Calculate cost base for an investment property.
 *
 * @param property - Property cost base details
 * @returns Cost base result
 */
export function calculatePropertyCostBase(property: PropertyCostBase): CostBaseResult {
  const acquisitionCosts: AcquisitionCosts = {
    stampDuty: property.stampDuty,
    legalFees: property.legalFeesAcquisition,
    mortgageFees: property.loanSetupFees,
    buildingInspection: property.buildingInspection,
    pestInspection: property.pestInspection,
    valuationFees: 0,
    surveyFees: 0,
    searchFees: 0,
    agentFees: 0,
    other: 0
  };

  const capitalExpenditures: CostBaseElement[] = [
    ...property.renovationCosts,
    ...property.capitalImprovements
  ];

  const disposalCosts: DisposalCosts = {
    agentCommission: property.estimatedSellingCosts * 0.8, // Estimate 80% is agent
    legalFees: property.estimatedSellingCosts * 0.1,
    advertisingCosts: property.estimatedSellingCosts * 0.1,
    auctioneers: 0,
    valuationFees: 0,
    styling: 0,
    other: 0
  };

  return calculateCompleteCostBase(
    property.propertyId,
    property.purchaseDate,
    property.purchasePrice,
    acquisitionCosts,
    [],
    capitalExpenditures,
    disposalCosts,
    property.depreciationClawback
  );
}

/**
 * Calculate cost base for shares/ETFs.
 *
 * @param holdingId - Holding identifier
 * @param purchaseDate - Date of purchase
 * @param purchasePrice - Total purchase price
 * @param brokerageFee - Brokerage on purchase
 * @param sellingBrokerage - Brokerage on sale
 * @returns Cost base result
 */
export function calculateShareCostBase(
  holdingId: string,
  purchaseDate: Date,
  purchasePrice: number,
  brokerageFee: number,
  sellingBrokerage: number = 0
): CostBaseResult {
  return calculateCompleteCostBase(
    holdingId,
    purchaseDate,
    purchasePrice,
    { other: brokerageFee },
    [],
    [],
    { other: sellingBrokerage },
    0
  );
}

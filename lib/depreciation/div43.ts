/**
 * Monitrax Division 43 Depreciation Engine
 * Phase 4 - Capital Works Depreciation
 *
 * Implements ATO Division 43 rules for depreciating building/structural
 * improvements in investment properties.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface Div43Asset {
  id: string;
  name: string;
  constructionCost: number;
  constructionStartDate: Date;
  constructionEndDate?: Date;
  propertyId: string;
  isResidential: boolean;
}

export interface Div43DepreciationResult {
  assetId: string;
  assetName: string;
  financialYear: string;
  constructionCost: number;
  rate: number;
  annualDepreciation: number;
  proRataDepreciation: number;
  totalDepreciationClaimed: number;
  remainingValue: number;
  yearsRemaining: number;
}

export interface Div43BalancingAdjustment {
  assetId: string;
  assetName: string;
  originalCost: number;
  totalDepreciationClaimed: number;
  undeductedCost: number;
  saleProceeds: number;
  balancingAdjustment: number;
  isDeduction: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Division 43 rates based on construction start date
export const DIV43_RATE_POST_SEPT_1987 = 0.025; // 2.5% (40 years)
export const DIV43_RATE_MID_1985_TO_SEPT_1987 = 0.04; // 4% (25 years)

// Key dates
export const SEPT_15_1987 = new Date(1987, 8, 15); // September 15, 1987
export const JULY_18_1985 = new Date(1985, 6, 18); // July 18, 1985

// =============================================================================
// RATE DETERMINATION
// =============================================================================

/**
 * Get applicable Division 43 rate based on construction start date.
 *
 * @param constructionStartDate - Date construction started
 * @returns Applicable depreciation rate
 */
export function getDiv43Rate(constructionStartDate: Date): number {
  if (constructionStartDate >= SEPT_15_1987) {
    return DIV43_RATE_POST_SEPT_1987; // 2.5%
  } else if (constructionStartDate >= JULY_18_1985) {
    return DIV43_RATE_MID_1985_TO_SEPT_1987; // 4%
  }

  // No Division 43 deduction for buildings constructed before 18 July 1985
  return 0;
}

/**
 * Get the life of the building for Division 43.
 *
 * @param rate - Applicable rate
 * @returns Life in years
 */
export function getDiv43Life(rate: number): number {
  if (rate === 0) return 0;
  return Math.round(1 / rate);
}

// =============================================================================
// DEPRECIATION CALCULATION
// =============================================================================

/**
 * Calculate Division 43 depreciation for a financial year.
 *
 * @param asset - Capital works asset
 * @param fyString - Financial year (e.g., "2024-25")
 * @param totalPriorDepreciation - Total depreciation claimed in prior years
 * @returns Depreciation result
 */
export function calculateDiv43Depreciation(
  asset: Div43Asset,
  fyString: string,
  totalPriorDepreciation: number = 0
): Div43DepreciationResult {
  const rate = getDiv43Rate(asset.constructionStartDate);
  const life = getDiv43Life(rate);

  // No deduction available
  if (rate === 0) {
    return {
      assetId: asset.id,
      assetName: asset.name,
      financialYear: fyString,
      constructionCost: asset.constructionCost,
      rate: 0,
      annualDepreciation: 0,
      proRataDepreciation: 0,
      totalDepreciationClaimed: totalPriorDepreciation,
      remainingValue: asset.constructionCost - totalPriorDepreciation,
      yearsRemaining: 0
    };
  }

  const annualDepreciation = asset.constructionCost * rate;

  // Calculate days held in FY for pro-rata
  const fyStartYear = parseInt(fyString.split('-')[0]);
  const fyStart = new Date(fyStartYear, 6, 1); // July 1
  const fyEnd = new Date(fyStartYear + 1, 5, 30); // June 30

  // Use construction end date or start date as the date available for use
  const availableDate = asset.constructionEndDate || asset.constructionStartDate;

  let daysInFY = 365;
  if (availableDate > fyStart) {
    // Asset only available part of the year
    const daysAvailable = Math.floor((fyEnd.getTime() - availableDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    daysInFY = Math.min(Math.max(0, daysAvailable), 365);
  }

  const proRataDepreciation = annualDepreciation * (daysInFY / 365);

  // Check we don't exceed the cost
  const maxDepreciation = asset.constructionCost - totalPriorDepreciation;
  const actualDepreciation = Math.min(proRataDepreciation, maxDepreciation);

  const totalDepreciationClaimed = totalPriorDepreciation + actualDepreciation;
  const remainingValue = asset.constructionCost - totalDepreciationClaimed;
  const yearsRemaining = remainingValue > 0 && annualDepreciation > 0
    ? Math.ceil(remainingValue / annualDepreciation)
    : 0;

  return {
    assetId: asset.id,
    assetName: asset.name,
    financialYear: fyString,
    constructionCost: asset.constructionCost,
    rate,
    annualDepreciation,
    proRataDepreciation: actualDepreciation,
    totalDepreciationClaimed,
    remainingValue,
    yearsRemaining
  };
}

/**
 * Calculate Division 43 depreciation schedule for multiple years.
 *
 * @param asset - Capital works asset
 * @param startFY - Starting financial year
 * @param years - Number of years to calculate
 * @returns Array of yearly depreciation results
 */
export function calculateDiv43Schedule(
  asset: Div43Asset,
  startFY: string,
  years: number
): Div43DepreciationResult[] {
  const results: Div43DepreciationResult[] = [];
  let totalPriorDepreciation = 0;
  let fyStartYear = parseInt(startFY.split('-')[0]);

  for (let i = 0; i < years; i++) {
    const fyString = `${fyStartYear + i}-${((fyStartYear + i + 1) % 100).toString().padStart(2, '0')}`;
    const result = calculateDiv43Depreciation(asset, fyString, totalPriorDepreciation);
    results.push(result);
    totalPriorDepreciation = result.totalDepreciationClaimed;

    // Stop if fully depreciated
    if (result.remainingValue <= 0) break;
  }

  return results;
}

// =============================================================================
// BALANCING ADJUSTMENT
// =============================================================================

/**
 * Calculate balancing adjustment when property is sold.
 * Unlike Div 40, there's no depreciation clawback for Div 43.
 * The undeducted cost is added to the cost base for CGT purposes.
 *
 * @param asset - Capital works asset
 * @param totalDepreciationClaimed - Total depreciation claimed
 * @param saleProceeds - Allocation of sale to Div 43 improvements
 * @returns Balancing adjustment result
 */
export function calculateDiv43BalancingAdjustment(
  asset: Div43Asset,
  totalDepreciationClaimed: number,
  saleProceeds: number
): Div43BalancingAdjustment {
  const undeductedCost = asset.constructionCost - totalDepreciationClaimed;

  // For Div 43, there's generally no assessable balancing adjustment
  // The undeducted amount is included in the cost base for CGT
  // A deduction may be available if there's a loss

  const balancingAdjustment = Math.max(0, undeductedCost - saleProceeds);

  return {
    assetId: asset.id,
    assetName: asset.name,
    originalCost: asset.constructionCost,
    totalDepreciationClaimed,
    undeductedCost,
    saleProceeds,
    balancingAdjustment,
    isDeduction: balancingAdjustment > 0
  };
}

// =============================================================================
// SPECIAL BUILDING TYPES
// =============================================================================

/**
 * Check if building qualifies for short-life treatment.
 * Some buildings have accelerated write-off periods.
 *
 * @param buildingType - Type of building
 * @returns Special rate if applicable, null otherwise
 */
export function getSpecialBuildingRate(buildingType: string): number | null {
  const specialRates: Record<string, number> = {
    'TRAVELLER_ACCOMMODATION': 0.025,
    'INDUSTRIAL_BUILDING': 0.025,
    'STRUCTURAL_IMPROVEMENT': 0.025,
  };

  return specialRates[buildingType] || null;
}

/**
 * Calculate construction cost allocation for mixed-use property.
 * When property is used partly for income-producing purposes.
 *
 * @param totalConstructionCost - Total cost
 * @param incomeProducingPercent - Percentage used for income (0-100)
 * @returns Deductible construction cost
 */
export function calculateMixedUseAllocation(
  totalConstructionCost: number,
  incomeProducingPercent: number
): number {
  return totalConstructionCost * (Math.min(100, Math.max(0, incomeProducingPercent)) / 100);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Estimate remaining Division 43 deductions for a property.
 *
 * @param originalCost - Original construction cost
 * @param constructionDate - Date of construction
 * @param purchaseDate - Date property was purchased
 * @returns Estimated remaining deductions
 */
export function estimateRemainingDiv43(
  originalCost: number,
  constructionDate: Date,
  purchaseDate: Date
): number {
  const rate = getDiv43Rate(constructionDate);
  if (rate === 0) return 0;

  const life = getDiv43Life(rate);
  const annualDepreciation = originalCost * rate;

  // Years since construction
  const yearsSinceConstruction = (purchaseDate.getTime() - constructionDate.getTime()) /
    (365.25 * 24 * 60 * 60 * 1000);

  // Already depreciated amount (by prior owners)
  const alreadyDepreciated = Math.min(annualDepreciation * yearsSinceConstruction, originalCost);

  return Math.max(0, originalCost - alreadyDepreciated);
}

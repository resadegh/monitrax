/**
 * Monitrax Division 40 Depreciation Engine
 * Phase 4 - Plant & Equipment Depreciation
 *
 * Implements ATO Division 40 rules for depreciating plant and equipment
 * in investment properties.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface Div40Asset {
  id: string;
  name: string;
  cost: number;
  acquisitionDate: Date;
  effectiveLife: number; // Years
  method: 'PRIME_COST' | 'DIMINISHING_VALUE';
  openingWrittenDownValue?: number;
  isLowValuePool?: boolean;
}

export interface Div40DepreciationResult {
  assetId: string;
  assetName: string;
  financialYear: string;
  openingWDV: number;
  depreciation: number;
  closingWDV: number;
  rate: number;
  method: string;
  daysHeld: number;
  isFullYear: boolean;
}

export interface Div40BalancingAdjustment {
  assetId: string;
  assetName: string;
  terminationValue: number;
  adjustableValue: number;
  balancingAdjustment: number;
  isIncome: boolean; // true = assessable income, false = deduction
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Diminishing value rate multiplier
export const DV_MULTIPLIER = 2.0; // 200% for assets acquired after 10 May 2006

// Low value pool threshold
export const LOW_VALUE_POOL_THRESHOLD = 1000;
export const IMMEDIATE_DEDUCTION_THRESHOLD = 300;

// Low value pool rate
export const LOW_VALUE_POOL_RATE = 0.375; // 37.5%

// Financial year (Australian)
export const FY_START_MONTH = 6; // July (0-indexed)
export const FY_START_DAY = 1;

// =============================================================================
// PRIME COST METHOD
// =============================================================================

/**
 * Calculate prime cost depreciation rate.
 * Rate = 100% / Effective Life
 *
 * @param effectiveLife - Effective life in years
 * @returns Annual rate as decimal
 */
export function calculatePrimeCostRate(effectiveLife: number): number {
  if (effectiveLife <= 0) return 0;
  return 1 / effectiveLife;
}

/**
 * Calculate prime cost depreciation for a period.
 * Depreciation = Cost × Rate × (Days held / Days in year)
 *
 * @param cost - Original cost of asset
 * @param effectiveLife - Effective life in years
 * @param daysHeld - Days held in the financial year
 * @param daysInYear - Days in the financial year (365 or 366)
 * @returns Depreciation amount
 */
export function calculatePrimeCostDepreciation(
  cost: number,
  effectiveLife: number,
  daysHeld: number,
  daysInYear: number = 365
): number {
  const rate = calculatePrimeCostRate(effectiveLife);
  const proRataFactor = daysHeld / daysInYear;
  return cost * rate * proRataFactor;
}

// =============================================================================
// DIMINISHING VALUE METHOD
// =============================================================================

/**
 * Calculate diminishing value depreciation rate.
 * Rate = (200% / Effective Life) for assets acquired after 10 May 2006
 *
 * @param effectiveLife - Effective life in years
 * @returns Annual rate as decimal
 */
export function calculateDiminishingValueRate(effectiveLife: number): number {
  if (effectiveLife <= 0) return 0;
  return DV_MULTIPLIER / effectiveLife;
}

/**
 * Calculate diminishing value depreciation for a period.
 * Depreciation = Opening WDV × Rate × (Days held / Days in year)
 *
 * @param openingWDV - Opening written down value
 * @param effectiveLife - Effective life in years
 * @param daysHeld - Days held in the financial year
 * @param daysInYear - Days in the financial year
 * @returns Depreciation amount
 */
export function calculateDiminishingValueDepreciation(
  openingWDV: number,
  effectiveLife: number,
  daysHeld: number,
  daysInYear: number = 365
): number {
  const rate = calculateDiminishingValueRate(effectiveLife);
  const proRataFactor = daysHeld / daysInYear;
  return openingWDV * rate * proRataFactor;
}

// =============================================================================
// FINANCIAL YEAR HELPERS
// =============================================================================

/**
 * Get Australian financial year for a date.
 *
 * @param date - Date to check
 * @returns Financial year string (e.g., "2024-25")
 */
export function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();

  // FY starts July 1
  if (month >= FY_START_MONTH) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
}

/**
 * Get financial year start and end dates.
 *
 * @param fyString - Financial year string (e.g., "2024-25")
 * @returns Start and end dates
 */
export function getFYDates(fyString: string): { start: Date; end: Date } {
  const startYear = parseInt(fyString.split('-')[0]);
  return {
    start: new Date(startYear, FY_START_MONTH, FY_START_DAY),
    end: new Date(startYear + 1, FY_START_MONTH, FY_START_DAY - 1, 23, 59, 59)
  };
}

/**
 * Calculate days held in a financial year.
 *
 * @param acquisitionDate - Date asset was acquired
 * @param fyString - Financial year
 * @param disposalDate - Date asset was disposed (optional)
 * @returns Days held in the FY
 */
export function calculateDaysHeldInFY(
  acquisitionDate: Date,
  fyString: string,
  disposalDate?: Date
): number {
  const { start: fyStart, end: fyEnd } = getFYDates(fyString);

  const startDate = acquisitionDate > fyStart ? acquisitionDate : fyStart;
  const endDate = disposalDate && disposalDate < fyEnd ? disposalDate : fyEnd;

  if (startDate > endDate) return 0;

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
}

// =============================================================================
// COMPREHENSIVE DEPRECIATION CALCULATION
// =============================================================================

/**
 * Calculate Division 40 depreciation for an asset in a financial year.
 *
 * @param asset - Asset details
 * @param fyString - Financial year (e.g., "2024-25")
 * @param disposalDate - Disposal date if sold during year
 * @returns Depreciation result
 */
export function calculateDiv40Depreciation(
  asset: Div40Asset,
  fyString: string,
  disposalDate?: Date
): Div40DepreciationResult {
  const { start: fyStart, end: fyEnd } = getFYDates(fyString);
  const daysInYear = 365; // Simplified

  // Check if asset was held at all during this FY
  if (asset.acquisitionDate > fyEnd) {
    return {
      assetId: asset.id,
      assetName: asset.name,
      financialYear: fyString,
      openingWDV: asset.cost,
      depreciation: 0,
      closingWDV: asset.cost,
      rate: 0,
      method: asset.method,
      daysHeld: 0,
      isFullYear: false
    };
  }

  const daysHeld = calculateDaysHeldInFY(asset.acquisitionDate, fyString, disposalDate);
  const isFullYear = daysHeld >= 365;

  // Calculate opening WDV
  let openingWDV = asset.openingWrittenDownValue ?? asset.cost;

  // For first year, opening WDV is cost
  const acquisitionFY = getFinancialYear(asset.acquisitionDate);
  if (fyString === acquisitionFY) {
    openingWDV = asset.cost;
  }

  let depreciation: number;
  let rate: number;

  if (asset.method === 'DIMINISHING_VALUE') {
    rate = calculateDiminishingValueRate(asset.effectiveLife);
    depreciation = calculateDiminishingValueDepreciation(openingWDV, asset.effectiveLife, daysHeld, daysInYear);
  } else {
    rate = calculatePrimeCostRate(asset.effectiveLife);
    depreciation = calculatePrimeCostDepreciation(asset.cost, asset.effectiveLife, daysHeld, daysInYear);
  }

  // Don't depreciate below zero
  depreciation = Math.min(depreciation, openingWDV);
  const closingWDV = openingWDV - depreciation;

  return {
    assetId: asset.id,
    assetName: asset.name,
    financialYear: fyString,
    openingWDV,
    depreciation,
    closingWDV,
    rate,
    method: asset.method,
    daysHeld,
    isFullYear
  };
}

// =============================================================================
// BALANCING ADJUSTMENT
// =============================================================================

/**
 * Calculate balancing adjustment when asset is sold or scrapped.
 *
 * Balancing adjustment = Termination value - Adjustable value
 * If positive: Assessable income (depreciation clawback)
 * If negative: Deduction
 *
 * @param asset - Asset details
 * @param terminationValue - Sale proceeds (0 if scrapped)
 * @param writtenDownValue - Current written down value
 * @returns Balancing adjustment result
 */
export function calculateBalancingAdjustment(
  asset: Div40Asset,
  terminationValue: number,
  writtenDownValue: number
): Div40BalancingAdjustment {
  // Adjustable value is the WDV at time of disposal
  const adjustableValue = writtenDownValue;

  // Balancing adjustment
  const balancingAdjustment = terminationValue - adjustableValue;

  return {
    assetId: asset.id,
    assetName: asset.name,
    terminationValue,
    adjustableValue,
    balancingAdjustment: Math.abs(balancingAdjustment),
    isIncome: balancingAdjustment > 0
  };
}

// =============================================================================
// LOW VALUE POOL
// =============================================================================

/**
 * Calculate low value pool depreciation.
 * Rate: 37.5% in first year asset added, 37.5% in subsequent years
 *
 * @param openingBalance - Opening pool balance
 * @param additionsFirstYear - Low value assets added this year
 * @param additionsSubsequent - Assets transferred from normal depreciation
 * @returns Depreciation and closing balance
 */
export function calculateLowValuePoolDepreciation(
  openingBalance: number,
  additionsFirstYear: number,
  additionsSubsequent: number
): { depreciation: number; closingBalance: number } {
  // First year additions get half-rate in year of acquisition
  const firstYearDepreciation = additionsFirstYear * (LOW_VALUE_POOL_RATE / 2);

  // Subsequent additions and opening balance get full rate
  const subsequentDepreciation = (openingBalance + additionsSubsequent) * LOW_VALUE_POOL_RATE;

  const totalDepreciation = firstYearDepreciation + subsequentDepreciation;
  const closingBalance = openingBalance + additionsFirstYear + additionsSubsequent - totalDepreciation;

  return {
    depreciation: totalDepreciation,
    closingBalance: Math.max(0, closingBalance)
  };
}

/**
 * Check if asset qualifies for low value pool.
 *
 * @param cost - Cost of asset
 * @param writtenDownValue - Current WDV (for existing assets)
 * @returns Whether asset can be pooled
 */
export function canAddToLowValuePool(cost: number, writtenDownValue?: number): boolean {
  // New assets under $1,000 can be pooled
  if (writtenDownValue === undefined) {
    return cost < LOW_VALUE_POOL_THRESHOLD;
  }

  // Existing assets with WDV under $1,000 can be pooled
  return writtenDownValue < LOW_VALUE_POOL_THRESHOLD;
}

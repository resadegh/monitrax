/**
 * Monitrax Depreciation Engine
 * Phase 3 Foundation - Australian Tax Rules
 *
 * Implements depreciation calculations for investment properties
 * following ATO Division 40 and Division 43 rules.
 *
 * Division 40: Plant and equipment (diminishing value or prime cost)
 * Division 43: Capital works (building structure at 2.5% or 4%)
 */

import { DepreciationSchedule } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface DepreciationResult {
  scheduleId: string;
  assetName: string;
  category: 'DIV40' | 'DIV43';
  method: 'PRIME_COST' | 'DIMINISHING_VALUE';
  originalCost: number;
  currentWrittenDownValue: number;
  annualDepreciation: number;
  dailyDepreciation: number;
  totalDepreciationClaimed: number;
  yearsRemaining: number;
}

export interface PropertyDepreciationSummary {
  propertyId: string;
  totalDiv40Depreciation: number;
  totalDiv43Depreciation: number;
  totalAnnualDepreciation: number;
  schedules: DepreciationResult[];
}

export interface DepreciationForecast {
  year: number;
  annualAmount: number;
  cumulativeAmount: number;
  writtenDownValue: number;
}

// =============================================================================
// AUSTRALIAN DEPRECIATION CONSTANTS
// =============================================================================

// Division 43 standard rates
export const DIV43_RATE_POST_1987 = 0.025; // 2.5% for buildings constructed after 15 Sep 1987
export const DIV43_RATE_PRE_1987 = 0.04; // 4% for buildings constructed between 18 Jul 1985 and 15 Sep 1987

// Diminishing value multiplier (for Division 40)
export const DIMINISHING_VALUE_MULTIPLIER = 2.0; // 200% diminishing value method

// Days in year for pro-rata calculations
export const DAYS_IN_YEAR = 365;

// =============================================================================
// ANNUAL DEPRECIATION CALCULATION
// =============================================================================

/**
 * Calculate annual depreciation for a single asset.
 *
 * For Division 40 (Plant & Equipment):
 * - Prime Cost: cost × rate
 * - Diminishing Value: opening WDV × rate × 2
 *
 * For Division 43 (Capital Works):
 * - Always prime cost at 2.5% (post-1987) or 4% (1985-1987)
 *
 * @param schedule - The depreciation schedule
 * @param asOfDate - Date to calculate depreciation as of (defaults to now)
 * @returns Depreciation calculation result
 */
export function calculateDepreciationAnnual(
  schedule: Pick<DepreciationSchedule, 'id' | 'assetName' | 'category' | 'cost' | 'startDate' | 'rate' | 'method'>,
  asOfDate: Date = new Date()
): DepreciationResult {
  const startDate = new Date(schedule.startDate);
  const yearsElapsed = calculateYearsElapsed(startDate, asOfDate);

  let currentWrittenDownValue: number;
  let annualDepreciation: number;
  let totalDepreciationClaimed: number;

  const rate = schedule.rate / 100; // Convert percentage to decimal

  if (schedule.method === 'DIMINISHING_VALUE' && schedule.category === 'DIV40') {
    // Diminishing value method - Division 40 only
    const effectiveRate = rate * DIMINISHING_VALUE_MULTIPLIER;
    currentWrittenDownValue = schedule.cost * Math.pow(1 - effectiveRate, yearsElapsed);
    annualDepreciation = currentWrittenDownValue * effectiveRate;
    totalDepreciationClaimed = schedule.cost - currentWrittenDownValue;
  } else {
    // Prime cost method (Division 40 and Division 43)
    annualDepreciation = schedule.cost * rate;
    totalDepreciationClaimed = Math.min(annualDepreciation * yearsElapsed, schedule.cost);
    currentWrittenDownValue = Math.max(0, schedule.cost - totalDepreciationClaimed);
  }

  // Calculate years remaining until fully depreciated
  const yearsRemaining =
    currentWrittenDownValue > 0 && annualDepreciation > 0
      ? Math.ceil(currentWrittenDownValue / annualDepreciation)
      : 0;

  const dailyDepreciation = annualDepreciation / DAYS_IN_YEAR;

  return {
    scheduleId: schedule.id,
    assetName: schedule.assetName,
    category: schedule.category,
    method: schedule.method,
    originalCost: schedule.cost,
    currentWrittenDownValue,
    annualDepreciation,
    dailyDepreciation,
    totalDepreciationClaimed,
    yearsRemaining,
  };
}

// =============================================================================
// PROPERTY DEPRECIATION SUMMARY
// =============================================================================

/**
 * Calculate total depreciation for a property across all schedules.
 *
 * @param propertyId - The property ID
 * @param schedules - Array of depreciation schedules for the property
 * @param asOfDate - Date to calculate depreciation as of
 * @returns Property depreciation summary
 */
export function calculatePropertyDepreciation(
  propertyId: string,
  schedules: Array<Pick<DepreciationSchedule, 'id' | 'assetName' | 'category' | 'cost' | 'startDate' | 'rate' | 'method'>>,
  asOfDate: Date = new Date()
): PropertyDepreciationSummary {
  const results = schedules.map((schedule) => calculateDepreciationAnnual(schedule, asOfDate));

  const totalDiv40Depreciation = results
    .filter((r) => r.category === 'DIV40')
    .reduce((sum, r) => sum + r.annualDepreciation, 0);

  const totalDiv43Depreciation = results
    .filter((r) => r.category === 'DIV43')
    .reduce((sum, r) => sum + r.annualDepreciation, 0);

  return {
    propertyId,
    totalDiv40Depreciation,
    totalDiv43Depreciation,
    totalAnnualDepreciation: totalDiv40Depreciation + totalDiv43Depreciation,
    schedules: results,
  };
}

// =============================================================================
// DEPRECIATION FORECAST
// =============================================================================

/**
 * Generate a multi-year depreciation forecast for a schedule.
 *
 * @param schedule - The depreciation schedule
 * @param years - Number of years to forecast
 * @returns Array of yearly depreciation forecasts
 */
export function generateDepreciationForecast(
  schedule: Pick<DepreciationSchedule, 'id' | 'assetName' | 'category' | 'cost' | 'startDate' | 'rate' | 'method'>,
  years: number = 10
): DepreciationForecast[] {
  const forecasts: DepreciationForecast[] = [];
  const rate = schedule.rate / 100;
  let writtenDownValue = schedule.cost;
  let cumulativeAmount = 0;

  for (let year = 1; year <= years && writtenDownValue > 0; year++) {
    let annualAmount: number;

    if (schedule.method === 'DIMINISHING_VALUE' && schedule.category === 'DIV40') {
      const effectiveRate = rate * DIMINISHING_VALUE_MULTIPLIER;
      annualAmount = writtenDownValue * effectiveRate;
    } else {
      annualAmount = Math.min(schedule.cost * rate, writtenDownValue);
    }

    writtenDownValue = Math.max(0, writtenDownValue - annualAmount);
    cumulativeAmount += annualAmount;

    forecasts.push({
      year,
      annualAmount,
      cumulativeAmount,
      writtenDownValue,
    });
  }

  return forecasts;
}

// =============================================================================
// PRO-RATA CALCULATION
// =============================================================================

/**
 * Calculate pro-rata depreciation for a partial year.
 *
 * @param annualDepreciation - Full year depreciation amount
 * @param startDate - Date the asset was acquired or depreciation started
 * @param endDate - End of the financial year (typically 30 June in Australia)
 * @returns Pro-rata depreciation amount
 */
export function calculateProRataDepreciation(
  annualDepreciation: number,
  startDate: Date,
  endDate: Date
): number {
  const daysHeld = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const proRataFactor = Math.min(daysHeld / DAYS_IN_YEAR, 1);
  return annualDepreciation * proRataFactor;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate the number of full years elapsed since a start date.
 */
function calculateYearsElapsed(startDate: Date, asOfDate: Date): number {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const elapsed = asOfDate.getTime() - startDate.getTime();
  return Math.max(0, Math.floor(elapsed / msPerYear));
}

/**
 * Determine the appropriate Division 43 rate based on construction date.
 *
 * @param constructionDate - Date the building was constructed
 * @returns Appropriate depreciation rate
 */
export function getDiv43Rate(constructionDate: Date): number {
  const cutoffDate = new Date('1987-09-15');
  const earliestDate = new Date('1985-07-18');

  if (constructionDate >= cutoffDate) {
    return DIV43_RATE_POST_1987; // 2.5%
  } else if (constructionDate >= earliestDate) {
    return DIV43_RATE_PRE_1987; // 4%
  }

  return 0; // No depreciation for buildings constructed before 18 Jul 1985
}

/**
 * Monitrax Depreciation Schedule Engine
 * Phase 4 - Combined Depreciation Schedule Generator
 *
 * Aggregates Division 40 and Division 43 depreciation into
 * comprehensive property depreciation schedules.
 */

import { Div40Asset, calculateDiv40Depreciation, calculateBalancingAdjustment, getFinancialYear } from './div40';
import { Div43Asset, calculateDiv43Depreciation } from './div43';

// =============================================================================
// TYPES
// =============================================================================

export interface PropertyDepreciationSchedule {
  propertyId: string;
  propertyName: string;
  financialYear: string;
  div40Assets: Div40AssetSchedule[];
  div43Assets: Div43AssetSchedule[];
  totalDiv40Depreciation: number;
  totalDiv43Depreciation: number;
  totalDepreciation: number;
  taxSavingAt32_5Percent: number;
  taxSavingAt37Percent: number;
  taxSavingAt45Percent: number;
}

export interface Div40AssetSchedule {
  assetId: string;
  assetName: string;
  originalCost: number;
  openingWDV: number;
  depreciation: number;
  closingWDV: number;
  effectiveLife: number;
  method: string;
}

export interface Div43AssetSchedule {
  assetId: string;
  assetName: string;
  constructionCost: number;
  rate: number;
  depreciation: number;
  totalClaimed: number;
  remainingValue: number;
}

export interface MultiYearSchedule {
  propertyId: string;
  propertyName: string;
  schedules: PropertyDepreciationSchedule[];
  totalDepreciationAllYears: number;
  totalTaxSavingAt37Percent: number;
}

export interface PropertyAssets {
  propertyId: string;
  propertyName: string;
  div40Assets: Div40Asset[];
  div43Assets: Div43Asset[];
  div40WDVs?: Map<string, number>; // Asset ID to current WDV
  div43TotalClaimed?: Map<string, number>; // Asset ID to total claimed
}

// =============================================================================
// TAX RATES FOR SAVINGS CALCULATION
// =============================================================================

export const TAX_RATE_32_5 = 0.325;
export const TAX_RATE_37 = 0.37;
export const TAX_RATE_45 = 0.45;

// =============================================================================
// SCHEDULE GENERATION
// =============================================================================

/**
 * Generate depreciation schedule for a property for a single financial year.
 *
 * @param assets - Property assets including Div 40 and Div 43
 * @param fyString - Financial year
 * @returns Property depreciation schedule
 */
export function generatePropertySchedule(
  assets: PropertyAssets,
  fyString: string
): PropertyDepreciationSchedule {
  const div40Schedules: Div40AssetSchedule[] = [];
  const div43Schedules: Div43AssetSchedule[] = [];
  let totalDiv40 = 0;
  let totalDiv43 = 0;

  // Process Division 40 assets
  for (const asset of assets.div40Assets) {
    const openingWDV = assets.div40WDVs?.get(asset.id) ?? asset.cost;
    const assetWithWDV = { ...asset, openingWrittenDownValue: openingWDV };
    const result = calculateDiv40Depreciation(assetWithWDV, fyString);

    div40Schedules.push({
      assetId: asset.id,
      assetName: asset.name,
      originalCost: asset.cost,
      openingWDV: result.openingWDV,
      depreciation: result.depreciation,
      closingWDV: result.closingWDV,
      effectiveLife: asset.effectiveLife,
      method: asset.method
    });

    totalDiv40 += result.depreciation;
  }

  // Process Division 43 assets
  for (const asset of assets.div43Assets) {
    const totalClaimed = assets.div43TotalClaimed?.get(asset.id) ?? 0;
    const result = calculateDiv43Depreciation(asset, fyString, totalClaimed);

    div43Schedules.push({
      assetId: asset.id,
      assetName: asset.name,
      constructionCost: asset.constructionCost,
      rate: result.rate,
      depreciation: result.proRataDepreciation,
      totalClaimed: result.totalDepreciationClaimed,
      remainingValue: result.remainingValue
    });

    totalDiv43 += result.proRataDepreciation;
  }

  const totalDepreciation = totalDiv40 + totalDiv43;

  return {
    propertyId: assets.propertyId,
    propertyName: assets.propertyName,
    financialYear: fyString,
    div40Assets: div40Schedules,
    div43Assets: div43Schedules,
    totalDiv40Depreciation: totalDiv40,
    totalDiv43Depreciation: totalDiv43,
    totalDepreciation,
    taxSavingAt32_5Percent: totalDepreciation * TAX_RATE_32_5,
    taxSavingAt37Percent: totalDepreciation * TAX_RATE_37,
    taxSavingAt45Percent: totalDepreciation * TAX_RATE_45
  };
}

/**
 * Generate multi-year depreciation schedule for a property.
 *
 * @param assets - Property assets
 * @param startFY - Starting financial year
 * @param years - Number of years to project
 * @returns Multi-year schedule
 */
export function generateMultiYearSchedule(
  assets: PropertyAssets,
  startFY: string,
  years: number
): MultiYearSchedule {
  const schedules: PropertyDepreciationSchedule[] = [];
  let totalDepreciationAllYears = 0;
  let totalTaxSavingAt37 = 0;

  // Track WDVs and total claimed across years
  const div40WDVs = new Map<string, number>(assets.div40WDVs || []);
  const div43TotalClaimed = new Map<string, number>(assets.div43TotalClaimed || []);

  // Initialize if not provided
  for (const asset of assets.div40Assets) {
    if (!div40WDVs.has(asset.id)) {
      div40WDVs.set(asset.id, asset.cost);
    }
  }
  for (const asset of assets.div43Assets) {
    if (!div43TotalClaimed.has(asset.id)) {
      div43TotalClaimed.set(asset.id, 0);
    }
  }

  let fyStartYear = parseInt(startFY.split('-')[0]);

  for (let i = 0; i < years; i++) {
    const fyString = `${fyStartYear + i}-${((fyStartYear + i + 1) % 100).toString().padStart(2, '0')}`;

    const currentAssets: PropertyAssets = {
      ...assets,
      div40WDVs,
      div43TotalClaimed
    };

    const schedule = generatePropertySchedule(currentAssets, fyString);
    schedules.push(schedule);

    totalDepreciationAllYears += schedule.totalDepreciation;
    totalTaxSavingAt37 += schedule.taxSavingAt37Percent;

    // Update WDVs for next year
    for (const div40 of schedule.div40Assets) {
      div40WDVs.set(div40.assetId, div40.closingWDV);
    }
    for (const div43 of schedule.div43Assets) {
      div43TotalClaimed.set(div43.assetId, div43.totalClaimed);
    }
  }

  return {
    propertyId: assets.propertyId,
    propertyName: assets.propertyName,
    schedules,
    totalDepreciationAllYears,
    totalTaxSavingAt37Percent: totalTaxSavingAt37
  };
}

// =============================================================================
// SUMMARY FUNCTIONS
// =============================================================================

/**
 * Calculate total depreciation for all properties in a financial year.
 *
 * @param propertySchedules - Array of property schedules
 * @returns Total depreciation summary
 */
export function calculateTotalDepreciation(
  propertySchedules: PropertyDepreciationSchedule[]
): {
  totalDiv40: number;
  totalDiv43: number;
  grandTotal: number;
  byProperty: Array<{ propertyId: string; propertyName: string; total: number }>;
} {
  let totalDiv40 = 0;
  let totalDiv43 = 0;
  const byProperty: Array<{ propertyId: string; propertyName: string; total: number }> = [];

  for (const schedule of propertySchedules) {
    totalDiv40 += schedule.totalDiv40Depreciation;
    totalDiv43 += schedule.totalDiv43Depreciation;
    byProperty.push({
      propertyId: schedule.propertyId,
      propertyName: schedule.propertyName,
      total: schedule.totalDepreciation
    });
  }

  return {
    totalDiv40,
    totalDiv43,
    grandTotal: totalDiv40 + totalDiv43,
    byProperty
  };
}

/**
 * Calculate depreciation clawback on property sale.
 *
 * @param assets - Property assets
 * @param saleDate - Date of sale
 * @param div40Proceeds - Allocation of sale to Div 40 assets
 * @param currentWDVs - Current WDV for each Div 40 asset
 * @returns Total balancing adjustment
 */
export function calculateSaleBalancingAdjustments(
  assets: PropertyAssets,
  saleDate: Date,
  div40Proceeds: Map<string, number>,
  currentWDVs: Map<string, number>
): {
  totalClawback: number;
  totalDeduction: number;
  netAdjustment: number;
  byAsset: Array<{
    assetId: string;
    assetName: string;
    adjustment: number;
    isIncome: boolean;
  }>;
} {
  let totalClawback = 0;
  let totalDeduction = 0;
  const byAsset: Array<{
    assetId: string;
    assetName: string;
    adjustment: number;
    isIncome: boolean;
  }> = [];

  for (const asset of assets.div40Assets) {
    const proceeds = div40Proceeds.get(asset.id) || 0;
    const wdv = currentWDVs.get(asset.id) || 0;

    const result = calculateBalancingAdjustment(asset, proceeds, wdv);

    if (result.isIncome) {
      totalClawback += result.balancingAdjustment;
    } else {
      totalDeduction += result.balancingAdjustment;
    }

    byAsset.push({
      assetId: asset.id,
      assetName: asset.name,
      adjustment: result.balancingAdjustment,
      isIncome: result.isIncome
    });
  }

  return {
    totalClawback,
    totalDeduction,
    netAdjustment: totalClawback - totalDeduction,
    byAsset
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get current financial year string.
 *
 * @returns Current FY string (e.g., "2024-25")
 */
export function getCurrentFinancialYear(): string {
  return getFinancialYear(new Date());
}

/**
 * Estimate first year depreciation for a new property.
 *
 * @param purchasePrice - Property purchase price
 * @param constructionDate - Estimated construction date
 * @param buildingValuePercent - Percent of value attributable to building (typically 40-60%)
 * @returns Estimated first year depreciation
 */
export function estimateFirstYearDepreciation(
  purchasePrice: number,
  constructionDate: Date,
  buildingValuePercent: number = 40
): {
  estimatedDiv40: number;
  estimatedDiv43: number;
  total: number;
} {
  // Estimate building value (Div 43)
  const buildingValue = purchasePrice * (buildingValuePercent / 100);

  // Estimate plant & equipment (typically 10-15% of purchase price for new properties)
  const plantEquipmentValue = purchasePrice * 0.10;

  // Div 43: 2.5% of building value
  const div43 = buildingValue * 0.025;

  // Div 40: Average depreciation rate of ~15% for first year
  const div40 = plantEquipmentValue * 0.15;

  return {
    estimatedDiv40: div40,
    estimatedDiv43: div43,
    total: div40 + div43
  };
}

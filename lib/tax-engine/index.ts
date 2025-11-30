/**
 * Phase 20: Australian Tax Intelligence Engine
 * Main entry point and public API
 */

// Types
export * from './types';

// Configuration
export * from './config';

// Core calculators
export * from './core';

// Income processing
export * from './income';

// =============================================================================
// Convenience re-exports for common use cases
// =============================================================================

import { processSalary, getSalarySummary, calculateOptimalSalarySacrifice } from './income/salaryProcessor';
import { determineTaxability, calculateFrankingCredits, getTaxTreatmentSummary } from './income/taxabilityRules';
import { calculateIncomeTax, calculateMarginalTax, calculateDeductionSavings } from './core/incomeTaxCalculator';
import { calculateMedicareLevy, getMedicareSummary } from './core/medicareLevyCalculator';
import { calculatePAYG, getPAYGSummary, calculateGrossFromNet } from './core/paygCalculator';
import { calculateAllOffsets, calculateLITO, applyOffsets } from './core/taxOffsets';
import {
  getTaxYearConfig,
  getCurrentTaxYearConfig,
  getAvailableTaxYears,
  getMarginalRate,
  TAX_YEAR_2024_25
} from './config/taxYearConfig';

// Main API object for easy access
export const TaxEngine = {
  // Configuration
  getConfig: getTaxYearConfig,
  getCurrentConfig: getCurrentTaxYearConfig,
  getAvailableYears: getAvailableTaxYears,
  getMarginalRate,
  config: TAX_YEAR_2024_25,

  // Salary processing
  processSalary,
  getSalarySummary,
  calculateOptimalSalarySacrifice,

  // Income taxability
  determineTaxability,
  calculateFrankingCredits,
  getTaxTreatmentSummary,

  // Tax calculations
  calculateIncomeTax,
  calculateMarginalTax,
  calculateDeductionSavings,
  calculateMedicareLevy,
  getMedicareSummary,
  calculatePAYG,
  getPAYGSummary,
  calculateGrossFromNet,

  // Tax offsets
  calculateAllOffsets,
  calculateLITO,
  applyOffsets,
};

export default TaxEngine;

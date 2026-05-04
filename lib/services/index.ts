/**
 * Services Index
 *
 * ============================================================================
 * CRITICAL DESIGN PRINCIPLE: SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * All financial calculations MUST use the Master Financial Service.
 * This ensures consistent numbers across all pages and API endpoints.
 *
 * DO NOT calculate financial data directly in API routes.
 * DO NOT query database and aggregate manually.
 * DO use getMasterFinancialSnapshot() for all financial data needs.
 *
 * See: lib/services/masterFinancialService.ts
 * See: docs/ARCHITECTURE.md for design principles
 * ============================================================================
 */

// =============================================================================
// MASTER FINANCIAL SERVICE - PRIMARY API (USE THIS)
// =============================================================================

export {
  // Main function - gets complete financial snapshot
  getMasterFinancialSnapshot,

  // Convenience getters for specific data
  getNetWorth,
  getMonthlyCashflow,
  getQuickMetrics,
  getHealthScore,
  getTaxSummary,
  getPropertyMetrics,
  getInvestmentMetrics,

  // Types
  type MasterFinancialSnapshot,
  type MasterExpenseBreakdown,
  type MasterIncomeBreakdown,
  type PropertyMetrics,
  type InvestmentMetrics,
  type TaxSummary,
  type EmergencyFundMetrics,
  type HealthScoreMetrics,
} from './masterFinancialService';

// =============================================================================
// PHASE 41a/b — LEGAL ENTITY SERVICE
// =============================================================================

export {
  getDefaultLegalEntityId,
  listEntitiesForUser,
  createEntity,
  updateEntity,
  deleteEntity,
  EntityHasOwnedObjectsError,
  type LegalEntitySummary,
  type CreateEntityInput,
  type UpdateEntityInput,
} from './legalEntityService';

/**
 * MONITRAX LINKAGE HEALTH SERVICE
 * Phase 8 Task 10.7 - Linkage Health API
 *
 * Provides global relational integrity state derived from Snapshot 2.0.
 * NO direct database access - all metrics computed from snapshot output.
 */

import { GRDCSMissingLink } from '@/lib/grdcs';
import { SnapshotV2 } from './insightsEngine';

// =============================================================================
// TYPES
// =============================================================================

export interface HealthMetrics {
  orphanCount: number;
  missingCount: number;
  invalidLinks: number;
  completeness: number;
}

export interface ModuleBreakdown {
  properties: HealthMetrics;
  loans: HealthMetrics;
  accounts: HealthMetrics;
  offsetAccounts: HealthMetrics;
  income: HealthMetrics;
  expenses: HealthMetrics;
  investmentAccounts: HealthMetrics;
  holdings: HealthMetrics;
  transactions: HealthMetrics;
}

export interface LinkageHealthResponse {
  completenessScore: number;
  orphanCount: number;
  missingLinks: GRDCSMissingLink[];
  crossModuleConsistency: number;
  moduleBreakdown: ModuleBreakdown;
  severity: 'healthy' | 'warning' | 'high' | 'critical';
  generatedAt: string;
  cacheExpiresAt: string;
}

// =============================================================================
// CACHE
// =============================================================================

interface CacheEntry {
  data: LinkageHealthResponse;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds soft cache

function getCachedHealth(userId: string): LinkageHealthResponse | null {
  const entry = cache.get(userId);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }
  cache.delete(userId);
  return null;
}

function setCachedHealth(userId: string, data: LinkageHealthResponse): void {
  cache.set(userId, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// =============================================================================
// HEALTH METRICS CALCULATION
// =============================================================================

/**
 * Calculate HealthMetrics for properties module
 */
function calculatePropertyHealth(snapshot: SnapshotV2): HealthMetrics {
  const { moduleCompleteness, relationalInsights } = snapshot;
  const propertyData = moduleCompleteness.properties;

  // Count orphans and missing links from relational insights
  const propertyWarnings = [
    ...relationalInsights.errors,
    ...relationalInsights.warnings,
    ...relationalInsights.info,
  ].filter(w => w.entityType === 'property');

  const orphanCount = propertyWarnings.filter(w => w.category === 'orphan').length;
  const missingCount = propertyWarnings.filter(w =>
    w.category === 'missing_link' || w.category === 'completeness'
  ).length;
  const invalidLinks = propertyWarnings.filter(w => w.category === 'inconsistency').length;

  return {
    orphanCount,
    missingCount,
    invalidLinks,
    completeness: propertyData.score,
  };
}

/**
 * Calculate HealthMetrics for loans module
 */
function calculateLoanHealth(snapshot: SnapshotV2): HealthMetrics {
  const { moduleCompleteness, relationalInsights } = snapshot;
  const loanData = moduleCompleteness.loans;

  const loanWarnings = [
    ...relationalInsights.errors,
    ...relationalInsights.warnings,
  ].filter(w => w.entityType === 'loan');

  const orphanCount = loanWarnings.filter(w => w.category === 'orphan').length;
  const missingCount = loanWarnings.filter(w => w.category === 'missing_link').length;
  const invalidLinks = loanWarnings.filter(w => w.category === 'inconsistency').length;

  return {
    orphanCount,
    missingCount,
    invalidLinks,
    completeness: loanData.score,
  };
}

/**
 * Calculate HealthMetrics for accounts module
 */
function calculateAccountHealth(snapshot: SnapshotV2): HealthMetrics {
  const { moduleCompleteness, relationalInsights } = snapshot;
  const accountData = moduleCompleteness.accounts;

  const accountWarnings = [
    ...relationalInsights.errors,
    ...relationalInsights.warnings,
  ].filter(w => w.entityType === 'account');

  return {
    orphanCount: accountWarnings.filter(w => w.category === 'orphan').length,
    missingCount: accountWarnings.filter(w => w.category === 'missing_link').length,
    invalidLinks: accountWarnings.filter(w => w.category === 'inconsistency').length,
    completeness: accountData.score,
  };
}

/**
 * Calculate HealthMetrics for offset accounts (subset of accounts)
 */
function calculateOffsetAccountHealth(snapshot: SnapshotV2): HealthMetrics {
  // Offset accounts are tracked as part of loans linkage
  // Count loans that should have offsets but don't
  const loansWithoutOffset = snapshot.loans.filter(
    l => l.offsetBalance === 0 && l.principal > 100000
  ).length;

  return {
    orphanCount: 0,
    missingCount: loansWithoutOffset,
    invalidLinks: 0,
    completeness: snapshot.entityCounts.loans > 0
      ? Math.round(((snapshot.entityCounts.loans - loansWithoutOffset) / snapshot.entityCounts.loans) * 100)
      : 100,
  };
}

/**
 * Calculate HealthMetrics for income module
 */
function calculateIncomeHealth(snapshot: SnapshotV2): HealthMetrics {
  const { moduleCompleteness, relationalInsights } = snapshot;
  const incomeData = moduleCompleteness.income;

  const incomeWarnings = [
    ...relationalInsights.errors,
    ...relationalInsights.warnings,
  ].filter(w => w.entityType === 'income');

  return {
    orphanCount: incomeWarnings.filter(w => w.category === 'orphan').length,
    missingCount: incomeWarnings.filter(w => w.category === 'missing_link').length,
    invalidLinks: incomeWarnings.filter(w => w.category === 'inconsistency').length,
    completeness: incomeData.score,
  };
}

/**
 * Calculate HealthMetrics for expenses module
 */
function calculateExpenseHealth(snapshot: SnapshotV2): HealthMetrics {
  const { moduleCompleteness, relationalInsights } = snapshot;
  const expenseData = moduleCompleteness.expenses;

  const expenseWarnings = [
    ...relationalInsights.errors,
    ...relationalInsights.warnings,
  ].filter(w => w.entityType === 'expense');

  return {
    orphanCount: expenseWarnings.filter(w => w.category === 'orphan').length,
    missingCount: expenseWarnings.filter(w => w.category === 'missing_link').length,
    invalidLinks: expenseWarnings.filter(w => w.category === 'inconsistency').length,
    completeness: expenseData.score,
  };
}

/**
 * Calculate HealthMetrics for investment accounts module
 */
function calculateInvestmentAccountHealth(snapshot: SnapshotV2): HealthMetrics {
  const { moduleCompleteness, relationalInsights } = snapshot;
  const invAccountData = moduleCompleteness.investmentAccounts;

  const invAccountWarnings = [
    ...relationalInsights.errors,
    ...relationalInsights.warnings,
    ...relationalInsights.info,
  ].filter(w => w.entityType === 'investmentAccount');

  return {
    orphanCount: invAccountWarnings.filter(w => w.category === 'orphan').length,
    missingCount: invAccountWarnings.filter(w =>
      w.category === 'missing_link' || w.category === 'completeness'
    ).length,
    invalidLinks: invAccountWarnings.filter(w => w.category === 'inconsistency').length,
    completeness: invAccountData.score,
  };
}

/**
 * Calculate HealthMetrics for holdings module
 */
function calculateHoldingHealth(snapshot: SnapshotV2): HealthMetrics {
  const { moduleCompleteness, relationalInsights } = snapshot;
  const holdingData = moduleCompleteness.holdings;

  const holdingWarnings = [
    ...relationalInsights.errors,
    ...relationalInsights.warnings,
    ...relationalInsights.info,
  ].filter(w => w.entityType === 'investmentHolding');

  return {
    orphanCount: holdingWarnings.filter(w => w.category === 'orphan').length,
    missingCount: holdingWarnings.filter(w =>
      w.category === 'missing_link' || w.category === 'completeness'
    ).length,
    invalidLinks: holdingWarnings.filter(w => w.category === 'inconsistency').length,
    completeness: holdingData.score,
  };
}

/**
 * Calculate HealthMetrics for transactions module
 */
function calculateTransactionHealth(snapshot: SnapshotV2): HealthMetrics {
  const { moduleCompleteness, relationalInsights } = snapshot;
  const txData = moduleCompleteness.transactions;

  const txWarnings = [
    ...relationalInsights.errors,
    ...relationalInsights.warnings,
  ].filter(w => w.entityType === 'investmentTransaction');

  return {
    orphanCount: txWarnings.filter(w => w.category === 'orphan').length,
    missingCount: txWarnings.filter(w => w.category === 'missing_link').length,
    invalidLinks: txWarnings.filter(w => w.category === 'inconsistency').length,
    completeness: txData.score,
  };
}

/**
 * Determine overall severity based on Blueprint thresholds
 */
function calculateSeverity(
  orphanCount: number,
  totalEntities: number,
  missingLinkCount: number
): 'healthy' | 'warning' | 'high' | 'critical' {
  if (totalEntities === 0) return 'healthy';

  const orphanPercentage = (orphanCount / totalEntities) * 100;
  const missingPercentage = (missingLinkCount / totalEntities) * 100;

  // Blueprint rules:
  // - 25% orphans → severity "critical"
  // - 10% missing links → severity "high"
  if (orphanPercentage >= 25) return 'critical';
  if (missingPercentage >= 10 || orphanPercentage >= 10) return 'high';
  if (missingPercentage >= 5 || orphanPercentage >= 5) return 'warning';
  return 'healthy';
}

// =============================================================================
// MAIN SERVICE FUNCTION
// =============================================================================

/**
 * Calculate linkage health from Snapshot 2.0 data.
 * This is the main entry point for the Linkage Health Service.
 */
export function calculateLinkageHealth(snapshot: SnapshotV2): LinkageHealthResponse {
  // Check cache first
  const cached = getCachedHealth(snapshot.userId);
  if (cached) {
    return cached;
  }

  // Calculate module breakdown
  const moduleBreakdown: ModuleBreakdown = {
    properties: calculatePropertyHealth(snapshot),
    loans: calculateLoanHealth(snapshot),
    accounts: calculateAccountHealth(snapshot),
    offsetAccounts: calculateOffsetAccountHealth(snapshot),
    income: calculateIncomeHealth(snapshot),
    expenses: calculateExpenseHealth(snapshot),
    investmentAccounts: calculateInvestmentAccountHealth(snapshot),
    holdings: calculateHoldingHealth(snapshot),
    transactions: calculateTransactionHealth(snapshot),
  };

  // Calculate total orphans from module breakdown
  const totalOrphans = Object.values(moduleBreakdown).reduce(
    (sum, m) => sum + m.orphanCount,
    0
  );

  // Calculate total entities
  const totalEntities =
    snapshot.entityCounts.properties +
    snapshot.entityCounts.loans +
    snapshot.entityCounts.income +
    snapshot.entityCounts.expenses +
    snapshot.entityCounts.accounts +
    snapshot.entityCounts.investmentAccounts +
    snapshot.entityCounts.holdings +
    snapshot.entityCounts.transactions;

  // Calculate total missing links
  const totalMissingLinks = Object.values(moduleBreakdown).reduce(
    (sum, m) => sum + m.missingCount,
    0
  );

  // Determine severity
  const severity = calculateSeverity(totalOrphans, totalEntities, totalMissingLinks);

  // Build response
  const now = new Date();
  const response: LinkageHealthResponse = {
    completenessScore: snapshot.linkageHealth.completenessScore,
    orphanCount: snapshot.linkageHealth.orphanCount,
    missingLinks: snapshot.linkageHealth.missingLinks,
    crossModuleConsistency: snapshot.linkageHealth.crossModuleConsistency,
    moduleBreakdown,
    severity,
    generatedAt: now.toISOString(),
    cacheExpiresAt: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
  };

  // Cache the result
  setCachedHealth(snapshot.userId, response);

  return response;
}

/**
 * Clear cache for a specific user (useful after data mutations)
 */
export function clearLinkageHealthCache(userId: string): void {
  cache.delete(userId);
}

/**
 * Clear all cached health data
 */
export function clearAllLinkageHealthCache(): void {
  cache.clear();
}

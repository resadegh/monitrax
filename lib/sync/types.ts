/**
 * UI SYNC ENGINE TYPES
 * Phase 9 Task 9.4 - Real-Time Global Health Feed
 *
 * Type definitions and Zod schemas for the UI Sync Engine.
 */

import { z } from 'zod';
import { GRDCSEntityType, GRDCSMissingLink } from '@/lib/grdcs';

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

/**
 * Missing link schema
 */
export const MissingLinkSchema = z.object({
  type: z.string(),
  reason: z.string(),
  suggestedAction: z.string().optional(),
});

/**
 * Health metrics schema for module breakdown
 */
export const HealthMetricsSchema = z.object({
  orphanCount: z.number(),
  missingCount: z.number(),
  invalidLinks: z.number(),
  completeness: z.number(),
});

/**
 * Module breakdown schema
 */
export const ModuleBreakdownSchema = z.object({
  properties: HealthMetricsSchema,
  loans: HealthMetricsSchema,
  accounts: HealthMetricsSchema,
  offsetAccounts: HealthMetricsSchema,
  income: HealthMetricsSchema,
  expenses: HealthMetricsSchema,
  investmentAccounts: HealthMetricsSchema,
  holdings: HealthMetricsSchema,
  transactions: HealthMetricsSchema,
});

/**
 * Linkage health response schema
 */
export const LinkageHealthResponseSchema = z.object({
  completenessScore: z.number(),
  orphanCount: z.number(),
  missingLinks: z.array(MissingLinkSchema),
  crossModuleConsistency: z.number(),
  moduleBreakdown: ModuleBreakdownSchema,
  severity: z.enum(['healthy', 'warning', 'high', 'critical']),
  generatedAt: z.string(),
  cacheExpiresAt: z.string(),
});

/**
 * Insight item schema
 */
export const InsightItemSchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  affectedEntities: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    href: z.string(),
    summary: z.string().optional(),
    value: z.number().optional(),
  })),
  recommendedFix: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Insights summary schema
 */
export const InsightsSummarySchema = z.object({
  criticalCount: z.number(),
  highCount: z.number(),
  mediumCount: z.number(),
  lowCount: z.number(),
  totalCount: z.number(),
});

/**
 * Insights response schema
 */
export const InsightsResponseSchema = z.object({
  insights: z.array(InsightItemSchema),
  summary: InsightsSummarySchema,
});

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type HealthSeverity = 'healthy' | 'warning' | 'high' | 'critical';
export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Health metrics for a single module
 */
export interface HealthMetrics {
  orphanCount: number;
  missingCount: number;
  invalidLinks: number;
  completeness: number;
}

/**
 * Module breakdown for all entity types
 */
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

/**
 * Linkage health state from API
 */
export interface LinkageHealthState {
  completenessScore: number;
  orphanCount: number;
  missingLinks: GRDCSMissingLink[];
  crossModuleConsistency: number;
  moduleBreakdown: ModuleBreakdown;
  severity: HealthSeverity;
  generatedAt: string;
  cacheExpiresAt: string;
}

/**
 * Insight item from insights engine
 */
export interface InsightItem {
  id: string;
  severity: InsightSeverity;
  category: string;
  title: string;
  description: string;
  affectedEntities: Array<{
    id: string;
    type: string;
    name: string;
    href: string;
    summary?: string;
    value?: number;
  }>;
  recommendedFix: string;
  metadata?: Record<string, unknown>;
}

/**
 * Insights summary counts
 */
export interface InsightsSummary {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalCount: number;
}

/**
 * Full insights state
 */
export interface InsightsState {
  insights: InsightItem[];
  summary: InsightsSummary;
}

/**
 * Portfolio snapshot summary (subset of full snapshot for UI sync)
 */
export interface SnapshotSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyNetCashflow: number;
  savingsRate: number;
  portfolioLVR: number;
  entityCounts: {
    properties: number;
    loans: number;
    income: number;
    expenses: number;
    accounts: number;
    investmentAccounts: number;
    holdings: number;
    transactions: number;
  };
  linkageHealth: {
    completenessScore: number;
    orphanCount: number;
    missingLinks: GRDCSMissingLink[];
    crossModuleConsistency: number;
    warnings: string[];
  };
  generatedAt: string;
}

/**
 * Warning ribbon configuration
 */
export interface WarningRibbonConfig {
  show: boolean;
  severity: HealthSeverity;
  type: 'orphan' | 'missing_links' | 'consistency' | 'multiple';
  title: string;
  description: string;
  count?: number;
  score?: number;
}

/**
 * Entity warning for dialog banners
 */
export interface EntityWarning {
  type: 'missing_relation' | 'invalid_reference' | 'orphaned';
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestedAction?: string;
  relatedEntityType?: GRDCSEntityType;
}

/**
 * UI Sync Engine configuration
 */
export interface UISyncEngineConfig {
  /** Polling interval in milliseconds (default: 15000) */
  pollingInterval: number;
  /** Whether to enable polling (default: true) */
  enabled: boolean;
  /** Threshold for missing links warning (default: 3) */
  missingLinksThreshold: number;
  /** Threshold for consistency warning (default: 75) */
  consistencyThreshold: number;
  /** Enable analytics event emission (default: true) */
  emitAnalytics: boolean;
}

/**
 * UI Sync Engine state
 */
export interface UISyncEngineState {
  /** Current snapshot summary */
  snapshot: SnapshotSummary | null;
  /** Current linkage health */
  health: LinkageHealthState | null;
  /** Current insights */
  insights: InsightsState | null;
  /** Whether initial load is complete */
  isLoaded: boolean;
  /** Whether currently fetching */
  isFetching: boolean;
  /** Last fetch error */
  error: string | null;
  /** Last successful fetch timestamp */
  lastFetchedAt: string | null;
  /** Warning ribbon configuration */
  warningRibbon: WarningRibbonConfig;
}

/**
 * Analytics event types for Phase 11 preparation
 */
export type SyncAnalyticsEvent =
  | { type: 'sync_started' }
  | { type: 'sync_completed'; duration: number }
  | { type: 'sync_error'; error: string }
  | { type: 'health_changed'; from: HealthSeverity; to: HealthSeverity }
  | { type: 'warning_ribbon_shown'; config: WarningRibbonConfig }
  | { type: 'warning_ribbon_clicked' }
  | { type: 'insight_count_changed'; from: number; to: number };

/**
 * Default configuration values
 */
export const DEFAULT_SYNC_CONFIG: UISyncEngineConfig = {
  pollingInterval: 15000, // 15 seconds
  enabled: true,
  missingLinksThreshold: 3,
  consistencyThreshold: 75,
  emitAnalytics: true,
};

/**
 * Initial sync engine state
 */
export const INITIAL_SYNC_STATE: UISyncEngineState = {
  snapshot: null,
  health: null,
  insights: null,
  isLoaded: false,
  isFetching: false,
  error: null,
  lastFetchedAt: null,
  warningRibbon: {
    show: false,
    severity: 'healthy',
    type: 'orphan',
    title: '',
    description: '',
  },
};

'use client';

/**
 * UI SYNC ENGINE HOOK
 * Phase 9 Task 9.4 - Real-Time Global Health Feed
 *
 * Centralized polling engine that keeps the UI in sync with:
 * - Portfolio Snapshot
 * - Linkage Health
 * - Insights
 *
 * Features:
 * - Configurable polling interval (default: 15 seconds)
 * - Minimal-diff UI updates via deep comparison
 * - NavigationContext integration
 * - Analytics event emission (Phase 11 prep)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigationContext } from '@/contexts/NavigationContext';
import { useAuth } from '@/lib/context/AuthContext';
import {
  UISyncEngineState,
  UISyncEngineConfig,
  SnapshotSummary,
  LinkageHealthState,
  InsightsState,
  WarningRibbonConfig,
  SyncAnalyticsEvent,
  DEFAULT_SYNC_CONFIG,
  INITIAL_SYNC_STATE,
  HealthSeverity,
} from '@/lib/sync/types';

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Deep compare two objects for minimal-diff updates
 */
function hasChanged<T>(prev: T | null, next: T | null): boolean {
  if (prev === null && next === null) return false;
  if (prev === null || next === null) return true;
  return JSON.stringify(prev) !== JSON.stringify(next);
}

/**
 * Extract snapshot summary from full snapshot response
 */
function extractSnapshotSummary(snapshot: Record<string, unknown>): SnapshotSummary {
  return {
    netWorth: (snapshot.netWorth as number) || 0,
    totalAssets: (snapshot.totalAssets as number) || 0,
    totalLiabilities: (snapshot.totalLiabilities as number) || 0,
    monthlyNetCashflow: ((snapshot.cashflow as Record<string, number>)?.monthlyNetCashflow) || 0,
    savingsRate: ((snapshot.cashflow as Record<string, number>)?.savingsRate) || 0,
    portfolioLVR: ((snapshot.gearing as Record<string, number>)?.portfolioLVR) || 0,
    entityCounts: (snapshot.entityCounts as SnapshotSummary['entityCounts']) || {
      properties: 0,
      loans: 0,
      income: 0,
      expenses: 0,
      accounts: 0,
      investmentAccounts: 0,
      holdings: 0,
      transactions: 0,
    },
    linkageHealth: (snapshot.linkageHealth as SnapshotSummary['linkageHealth']) || {
      completenessScore: 100,
      orphanCount: 0,
      missingLinks: [],
      crossModuleConsistency: 100,
      warnings: [],
    },
    generatedAt: (snapshot.generatedAt as string) || new Date().toISOString(),
  };
}

/**
 * Calculate warning ribbon configuration from health state
 */
function calculateWarningRibbon(
  health: LinkageHealthState | null,
  snapshot: SnapshotSummary | null,
  config: UISyncEngineConfig
): WarningRibbonConfig {
  if (!health && !snapshot) {
    return {
      show: false,
      severity: 'healthy',
      type: 'orphan',
      title: '',
      description: '',
    };
  }

  const orphanCount = health?.orphanCount ?? snapshot?.linkageHealth.orphanCount ?? 0;
  const missingLinks = health?.missingLinks.length ?? snapshot?.linkageHealth.missingLinks.length ?? 0;
  const consistency = health?.crossModuleConsistency ?? snapshot?.linkageHealth.crossModuleConsistency ?? 100;

  const issues: Array<{
    type: WarningRibbonConfig['type'];
    severity: HealthSeverity;
    title: string;
    description: string;
    count?: number;
    score?: number;
  }> = [];

  // Check orphan count
  if (orphanCount > 0) {
    issues.push({
      type: 'orphan',
      severity: orphanCount > 5 ? 'high' : 'warning',
      title: `${orphanCount} Orphaned ${orphanCount === 1 ? 'Entity' : 'Entities'}`,
      description: `${orphanCount} ${orphanCount === 1 ? 'entity is' : 'entities are'} not properly linked`,
      count: orphanCount,
    });
  }

  // Check missing links threshold
  if (missingLinks > config.missingLinksThreshold) {
    issues.push({
      type: 'missing_links',
      severity: missingLinks > 10 ? 'high' : 'warning',
      title: `${missingLinks} Missing Links`,
      description: `${missingLinks} relationship${missingLinks === 1 ? '' : 's'} need attention`,
      count: missingLinks,
    });
  }

  // Check consistency threshold
  if (consistency < config.consistencyThreshold) {
    issues.push({
      type: 'consistency',
      severity: consistency < 50 ? 'critical' : consistency < 75 ? 'high' : 'warning',
      title: `Data Consistency: ${consistency}%`,
      description: 'Cross-module relationships need review',
      score: consistency,
    });
  }

  // No issues
  if (issues.length === 0) {
    return {
      show: false,
      severity: 'healthy',
      type: 'orphan',
      title: '',
      description: '',
    };
  }

  // Sort by severity
  const severityOrder: Record<HealthSeverity, number> = {
    critical: 0,
    high: 1,
    warning: 2,
    healthy: 3,
  };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Return most severe issue or combined if multiple
  if (issues.length === 1) {
    const issue = issues[0];
    return {
      show: true,
      severity: issue.severity,
      type: issue.type,
      title: issue.title,
      description: issue.description,
      count: issue.count,
      score: issue.score,
    };
  }

  // Multiple issues - combine into summary
  const mostSevere = issues[0].severity;
  return {
    show: true,
    severity: mostSevere,
    type: 'multiple',
    title: `${issues.length} Data Health Issues`,
    description: issues.map(i => i.title).join(' • '),
    count: issues.reduce((sum, i) => sum + (i.count || 0), 0),
    score: issues.find(i => i.score !== undefined)?.score,
  };
}

// =============================================================================
// ANALYTICS EMITTER (Phase 11 Preparation)
// =============================================================================

/**
 * Emit analytics event (placeholder for Phase 11)
 */
function emitAnalyticsEvent(event: SyncAnalyticsEvent): void {
  // Phase 11 will implement actual analytics
  // For now, emit to console in development
  if (process.env.NODE_ENV === 'development') {
    console.debug('[UISyncEngine Analytics]', event);
  }
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export interface UseUISyncEngineOptions extends Partial<UISyncEngineConfig> {
  /** Skip initial fetch on mount */
  skipInitialFetch?: boolean;
}

export interface UseUISyncEngineReturn {
  /** Current sync state */
  state: UISyncEngineState;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
  /** Pause polling */
  pause: () => void;
  /** Resume polling */
  resume: () => void;
  /** Check if polling is active */
  isPolling: boolean;
  /** Current configuration */
  config: UISyncEngineConfig;
  /** Update configuration */
  updateConfig: (updates: Partial<UISyncEngineConfig>) => void;
}

export function useUISyncEngine(options: UseUISyncEngineOptions = {}): UseUISyncEngineReturn {
  // Merge options with defaults
  const [config, setConfig] = useState<UISyncEngineConfig>({
    ...DEFAULT_SYNC_CONFIG,
    ...options,
  });

  // State
  const [state, setState] = useState<UISyncEngineState>(INITIAL_SYNC_STATE);
  const [isPolling, setIsPolling] = useState(config.enabled);

  // Refs for cleanup and comparison
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousHealthSeverity = useRef<HealthSeverity | null>(null);
  const previousInsightCount = useRef<number>(0);

  // Navigation context integration
  const { state: navState } = useNavigationContext();

  // Auth context for API calls
  const { token } = useAuth();

  /**
   * Fetch all data from APIs
   */
  const fetchData = useCallback(async () => {
    // Don't fetch if already fetching or no token
    if (state.isFetching || !token) return;

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const startTime = Date.now();
    if (config.emitAnalytics) {
      emitAnalyticsEvent({ type: 'sync_started' });
    }

    setState(prev => ({ ...prev, isFetching: true, error: null }));

    try {
      // Fetch all endpoints in parallel with auth header
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [snapshotRes, healthRes] = await Promise.all([
        fetch('/api/portfolio/snapshot', {
          signal: abortControllerRef.current.signal,
          headers,
        }),
        fetch('/api/linkage/health', {
          signal: abortControllerRef.current.signal,
          headers,
        }),
      ]);

      // Handle errors
      if (!snapshotRes.ok) {
        throw new Error(`Snapshot fetch failed: ${snapshotRes.status}`);
      }
      if (!healthRes.ok) {
        throw new Error(`Health fetch failed: ${healthRes.status}`);
      }

      // Parse responses
      const [snapshotData, healthData] = await Promise.all([
        snapshotRes.json(),
        healthRes.json(),
      ]);

      // Extract summary from snapshot
      const snapshotSummary = extractSnapshotSummary(snapshotData);

      // Generate insights from snapshot's relational insights
      const insightsState: InsightsState = {
        insights: [
          ...((snapshotData.relationalInsights?.errors || []) as Array<{
            entityType: string;
            entityId: string;
            entityName: string;
            message: string;
            suggestedAction?: string;
          }>).map((e, i) => ({
            id: `error-${i}`,
            severity: 'high' as const,
            category: 'orphaned_entity',
            title: e.entityName,
            description: e.message,
            affectedEntities: [{
              id: e.entityId,
              type: e.entityType,
              name: e.entityName,
              href: `/dashboard/${e.entityType}s?id=${e.entityId}`,
            }],
            recommendedFix: e.suggestedAction || 'Review and fix the relationship',
          })),
          ...((snapshotData.relationalInsights?.warnings || []) as Array<{
            entityType: string;
            entityId: string;
            entityName: string;
            message: string;
            suggestedAction?: string;
          }>).map((w, i) => ({
            id: `warning-${i}`,
            severity: 'medium' as const,
            category: 'missing_link',
            title: w.entityName,
            description: w.message,
            affectedEntities: [{
              id: w.entityId,
              type: w.entityType,
              name: w.entityName,
              href: `/dashboard/${w.entityType}s?id=${w.entityId}`,
            }],
            recommendedFix: w.suggestedAction || 'Add missing relationship',
          })),
        ],
        summary: {
          criticalCount: 0,
          highCount: (snapshotData.relationalInsights?.errors?.length || 0),
          mediumCount: (snapshotData.relationalInsights?.warnings?.length || 0),
          lowCount: (snapshotData.relationalInsights?.info?.length || 0),
          totalCount: (snapshotData.relationalInsights?.totalWarnings || 0),
        },
      };

      // Calculate warning ribbon
      const warningRibbon = calculateWarningRibbon(healthData, snapshotSummary, config);

      // Emit analytics for health severity changes
      if (config.emitAnalytics && previousHealthSeverity.current !== null) {
        const newSeverity = healthData.severity || 'healthy';
        if (previousHealthSeverity.current !== newSeverity) {
          emitAnalyticsEvent({
            type: 'health_changed',
            from: previousHealthSeverity.current,
            to: newSeverity,
          });
        }
      }
      previousHealthSeverity.current = healthData.severity || 'healthy';

      // Emit analytics for insight count changes
      if (config.emitAnalytics) {
        const newCount = insightsState.summary.totalCount;
        if (previousInsightCount.current !== newCount) {
          emitAnalyticsEvent({
            type: 'insight_count_changed',
            from: previousInsightCount.current,
            to: newCount,
          });
        }
        previousInsightCount.current = newCount;
      }

      // Update state with minimal-diff approach
      setState(prev => {
        const newState = {
          ...prev,
          isFetching: false,
          isLoaded: true,
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };

        // Only update if changed (minimal-diff)
        if (hasChanged(prev.snapshot, snapshotSummary)) {
          newState.snapshot = snapshotSummary;
        } else {
          newState.snapshot = prev.snapshot;
        }

        if (hasChanged(prev.health, healthData)) {
          newState.health = healthData;
        } else {
          newState.health = prev.health;
        }

        if (hasChanged(prev.insights, insightsState)) {
          newState.insights = insightsState;
        } else {
          newState.insights = prev.insights;
        }

        // Warning ribbon update
        if (hasChanged(prev.warningRibbon, warningRibbon)) {
          newState.warningRibbon = warningRibbon;
          if (config.emitAnalytics && warningRibbon.show && !prev.warningRibbon.show) {
            emitAnalyticsEvent({ type: 'warning_ribbon_shown', config: warningRibbon });
          }
        } else {
          newState.warningRibbon = prev.warningRibbon;
        }

        return newState;
      });

      // Emit completion analytics
      if (config.emitAnalytics) {
        emitAnalyticsEvent({
          type: 'sync_completed',
          duration: Date.now() - startTime,
        });
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isFetching: false,
        error: errorMessage,
      }));

      if (config.emitAnalytics) {
        emitAnalyticsEvent({ type: 'sync_error', error: errorMessage });
      }

      console.error('[UISyncEngine] Fetch error:', error);
    }
  }, [config, state.isFetching, token]);

  /**
   * Manually refresh data
   */
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  /**
   * Pause polling
   */
  const pause = useCallback(() => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Resume polling
   */
  const resume = useCallback(() => {
    setIsPolling(true);
  }, []);

  /**
   * Update configuration
   */
  const updateConfig = useCallback((updates: Partial<UISyncEngineConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // Initial fetch on mount (unless skipped)
  useEffect(() => {
    if (!options.skipInitialFetch) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup polling interval
  useEffect(() => {
    if (isPolling && config.enabled) {
      intervalRef.current = setInterval(fetchData, config.pollingInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPolling, config.enabled, config.pollingInterval, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Re-fetch when navigation context changes (entity opened)
  useEffect(() => {
    const currentEntity = navState.navStack[navState.navStack.length - 1];
    if (currentEntity && state.isLoaded) {
      // Optionally refresh when navigating to a new entity
      // This ensures entity-level warnings are current
    }
  }, [navState.navStack, state.isLoaded]);

  return {
    state,
    refresh,
    pause,
    resume,
    isPolling,
    config,
    updateConfig,
  };
}

// =============================================================================
// ENTITY-LEVEL WARNING HELPER
// =============================================================================

export interface EntityHealthInfo {
  hasWarnings: boolean;
  warnings: Array<{
    type: 'missing_relation' | 'invalid_reference' | 'orphaned';
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestedAction?: string;
  }>;
}

/**
 * Get entity-level health warnings from sync state
 */
export function getEntityWarnings(
  state: UISyncEngineState,
  entityType: string,
  entityId: string
): EntityHealthInfo {
  const warnings: EntityHealthInfo['warnings'] = [];

  if (!state.insights || !state.health) {
    return { hasWarnings: false, warnings: [] };
  }

  // Check insights for this entity
  for (const insight of state.insights.insights) {
    const affectedEntity = insight.affectedEntities.find(
      e => e.id === entityId || e.type === entityType
    );
    if (affectedEntity) {
      warnings.push({
        type: insight.category === 'orphaned_entity' ? 'orphaned' :
              insight.category === 'missing_link' ? 'missing_relation' : 'invalid_reference',
        severity: insight.severity === 'critical' || insight.severity === 'high' ? 'error' :
                  insight.severity === 'medium' ? 'warning' : 'info',
        message: insight.description,
        suggestedAction: insight.recommendedFix,
      });
    }
  }

  return {
    hasWarnings: warnings.length > 0,
    warnings,
  };
}

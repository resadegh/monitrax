'use client';

/**
 * useInsights Hook
 * Phase 9 Task 9.3 - Global Insights Integration
 *
 * Fetches and manages insights data from the portfolio snapshot.
 * Provides filtering by entity, category, and severity.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getInsightsForDashboard,
  getInsightsByCategory,
  getCriticalInsights,
  type InsightItem,
  type InsightsSummary,
  type InsightsResult,
  type InsightSeverity,
  type InsightCategory,
  type SnapshotV2,
} from '@/lib/intelligence/insightsEngine';
import type { GRDCSEntityType } from '@/lib/grdcs';

interface UseInsightsOptions {
  /** Auto-refresh interval in milliseconds (default: 60000 = 1 minute) */
  refreshInterval?: number;
  /** Filter to specific categories */
  categories?: InsightCategory[];
  /** Filter to specific entity type */
  entityType?: GRDCSEntityType;
  /** Filter to specific entity ID */
  entityId?: string;
  /** Minimum severity to include */
  minSeverity?: InsightSeverity;
  /** Maximum number of insights to return */
  limit?: number;
}

interface UseInsightsResult {
  insights: InsightItem[];
  summary: InsightsSummary;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

const severityOrder: Record<InsightSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function useInsights(options: UseInsightsOptions = {}): UseInsightsResult {
  const {
    refreshInterval = 60000,
    categories,
    entityType,
    entityId,
    minSeverity,
    limit,
  } = options;

  const [snapshot, setSnapshot] = useState<SnapshotV2 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/portfolio/snapshot');

      if (!response.ok) {
        throw new Error('Failed to fetch portfolio data');
      }

      const data = await response.json();
      setSnapshot(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(fetchSnapshot, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchSnapshot, refreshInterval]);

  // Process insights with filters
  const { insights, summary } = useMemo(() => {
    if (!snapshot) {
      return {
        insights: [],
        summary: {
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          totalCount: 0,
        },
      };
    }

    // Get base insights
    let result: InsightsResult;
    if (categories && categories.length > 0) {
      result = getInsightsByCategory(snapshot, categories);
    } else {
      result = getInsightsForDashboard(snapshot);
    }

    let filteredInsights = result.insights;

    // Filter by entity type
    if (entityType) {
      filteredInsights = filteredInsights.filter((insight) =>
        insight.affectedEntities.some((entity) => entity.type === entityType)
      );
    }

    // Filter by entity ID
    if (entityId) {
      filteredInsights = filteredInsights.filter((insight) =>
        insight.affectedEntities.some((entity) => entity.id === entityId)
      );
    }

    // Filter by minimum severity
    if (minSeverity) {
      filteredInsights = filteredInsights.filter(
        (insight) => severityOrder[insight.severity] <= severityOrder[minSeverity]
      );
    }

    // Apply limit
    if (limit && limit > 0) {
      filteredInsights = filteredInsights.slice(0, limit);
    }

    // Recalculate summary for filtered insights
    const filteredSummary: InsightsSummary = {
      criticalCount: filteredInsights.filter((i) => i.severity === 'critical').length,
      highCount: filteredInsights.filter((i) => i.severity === 'high').length,
      mediumCount: filteredInsights.filter((i) => i.severity === 'medium').length,
      lowCount: filteredInsights.filter((i) => i.severity === 'low').length,
      totalCount: filteredInsights.length,
    };

    return {
      insights: filteredInsights,
      summary: filteredSummary,
    };
  }, [snapshot, categories, entityType, entityId, minSeverity, limit]);

  const refresh = useCallback(async () => {
    await fetchSnapshot();
  }, [fetchSnapshot]);

  return {
    insights,
    summary,
    isLoading,
    error,
    refresh,
    lastUpdated,
  };
}

/**
 * useEntityInsights - Get insights for a specific entity
 */
export function useEntityInsights(
  entityType: GRDCSEntityType,
  entityId: string,
  options?: Omit<UseInsightsOptions, 'entityType' | 'entityId'>
): UseInsightsResult {
  return useInsights({
    ...options,
    entityType,
    entityId,
  });
}

/**
 * useCriticalInsights - Get only critical and high severity insights
 */
export function useCriticalInsights(
  options?: Omit<UseInsightsOptions, 'minSeverity'>
): UseInsightsResult {
  return useInsights({
    ...options,
    minSeverity: 'high',
  });
}

/**
 * useModuleInsights - Get insights for a specific module type
 */
export function useModuleInsights(
  moduleType: GRDCSEntityType,
  options?: Omit<UseInsightsOptions, 'entityType'>
): UseInsightsResult {
  return useInsights({
    ...options,
    entityType: moduleType,
  });
}

export default useInsights;

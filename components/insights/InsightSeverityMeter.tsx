'use client';

/**
 * INSIGHT SEVERITY METER
 * Phase 9 Task 9.5 - Unified UI Components for Insights & Health
 *
 * A small horizontal severity bar showing weighted severity:
 * - Red for critical
 * - Orange for high
 * - Yellow/Amber for medium
 * - Green for low/healthy
 *
 * Used in cards, lists, modals, and dashboards.
 */

import React, { useMemo } from 'react';
import { InsightsSummary } from '@/lib/sync/types';

// =============================================================================
// TYPES
// =============================================================================

export interface InsightSeverityMeterProps {
  /** Insights summary with counts */
  summary: InsightsSummary;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show count labels */
  showLabels?: boolean;
  /** Show legend */
  showLegend?: boolean;
  /** Custom class name */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

const SIZE_CONFIG = {
  sm: {
    height: 'h-1.5',
    gap: 'gap-0.5',
    text: 'text-[10px]',
    legendGap: 'gap-2',
    dotSize: 'h-2 w-2',
  },
  md: {
    height: 'h-2.5',
    gap: 'gap-1',
    text: 'text-xs',
    legendGap: 'gap-3',
    dotSize: 'h-2.5 w-2.5',
  },
  lg: {
    height: 'h-3.5',
    gap: 'gap-1',
    text: 'text-sm',
    legendGap: 'gap-4',
    dotSize: 'h-3 w-3',
  },
};

const SEVERITY_COLORS = {
  critical: 'bg-red-500 dark:bg-red-600',
  high: 'bg-orange-500 dark:bg-orange-600',
  medium: 'bg-amber-400 dark:bg-amber-500',
  low: 'bg-green-500 dark:bg-green-600',
  empty: 'bg-slate-200 dark:bg-slate-700',
};

export function InsightSeverityMeter({
  summary,
  size = 'md',
  showLabels = false,
  showLegend = false,
  className = '',
}: InsightSeverityMeterProps) {
  const sizeConfig = SIZE_CONFIG[size];

  // Calculate percentages
  const { percentages, isEmpty } = useMemo(() => {
    const total = summary.totalCount || 0;
    if (total === 0) {
      return { percentages: { critical: 0, high: 0, medium: 0, low: 0 }, isEmpty: true };
    }
    return {
      percentages: {
        critical: (summary.criticalCount / total) * 100,
        high: (summary.highCount / total) * 100,
        medium: (summary.mediumCount / total) * 100,
        low: (summary.lowCount / total) * 100,
      },
      isEmpty: false,
    };
  }, [summary]);

  // Calculate weighted severity score (0-100, lower is better)
  const weightedScore = useMemo(() => {
    const total = summary.totalCount || 0;
    if (total === 0) return 100; // Perfect score if no issues
    const weights = { critical: 100, high: 75, medium: 40, low: 10 };
    const weightedSum =
      summary.criticalCount * weights.critical +
      summary.highCount * weights.high +
      summary.mediumCount * weights.medium +
      summary.lowCount * weights.low;
    const maxScore = total * weights.critical;
    return Math.round(100 - (weightedSum / maxScore) * 100);
  }, [summary]);

  // Get overall color based on score
  const overallColor = useMemo(() => {
    if (weightedScore >= 90) return 'text-green-600 dark:text-green-400';
    if (weightedScore >= 70) return 'text-amber-600 dark:text-amber-400';
    if (weightedScore >= 50) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  }, [weightedScore]);

  return (
    <div className={className}>
      {/* Meter bar */}
      <div className={`flex ${sizeConfig.gap} w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800`}>
        {isEmpty ? (
          <div className={`${sizeConfig.height} w-full ${SEVERITY_COLORS.empty}`} />
        ) : (
          <>
            {percentages.critical > 0 && (
              <div
                className={`${sizeConfig.height} ${SEVERITY_COLORS.critical} transition-all duration-300`}
                style={{ width: `${percentages.critical}%` }}
                title={`Critical: ${summary.criticalCount}`}
              />
            )}
            {percentages.high > 0 && (
              <div
                className={`${sizeConfig.height} ${SEVERITY_COLORS.high} transition-all duration-300`}
                style={{ width: `${percentages.high}%` }}
                title={`High: ${summary.highCount}`}
              />
            )}
            {percentages.medium > 0 && (
              <div
                className={`${sizeConfig.height} ${SEVERITY_COLORS.medium} transition-all duration-300`}
                style={{ width: `${percentages.medium}%` }}
                title={`Medium: ${summary.mediumCount}`}
              />
            )}
            {percentages.low > 0 && (
              <div
                className={`${sizeConfig.height} ${SEVERITY_COLORS.low} transition-all duration-300`}
                style={{ width: `${percentages.low}%` }}
                title={`Low: ${summary.lowCount}`}
              />
            )}
          </>
        )}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className={`flex justify-between mt-1 ${sizeConfig.text} text-muted-foreground`}>
          <span>
            {summary.totalCount} issue{summary.totalCount !== 1 ? 's' : ''}
          </span>
          <span className={overallColor}>
            Health: {weightedScore}%
          </span>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className={`flex flex-wrap ${sizeConfig.legendGap} mt-2 ${sizeConfig.text}`}>
          {summary.criticalCount > 0 && (
            <div className="flex items-center gap-1">
              <div className={`${sizeConfig.dotSize} rounded-full ${SEVERITY_COLORS.critical}`} />
              <span className="text-muted-foreground">Critical: {summary.criticalCount}</span>
            </div>
          )}
          {summary.highCount > 0 && (
            <div className="flex items-center gap-1">
              <div className={`${sizeConfig.dotSize} rounded-full ${SEVERITY_COLORS.high}`} />
              <span className="text-muted-foreground">High: {summary.highCount}</span>
            </div>
          )}
          {summary.mediumCount > 0 && (
            <div className="flex items-center gap-1">
              <div className={`${sizeConfig.dotSize} rounded-full ${SEVERITY_COLORS.medium}`} />
              <span className="text-muted-foreground">Medium: {summary.mediumCount}</span>
            </div>
          )}
          {summary.lowCount > 0 && (
            <div className="flex items-center gap-1">
              <div className={`${sizeConfig.dotSize} rounded-full ${SEVERITY_COLORS.low}`} />
              <span className="text-muted-foreground">Low: {summary.lowCount}</span>
            </div>
          )}
          {isEmpty && (
            <div className="flex items-center gap-1">
              <div className={`${sizeConfig.dotSize} rounded-full ${SEVERITY_COLORS.empty}`} />
              <span className="text-muted-foreground">No issues</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MINI VARIANT
// =============================================================================

export interface MiniSeverityMeterProps {
  /** Count by severity */
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  /** Custom class name */
  className?: string;
}

export function MiniSeverityMeter({
  critical = 0,
  high = 0,
  medium = 0,
  low = 0,
  className = '',
}: MiniSeverityMeterProps) {
  const summary: InsightsSummary = {
    criticalCount: critical,
    highCount: high,
    mediumCount: medium,
    lowCount: low,
    totalCount: critical + high + medium + low,
  };

  return (
    <InsightSeverityMeter
      summary={summary}
      size="sm"
      className={className}
    />
  );
}

export default InsightSeverityMeter;

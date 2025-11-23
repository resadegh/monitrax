'use client';

/**
 * InsightList Component
 * Phase 9 Task 9.3 - Global Insights Integration
 *
 * Grouped list of insights by severity with expandable sections
 * and integrated CMNF navigation.
 */

import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InsightCard } from './InsightCard';
import { cn } from '@/lib/utils';
import type { InsightItem, InsightSeverity, InsightsSummary, InsightCategory } from '@/lib/intelligence/insightsEngine';

// Severity group configuration
const SEVERITY_GROUPS: {
  severity: InsightSeverity;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { severity: 'critical', label: 'Critical', icon: AlertCircle, color: 'text-red-600' },
  { severity: 'high', label: 'High', icon: AlertTriangle, color: 'text-orange-600' },
  { severity: 'medium', label: 'Medium', icon: Info, color: 'text-yellow-600' },
  { severity: 'low', label: 'Low', icon: Lightbulb, color: 'text-blue-600' },
];

interface InsightListProps {
  insights: InsightItem[];
  summary?: InsightsSummary;
  maxPerGroup?: number;
  showEmptyGroups?: boolean;
  expandedByDefault?: InsightSeverity[];
  compact?: boolean;
  filterCategories?: InsightCategory[];
  onFix?: (insight: InsightItem) => void;
  className?: string;
}

export function InsightList({
  insights,
  summary,
  maxPerGroup = 5,
  showEmptyGroups = false,
  expandedByDefault = ['critical', 'high'],
  compact = false,
  filterCategories,
  onFix,
  className,
}: InsightListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<InsightSeverity>>(
    new Set(expandedByDefault)
  );
  const [showAll, setShowAll] = useState<Set<InsightSeverity>>(new Set());

  // Filter and group insights
  const filteredInsights = useMemo(() => {
    if (!filterCategories || filterCategories.length === 0) {
      return insights;
    }
    return insights.filter(i => filterCategories.includes(i.category));
  }, [insights, filterCategories]);

  const groupedInsights = useMemo(() => {
    const groups: Record<InsightSeverity, InsightItem[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    for (const insight of filteredInsights) {
      groups[insight.severity].push(insight);
    }

    return groups;
  }, [filteredInsights]);

  const toggleGroup = (severity: InsightSeverity) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  const toggleShowAll = (severity: InsightSeverity) => {
    setShowAll(prev => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  if (filteredInsights.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <Lightbulb className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="font-semibold text-lg mb-2">No Issues Found</h3>
        <p className="text-sm text-muted-foreground">
          Your portfolio looks healthy. Keep up the good work!
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Header */}
      {summary && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {summary.totalCount} insight{summary.totalCount !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            {summary.criticalCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {summary.criticalCount}
              </Badge>
            )}
            {summary.highCount > 0 && (
              <Badge className="gap-1 bg-orange-500 hover:bg-orange-600">
                <AlertTriangle className="h-3 w-3" />
                {summary.highCount}
              </Badge>
            )}
            {summary.mediumCount > 0 && (
              <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-black">
                <Info className="h-3 w-3" />
                {summary.mediumCount}
              </Badge>
            )}
            {summary.lowCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Lightbulb className="h-3 w-3" />
                {summary.lowCount}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Grouped Insights */}
      {SEVERITY_GROUPS.map(({ severity, label, icon: Icon, color }) => {
        const groupInsights = groupedInsights[severity];
        const isExpanded = expandedGroups.has(severity);
        const isShowingAll = showAll.has(severity);
        const visibleInsights = isShowingAll
          ? groupInsights
          : groupInsights.slice(0, maxPerGroup);

        if (groupInsights.length === 0 && !showEmptyGroups) {
          return null;
        }

        return (
          <div key={severity} className="border rounded-lg overflow-hidden">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(severity)}
              className={cn(
                'w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors',
                isExpanded && 'border-b'
              )}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Icon className={cn('h-4 w-4', color)} />
                <span className="font-medium text-sm">{label}</span>
                <Badge variant="secondary" className="text-xs">
                  {groupInsights.length}
                </Badge>
              </div>
            </button>

            {/* Group Content */}
            {isExpanded && groupInsights.length > 0 && (
              <div className="p-3 space-y-3">
                {visibleInsights.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    compact={compact}
                    onFix={onFix}
                  />
                ))}

                {/* Show More/Less */}
                {groupInsights.length > maxPerGroup && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleShowAll(severity)}
                    className="w-full"
                  >
                    {isShowingAll
                      ? `Show less (${maxPerGroup})`
                      : `Show all ${groupInsights.length}`}
                  </Button>
                )}
              </div>
            )}

            {isExpanded && groupInsights.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No {label.toLowerCase()} issues
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * InsightSummaryBar - Horizontal summary of insight counts
 */
interface InsightSummaryBarProps {
  summary: InsightsSummary;
  onClick?: (severity: InsightSeverity) => void;
  className?: string;
}

export function InsightSummaryBar({ summary, onClick, className }: InsightSummaryBarProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {summary.criticalCount > 0 && (
        <button
          onClick={() => onClick?.('critical')}
          className="flex items-center gap-1 px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 text-sm hover:opacity-80"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {summary.criticalCount}
        </button>
      )}
      {summary.highCount > 0 && (
        <button
          onClick={() => onClick?.('high')}
          className="flex items-center gap-1 px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 text-sm hover:opacity-80"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {summary.highCount}
        </button>
      )}
      {summary.mediumCount > 0 && (
        <button
          onClick={() => onClick?.('medium')}
          className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 text-sm hover:opacity-80"
        >
          <Info className="h-3.5 w-3.5" />
          {summary.mediumCount}
        </button>
      )}
      {summary.lowCount > 0 && (
        <button
          onClick={() => onClick?.('low')}
          className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-sm hover:opacity-80"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          {summary.lowCount}
        </button>
      )}
      {summary.totalCount === 0 && (
        <span className="text-sm text-green-600 flex items-center gap-1">
          <Lightbulb className="h-3.5 w-3.5" />
          No issues
        </span>
      )}
    </div>
  );
}

export default InsightList;

'use client';

/**
 * ModuleInsightsPanel Component
 * Phase 9 Task 9.3 - Global Insights Integration
 *
 * Module-level insights panel showing top insights for
 * a specific module (Properties, Loans, etc.) with
 * "View all insights" link and severity color bars.
 */

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Lightbulb,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { InsightCard } from './InsightCard';
import { useModuleInsights } from '@/hooks/useInsights';
import { cn } from '@/lib/utils';
import type { GRDCSEntityType } from '@/lib/grdcs';
import type { InsightItem } from '@/lib/intelligence/insightsEngine';

// Module display names
const MODULE_NAMES: Record<GRDCSEntityType, string> = {
  property: 'Properties',
  loan: 'Loans',
  income: 'Income',
  expense: 'Expenses',
  account: 'Accounts',
  investmentAccount: 'Investment Accounts',
  investmentHolding: 'Holdings',
  investmentTransaction: 'Transactions',
  depreciationSchedule: 'Depreciation',
};

interface ModuleInsightsPanelProps {
  moduleType: GRDCSEntityType;
  maxInsights?: number;
  showHeader?: boolean;
  onViewAll?: () => void;
  onFix?: (insight: InsightItem) => void;
  className?: string;
}

export function ModuleInsightsPanel({
  moduleType,
  maxInsights = 3,
  showHeader = true,
  onViewAll,
  onFix,
  className,
}: ModuleInsightsPanelProps) {
  const { insights, summary, isLoading, error, refresh } = useModuleInsights(moduleType, {
    limit: maxInsights,
  });

  const moduleName = MODULE_NAMES[moduleType] || moduleType;

  // Calculate severity bar widths
  const totalWithSeverity = summary.criticalCount + summary.highCount + summary.mediumCount + summary.lowCount;
  const severityBars = totalWithSeverity > 0
    ? {
        critical: (summary.criticalCount / totalWithSeverity) * 100,
        high: (summary.highCount / totalWithSeverity) * 100,
        medium: (summary.mediumCount / totalWithSeverity) * 100,
        low: (summary.lowCount / totalWithSeverity) * 100,
      }
    : null;

  if (error) {
    return (
      <Card className={cn('border-red-200 dark:border-red-800', className)}>
        <CardContent className="p-4 text-center">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load insights</p>
          <Button onClick={refresh} variant="ghost" size="sm" className="mt-2">
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              {moduleName} Insights
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {summary.totalCount}
            </Badge>
          </div>

          {/* Severity Color Bar */}
          {severityBars && (
            <div className="flex h-1.5 rounded-full overflow-hidden mt-2 bg-muted">
              {severityBars.critical > 0 && (
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${severityBars.critical}%` }}
                />
              )}
              {severityBars.high > 0 && (
                <div
                  className="bg-orange-500 h-full"
                  style={{ width: `${severityBars.high}%` }}
                />
              )}
              {severityBars.medium > 0 && (
                <div
                  className="bg-yellow-500 h-full"
                  style={{ width: `${severityBars.medium}%` }}
                />
              )}
              {severityBars.low > 0 && (
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${severityBars.low}%` }}
                />
              )}
            </div>
          )}
        </CardHeader>
      )}

      <CardContent className={showHeader ? 'pt-2' : 'pt-4'}>
        {isLoading && insights.length === 0 ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No issues in {moduleName.toLowerCase()}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {insights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                compact
                onFix={onFix}
              />
            ))}

            {summary.totalCount > maxInsights && onViewAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewAll}
                className="w-full gap-1"
              >
                View all {summary.totalCount} insights
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ModuleInsightsBadge - Inline badge showing insight count for a module
 */
interface ModuleInsightsBadgeProps {
  moduleType: GRDCSEntityType;
  onClick?: () => void;
  className?: string;
}

export function ModuleInsightsBadge({
  moduleType,
  onClick,
  className,
}: ModuleInsightsBadgeProps) {
  const { summary, isLoading } = useModuleInsights(moduleType, { limit: 0 });

  if (isLoading || summary.totalCount === 0) {
    return null;
  }

  const hasHighSeverity = summary.criticalCount > 0 || summary.highCount > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        hasHighSeverity
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        className
      )}
    >
      {hasHighSeverity ? (
        <AlertCircle className="h-3 w-3" />
      ) : (
        <Info className="h-3 w-3" />
      )}
      {summary.totalCount}
    </button>
  );
}

export default ModuleInsightsPanel;

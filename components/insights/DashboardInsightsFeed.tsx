'use client';

/**
 * DashboardInsightsFeed Component
 * Phase 9 Task 9.3 - Global Insights Integration
 *
 * Main dashboard insights feed showing grouped insights
 * with severity breakdown and quick actions.
 */

import React from 'react';
import {
  RefreshCw,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InsightList, InsightSummaryBar } from './InsightList';
import { useInsights } from '@/hooks/useInsights';
import { cn } from '@/lib/utils';
import type { InsightItem } from '@/lib/intelligence/insightsEngine';

interface DashboardInsightsFeedProps {
  maxInsights?: number;
  showHeader?: boolean;
  compact?: boolean;
  onViewAll?: () => void;
  onFix?: (insight: InsightItem) => void;
  className?: string;
}

export function DashboardInsightsFeed({
  maxInsights = 10,
  showHeader = true,
  compact = false,
  onViewAll,
  onFix,
  className,
}: DashboardInsightsFeedProps) {
  const { insights, summary, isLoading, error, refresh, lastUpdated } = useInsights({
    limit: maxInsights,
  });

  if (error) {
    return (
      <Card className={cn('border-red-200 dark:border-red-800', className)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
          <h3 className="font-semibold mb-2">Failed to Load Insights</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Portfolio Insights
              </CardTitle>
              <CardDescription>
                Actionable recommendations for your financial portfolio
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh}
                disabled={isLoading}
                className="gap-1"
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                {isLoading ? 'Loading...' : 'Refresh'}
              </Button>
              {onViewAll && (
                <Button variant="outline" size="sm" onClick={onViewAll} className="gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Summary Bar */}
          <div className="mt-3 flex items-center justify-between">
            <InsightSummaryBar summary={summary} />
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className={showHeader ? 'pt-0' : ''}>
        {isLoading && insights.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Looking Good!</h3>
            <p className="text-sm text-muted-foreground">
              Your portfolio is healthy with no immediate concerns.
            </p>
          </div>
        ) : (
          <InsightList
            insights={insights}
            summary={summary}
            compact={compact}
            maxPerGroup={5}
            expandedByDefault={['critical', 'high']}
            onFix={onFix}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * DashboardInsightsSummary - Compact summary widget for sidebar
 */
interface DashboardInsightsSummaryProps {
  onClick?: () => void;
  className?: string;
}

export function DashboardInsightsSummary({
  onClick,
  className,
}: DashboardInsightsSummaryProps) {
  const { summary, isLoading } = useInsights({ limit: 0 });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasIssues = summary.criticalCount > 0 || summary.highCount > 0;

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-shadow',
        hasIssues && 'border-orange-200 dark:border-orange-800',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Insights</span>
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
        </div>

        {summary.totalCount === 0 ? (
          <p className="text-sm text-green-600">All clear</p>
        ) : (
          <div className="space-y-1">
            <p className="text-2xl font-bold">{summary.totalCount}</p>
            <InsightSummaryBar summary={summary} className="flex-wrap" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DashboardInsightsFeed;

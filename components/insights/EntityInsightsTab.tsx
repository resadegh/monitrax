'use client';

/**
 * EntityInsightsTab Component
 * Phase 9 Task 9.3 - Global Insights Integration
 *
 * Insights tab content for entity detail dialogs.
 * Shows insights filtered to the specific entity with
 * recommended fix actions and CMNF navigation CTAs.
 */

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Lightbulb,
  RefreshCw,
  CheckCircle2,
  Wrench,
  ArrowRight,
  Link2,
  Link2Off,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InsightCard, SeverityBadge } from './InsightCard';
import { InsightSummaryBar } from './InsightList';
import { useEntityInsights } from '@/hooks/useInsights';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import { cn } from '@/lib/utils';
import type { GRDCSEntityType, GRDCSLinkedEntity, GRDCSMissingLink } from '@/lib/grdcs';
import type { InsightItem } from '@/lib/intelligence/insightsEngine';

interface EntityInsightsTabProps {
  entityType: GRDCSEntityType;
  entityId: string;
  entityName: string;
  /** Optional: pre-fetched missing links from GRDCS */
  missingLinks?: GRDCSMissingLink[];
  onFix?: (insight: InsightItem) => void;
  className?: string;
}

export function EntityInsightsTab({
  entityType,
  entityId,
  entityName,
  missingLinks = [],
  onFix,
  className,
}: EntityInsightsTabProps) {
  const { insights, summary, isLoading, error, refresh } = useEntityInsights(
    entityType,
    entityId
  );
  const { openLinkedEntity, navigateToEntity } = useCrossModuleNavigation();

  const handleFix = (insight: InsightItem) => {
    if (onFix) {
      onFix(insight);
    } else if (insight.affectedEntities.length === 1) {
      openLinkedEntity(insight.affectedEntities[0]);
    }
  };

  if (error) {
    return (
      <div className={cn('text-center py-8', className)}>
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
        <h3 className="font-semibold mb-2">Failed to Load Insights</h3>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (isLoading && insights.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasIssues = insights.length > 0 || missingLinks.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Insights for {entityName}
          </h3>
          <p className="text-sm text-muted-foreground">
            {hasIssues
              ? `${insights.length + missingLinks.length} item${insights.length + missingLinks.length !== 1 ? 's' : ''} need attention`
              : 'No issues found'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={isLoading}
          className="gap-1"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Summary Bar */}
      {hasIssues && (
        <InsightSummaryBar
          summary={{
            ...summary,
            totalCount: summary.totalCount + missingLinks.length,
          }}
        />
      )}

      {/* Missing Links Section */}
      {missingLinks.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Link2Off className="h-4 w-4" />
              Missing Links
              <Badge variant="outline" className="ml-1 border-amber-300 text-amber-700">
                {missingLinks.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-amber-600/80 dark:text-amber-400/80">
              Complete these links for better insights and accurate calculations
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {missingLinks.map((missing, index) => (
                <MissingLinkItem
                  key={index}
                  missingLink={missing}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights List */}
      {insights.length > 0 ? (
        <div className="space-y-3">
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onFix={handleFix}
            />
          ))}
        </div>
      ) : missingLinks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">All Clear!</h3>
            <p className="text-sm text-muted-foreground">
              No issues or recommendations for this entity.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * MissingLinkItem - Individual missing link item
 */
interface MissingLinkItemProps {
  missingLink: GRDCSMissingLink;
}

function MissingLinkItem({ missingLink }: MissingLinkItemProps) {
  const { navigateToEntity } = useCrossModuleNavigation();

  // Map missing link type to module route
  const getModuleRoute = (type: string) => {
    const routes: Record<string, string> = {
      property: '/dashboard/properties',
      loan: '/dashboard/loans',
      income: '/dashboard/income',
      expense: '/dashboard/expenses',
      account: '/dashboard/accounts',
      investmentAccount: '/dashboard/investments/accounts',
      investmentHolding: '/dashboard/investments/holdings',
      investmentTransaction: '/dashboard/investments/transactions',
    };
    return routes[type] || '/dashboard';
  };

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg bg-amber-100/50 dark:bg-amber-900/20">
      <Link2Off className="h-4 w-4 text-amber-700 dark:text-amber-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          {missingLink.reason}
        </p>
        {missingLink.suggestedAction && (
          <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-0.5">
            {missingLink.suggestedAction}
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.location.href = getModuleRoute(missingLink.type)}
        className="h-7 text-xs border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
      >
        <Wrench className="h-3 w-3 mr-1" />
        Fix
      </Button>
    </div>
  );
}

/**
 * EntityInsightsSummary - Compact summary for dialog headers
 */
interface EntityInsightsSummaryProps {
  entityType: GRDCSEntityType;
  entityId: string;
  onClick?: () => void;
  className?: string;
}

export function EntityInsightsSummary({
  entityType,
  entityId,
  onClick,
  className,
}: EntityInsightsSummaryProps) {
  const { summary, isLoading } = useEntityInsights(entityType, entityId);

  if (isLoading || summary.totalCount === 0) {
    return null;
  }

  const hasHighSeverity = summary.criticalCount > 0 || summary.highCount > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium',
        hasHighSeverity
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
        className
      )}
    >
      <Lightbulb className="h-3 w-3" />
      {summary.totalCount} insight{summary.totalCount !== 1 ? 's' : ''}
    </button>
  );
}

export default EntityInsightsTab;

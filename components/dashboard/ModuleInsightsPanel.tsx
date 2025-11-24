/**
 * ModuleInsightsPanel - Per-module insights panel
 * Phase 07 Dashboard Component
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ModuleType =
  | 'properties'
  | 'loans'
  | 'accounts'
  | 'income'
  | 'expenses'
  | 'investments';

type InsightSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';

interface Insight {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  module?: string;
  entityId?: string;
}

interface ModuleInsightsPanelProps {
  module: ModuleType;
  insights: Insight[];
  maxItems?: number;
  onViewAll?: () => void;
  onInsightClick?: (insight: Insight) => void;
  className?: string;
}

const moduleLabels: Record<ModuleType, string> = {
  properties: 'Properties',
  loans: 'Loans',
  accounts: 'Accounts',
  income: 'Income',
  expenses: 'Expenses',
  investments: 'Investments',
};

const severityColors: Record<InsightSeverity, string> = {
  CRITICAL: 'text-red-600',
  WARNING: 'text-yellow-600',
  INFO: 'text-blue-600',
  SUCCESS: 'text-green-600',
};

export function ModuleInsightsPanel({
  module,
  insights,
  maxItems = 3,
  onViewAll,
  onInsightClick,
  className,
}: ModuleInsightsPanelProps) {
  const moduleInsights = insights.filter(
    (i) => i.module?.toLowerCase() === module.toLowerCase()
  );

  const displayInsights = moduleInsights.slice(0, maxItems);
  const hasMore = moduleInsights.length > maxItems;

  if (moduleInsights.length === 0) {
    return null; // Don't render if no insights for this module
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {moduleLabels[module]} Insights
          </CardTitle>
          <Badge variant="outline">{moduleInsights.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayInsights.map((insight) => (
          <div
            key={insight.id}
            className="p-2 rounded border hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => onInsightClick?.(insight)}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  insight.severity === 'CRITICAL' && 'bg-red-500',
                  insight.severity === 'WARNING' && 'bg-yellow-500',
                  insight.severity === 'INFO' && 'bg-blue-500',
                  insight.severity === 'SUCCESS' && 'bg-green-500'
                )}
              />
              <span className="text-sm font-medium truncate">{insight.title}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-1 pl-4">
              {insight.description}
            </p>
          </div>
        ))}
        {hasMore && onViewAll && (
          <Button
            variant="link"
            size="sm"
            onClick={onViewAll}
            className="w-full text-xs"
          >
            View all {moduleInsights.length} insights
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ModuleInsightsSummary - Compact insights count for module headers
 */
interface ModuleInsightsSummaryProps {
  module: ModuleType;
  insights: Insight[];
  onClick?: () => void;
}

export function ModuleInsightsSummary({
  module,
  insights,
  onClick,
}: ModuleInsightsSummaryProps) {
  const moduleInsights = insights.filter(
    (i) => i.module?.toLowerCase() === module.toLowerCase()
  );

  const criticalCount = moduleInsights.filter((i) => i.severity === 'CRITICAL').length;
  const warningCount = moduleInsights.filter((i) => i.severity === 'WARNING').length;

  if (moduleInsights.length === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-1 cursor-pointer"
      onClick={onClick}
      title={`${moduleInsights.length} insights for ${moduleLabels[module]}`}
    >
      {criticalCount > 0 && (
        <Badge variant="destructive" className="text-xs">
          {criticalCount}
        </Badge>
      )}
      {warningCount > 0 && (
        <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
          {warningCount}
        </Badge>
      )}
      {criticalCount === 0 && warningCount === 0 && (
        <Badge variant="outline" className="text-xs">
          {moduleInsights.length}
        </Badge>
      )}
    </div>
  );
}

export type { ModuleType };

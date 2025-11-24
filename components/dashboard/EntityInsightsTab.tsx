/**
 * EntityInsightsTab - Insights tab for entity dialogs
 * Phase 09 Insights Component
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type InsightSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';

interface EntityInsight {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  actionLabel?: string;
  onAction?: () => void;
}

interface EntityInsightsTabProps {
  entityId: string;
  entityType: string;
  insights: EntityInsight[];
  isLoading?: boolean;
}

const severityConfig: Record<
  InsightSeverity,
  { bg: string; text: string; border: string; badge: string }
> = {
  CRITICAL: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800',
  },
  WARNING: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800',
  },
  INFO: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
  },
  SUCCESS: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-800',
  },
};

export function EntityInsightsTab({
  entityId,
  entityType,
  insights,
  isLoading,
}: EntityInsightsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
          <span className="text-green-600 text-xl">✓</span>
        </div>
        <h3 className="font-medium text-gray-900">No Active Insights</h3>
        <p className="text-sm text-gray-500 mt-1">
          This {entityType} has no issues or recommendations at this time.
        </p>
      </div>
    );
  }

  // Sort by severity
  const sortedInsights = [...insights].sort((a, b) => {
    const order: Record<InsightSeverity, number> = {
      CRITICAL: 0,
      WARNING: 1,
      INFO: 2,
      SUCCESS: 3,
    };
    return order[a.severity] - order[b.severity];
  });

  const criticalCount = insights.filter((i) => i.severity === 'CRITICAL').length;
  const warningCount = insights.filter((i) => i.severity === 'WARNING').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-2 pb-3 border-b">
        <span className="text-sm text-gray-500">
          {insights.length} insight{insights.length !== 1 ? 's' : ''}
        </span>
        {criticalCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {criticalCount} critical
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge
            variant="secondary"
            className="text-xs bg-yellow-100 text-yellow-800"
          >
            {warningCount} warning{warningCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Insights List */}
      <div className="space-y-3">
        {sortedInsights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: EntityInsight }) {
  const config = severityConfig[insight.severity];

  return (
    <div
      className={cn(
        'p-4 rounded-lg border',
        config.bg,
        config.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn('text-xs', config.badge)}>
              {insight.severity}
            </Badge>
          </div>
          <h4 className={cn('font-medium text-sm', config.text)}>
            {insight.title}
          </h4>
          <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
        </div>
        {insight.actionLabel && insight.onAction && (
          <Button
            variant="outline"
            size="sm"
            onClick={insight.onAction}
            className="shrink-0"
          >
            {insight.actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * useEntityInsights - Hook for fetching entity-specific insights
 */
export function useEntityInsights(entityId: string, entityType: string) {
  const [insights, setInsights] = React.useState<EntityInsight[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // In a real implementation, this would fetch from the insights engine
    // For now, we simulate loading
    setIsLoading(true);
    const timeout = setTimeout(() => {
      setInsights([]);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timeout);
  }, [entityId, entityType]);

  return { insights, isLoading, setInsights };
}

export type { EntityInsight };

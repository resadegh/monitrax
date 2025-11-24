/**
 * DashboardInsightsFeed - Global insights feed for dashboard
 * Phase 07 Dashboard Component
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Insight severity levels
type InsightSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';

interface Insight {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  module?: string;
  entityId?: string;
  actionLabel?: string;
  actionPath?: string;
  createdAt: Date;
}

interface DashboardInsightsFeedProps {
  insights: Insight[];
  maxItems?: number;
  onInsightClick?: (insight: Insight) => void;
  onViewAll?: () => void;
  className?: string;
}

const severityOrder: Record<InsightSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
  SUCCESS: 3,
};

const severityColors: Record<InsightSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  INFO: 'bg-blue-100 text-blue-800 border-blue-200',
  SUCCESS: 'bg-green-100 text-green-800 border-green-200',
};

const severityBadgeVariant: Record<InsightSeverity, 'destructive' | 'secondary' | 'default' | 'outline'> = {
  CRITICAL: 'destructive',
  WARNING: 'secondary',
  INFO: 'outline',
  SUCCESS: 'default',
};

export function DashboardInsightsFeed({
  insights,
  maxItems = 5,
  onInsightClick,
  onViewAll,
  className,
}: DashboardInsightsFeedProps) {
  const sortedInsights = [...insights]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, maxItems);

  if (insights.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Active Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No active insights. Your portfolio is healthy!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Active Insights</CardTitle>
        <Badge variant="secondary">{insights.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedInsights.map((insight) => (
          <InsightItem
            key={insight.id}
            insight={insight}
            onClick={() => onInsightClick?.(insight)}
          />
        ))}
        {insights.length > maxItems && onViewAll && (
          <Button variant="link" onClick={onViewAll} className="w-full">
            View all {insights.length} insights
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function InsightItem({
  insight,
  onClick,
}: {
  insight: Insight;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow',
        severityColors[insight.severity]
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={severityBadgeVariant[insight.severity]} className="text-xs">
              {insight.severity}
            </Badge>
            {insight.module && (
              <span className="text-xs text-gray-500">{insight.module}</span>
            )}
          </div>
          <h4 className="font-medium text-sm truncate">{insight.title}</h4>
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
            {insight.description}
          </p>
        </div>
        {insight.actionLabel && (
          <Button variant="ghost" size="sm" className="shrink-0">
            {insight.actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export type { Insight, InsightSeverity };

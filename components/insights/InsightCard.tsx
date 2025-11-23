'use client';

/**
 * InsightCard Component
 * Phase 9 Task 9.3 - Global Insights Integration
 *
 * Individual insight card with severity badge, description,
 * affected entities preview, and CTA buttons.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Wrench,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import { cn } from '@/lib/utils';
import type { InsightItem, InsightSeverity, InsightCategory } from '@/lib/intelligence/insightsEngine';
import type { GRDCSLinkedEntity } from '@/lib/grdcs';

// Severity configuration
const SEVERITY_CONFIG: Record<InsightSeverity, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}> = {
  critical: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Critical',
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    label: 'High',
  },
  medium: {
    icon: Info,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    label: 'Medium',
  },
  low: {
    icon: Lightbulb,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Low',
  },
};

// Category labels
const CATEGORY_LABELS: Record<InsightCategory, string> = {
  missing_link: 'Missing Link',
  orphaned_entity: 'Orphaned Entity',
  cross_module_health: 'Cross-Module Health',
  data_completeness: 'Data Completeness',
  structural_gap: 'Structural Gap',
  duplicate_invalid: 'Duplicate/Invalid',
  financial_metric: 'Financial Metric',
  risk_signal: 'Risk Signal',
  opportunity: 'Opportunity',
};

interface InsightCardProps {
  insight: InsightItem;
  compact?: boolean;
  onFix?: (insight: InsightItem) => void;
  className?: string;
}

export function InsightCard({
  insight,
  compact = false,
  onFix,
  className,
}: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { openLinkedEntity } = useCrossModuleNavigation();

  const severityConfig = SEVERITY_CONFIG[insight.severity];
  const SeverityIcon = severityConfig.icon;

  const handleEntityClick = (entity: GRDCSLinkedEntity) => {
    openLinkedEntity(entity);
  };

  const handleFixClick = () => {
    if (onFix) {
      onFix(insight);
    } else if (insight.affectedEntities.length === 1) {
      // Navigate to the affected entity
      openLinkedEntity(insight.affectedEntities[0]);
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-start gap-3 p-3 rounded-lg border',
          severityConfig.bgColor,
          severityConfig.borderColor,
          className
        )}
      >
        <SeverityIcon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', severityConfig.color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{insight.title}</p>
          {insight.affectedEntities.length > 0 && (
            <button
              onClick={() => handleEntityClick(insight.affectedEntities[0])}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
            >
              {insight.affectedEntities[0].name}
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
        <Badge variant="outline" className={cn('text-xs', severityConfig.color)}>
          {severityConfig.label}
        </Badge>
      </div>
    );
  }

  return (
    <Card className={cn(severityConfig.bgColor, severityConfig.borderColor, className)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <SeverityIcon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', severityConfig.color)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm">{insight.title}</h4>
              <Badge variant="outline" className={cn('text-xs', severityConfig.color)}>
                {severityConfig.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {CATEGORY_LABELS[insight.category]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
          </div>
        </div>

        {/* Affected Entities Preview */}
        {insight.affectedEntities.length > 0 && (
          <div className="mt-3 pl-8">
            <p className="text-xs text-muted-foreground mb-2">
              Affected entities ({insight.affectedEntities.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {insight.affectedEntities.slice(0, 3).map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => handleEntityClick(entity)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-background/50 rounded border hover:bg-background transition-colors"
                >
                  <span className="truncate max-w-[120px]">{entity.name}</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </button>
              ))}
              {insight.affectedEntities.length > 3 && (
                <span className="text-xs text-muted-foreground px-2 py-1">
                  +{insight.affectedEntities.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Expandable Recommended Fix */}
        <div className="mt-3 pl-8">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {isExpanded ? 'Hide' : 'Show'} recommended fix
          </button>

          {isExpanded && (
            <div className="mt-2 p-3 bg-background/50 rounded-lg border">
              <div className="flex items-start gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm">{insight.recommendedFix}</p>
              </div>
            </div>
          )}
        </div>

        {/* CTA Buttons */}
        <div className="mt-4 pl-8 flex items-center gap-2">
          {insight.affectedEntities.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFixClick}
              className="gap-1"
            >
              <Wrench className="h-3 w-3" />
              Fix Now
            </Button>
          )}
          {insight.affectedEntities.length === 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEntityClick(insight.affectedEntities[0])}
              className="gap-1"
            >
              View Entity
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * SeverityBadge - Standalone severity badge
 */
interface SeverityBadgeProps {
  severity: InsightSeverity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1', config.color, config.borderColor, className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default InsightCard;

'use client';

/**
 * INSIGHT CARD
 * Phase 9 Task 9.5 - Unified UI Components for Insights & Health
 *
 * Displays a single insight with:
 * - Severity indicator
 * - Category badge
 * - Title and description
 * - Affected entities list
 * - Recommended fix action
 * - CMNF navigation integration
 */

import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  ExternalLink,
  Lightbulb,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InsightItem, InsightSeverity } from '@/lib/sync/types';
import { GRDCSEntityType } from '@/lib/grdcs';

// =============================================================================
// SEVERITY CONFIGURATION
// =============================================================================

const SEVERITY_CONFIG: Record<InsightSeverity, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  label: string;
}> = {
  critical: {
    icon: AlertOctagon,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800/50',
    badgeVariant: 'destructive',
    label: 'Critical',
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800/50',
    badgeVariant: 'destructive',
    label: 'High',
  },
  medium: {
    icon: AlertCircle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
    badgeVariant: 'secondary',
    label: 'Medium',
  },
  low: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800/50',
    badgeVariant: 'default',
    label: 'Low',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  missing_link: 'Missing Link',
  orphaned_entity: 'Orphaned Entity',
  cross_module_health: 'Cross-Module',
  data_completeness: 'Completeness',
  structural_gap: 'Structure',
  duplicate_invalid: 'Duplicate/Invalid',
  financial_metric: 'Financial',
  risk_signal: 'Risk',
  opportunity: 'Opportunity',
};

// =============================================================================
// COMPONENT
// =============================================================================

export interface InsightCardProps {
  /** The insight to display */
  insight: InsightItem;
  /** Compact mode for list views */
  compact?: boolean;
  /** Show affected entities */
  showEntities?: boolean;
  /** Show recommended fix */
  showFix?: boolean;
  /** Callback when entity is clicked */
  onEntityClick?: (entityType: GRDCSEntityType, entityId: string, entityName: string) => void;
  /** Callback when fix action is clicked */
  onFixClick?: (insight: InsightItem) => void;
  /** Custom class name */
  className?: string;
}

export function InsightCard({
  insight,
  compact = false,
  showEntities = true,
  showFix = true,
  onEntityClick,
  onFixClick,
  className = '',
}: InsightCardProps) {
  const config = SEVERITY_CONFIG[insight.severity];
  const SeverityIcon = config.icon;
  const categoryLabel = CATEGORY_LABELS[insight.category] || insight.category;

  if (compact) {
    return (
      <div
        className={`
          flex items-center gap-3 p-3 rounded-lg border
          ${config.bgColor} ${config.borderColor}
          hover:shadow-sm transition-shadow
          ${className}
        `}
      >
        <SeverityIcon className={`h-5 w-5 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-slate-900 dark:text-white truncate">
              {insight.title}
            </span>
            <Badge variant={config.badgeVariant} className="text-xs shrink-0">
              {config.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {insight.description}
          </p>
        </div>
        {onFixClick && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 shrink-0 ${config.color}`}
            onClick={() => onFixClick(insight)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={`${config.borderColor} border ${className}`}>
      <CardHeader className={`pb-3 ${config.bgColor} rounded-t-lg`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <SeverityIcon className={`h-5 w-5 shrink-0 ${config.color}`} />
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">
              {insight.title}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="text-xs">
              {categoryLabel}
            </Badge>
            <Badge variant={config.badgeVariant} className="text-xs">
              {config.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Description */}
        <p className="text-sm text-muted-foreground">{insight.description}</p>

        {/* Affected Entities */}
        {showEntities && insight.affectedEntities.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Affected Entities
            </span>
            <div className="flex flex-wrap gap-1.5">
              {insight.affectedEntities.slice(0, 5).map((entity, index) => (
                <Button
                  key={`${entity.id}-${index}`}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onEntityClick?.(entity.type as GRDCSEntityType, entity.id, entity.name)}
                >
                  {entity.name}
                  <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                </Button>
              ))}
              {insight.affectedEntities.length > 5 && (
                <Badge variant="secondary" className="text-xs">
                  +{insight.affectedEntities.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Recommended Fix */}
        {showFix && insight.recommendedFix && (
          <div className={`p-3 rounded-md ${config.bgColor} border ${config.borderColor}`}>
            <div className="flex items-start gap-2">
              <Lightbulb className={`h-4 w-4 shrink-0 mt-0.5 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Recommended Action
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                  {insight.recommendedFix}
                </p>
              </div>
            </div>
            {onFixClick && (
              <Button
                variant="outline"
                size="sm"
                className={`mt-2 w-full ${config.color}`}
                onClick={() => onFixClick(insight)}
              >
                Fix in Context
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        )}

        {/* Metadata */}
        {insight.metadata && Object.keys(insight.metadata).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            {Object.entries(insight.metadata).slice(0, 4).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}: </span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {typeof value === 'number' ? value.toLocaleString() : String(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InsightCard;

'use client';

/**
 * HEALTH SUMMARY WIDGET
 * Phase 9 Task 9.5 - Unified UI Components for Insights & Health
 *
 * Small, reusable summary block designed for:
 * - Dashboard sidebar
 * - Module pages
 * - Dialog headers
 *
 * Displays:
 * - Completeness score
 * - Orphan count
 * - Missing links count
 * - Module-by-module issue index
 *
 * Refreshed via UI Sync Engine.
 */

import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Link2Off,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LinkageHealthState, HealthSeverity, ModuleBreakdown } from '@/lib/sync/types';

// =============================================================================
// SEVERITY CONFIGURATION
// =============================================================================

const SEVERITY_CONFIG: Record<HealthSeverity, {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  healthy: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800/50',
    label: 'Healthy',
    icon: CheckCircle2,
  },
  warning: {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
    label: 'Warning',
    icon: AlertTriangle,
  },
  high: {
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800/50',
    label: 'Attention',
    icon: AlertTriangle,
  },
  critical: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800/50',
    label: 'Critical',
    icon: AlertTriangle,
  },
};

const MODULE_LABELS: Record<keyof ModuleBreakdown, string> = {
  properties: 'Properties',
  loans: 'Loans',
  accounts: 'Accounts',
  offsetAccounts: 'Offset Accounts',
  income: 'Income',
  expenses: 'Expenses',
  investmentAccounts: 'Investment Accounts',
  holdings: 'Holdings',
  transactions: 'Transactions',
};

// =============================================================================
// COMPONENT
// =============================================================================

export interface HealthSummaryWidgetProps {
  /** Linkage health state from UI Sync Engine */
  health: LinkageHealthState | null;
  /** Loading state */
  isLoading?: boolean;
  /** Compact variant for sidebar/dialog */
  compact?: boolean;
  /** Show module breakdown */
  showModules?: boolean;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Callback when refresh is clicked */
  onRefresh?: () => void;
  /** Callback when details are clicked */
  onViewDetails?: () => void;
  /** Custom class name */
  className?: string;
}

export function HealthSummaryWidget({
  health,
  isLoading = false,
  compact = false,
  showModules = true,
  showRefresh = false,
  onRefresh,
  onViewDetails,
  className = '',
}: HealthSummaryWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Loading state
  if (isLoading && !health) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-6">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!health) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-6">
          <Activity className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Health data unavailable</p>
        </CardContent>
      </Card>
    );
  }

  const config = SEVERITY_CONFIG[health.severity];
  const SeverityIcon = config.icon;

  // Get modules with issues
  const modulesWithIssues = Object.entries(health.moduleBreakdown)
    .filter(([_, metrics]) => metrics.orphanCount > 0 || metrics.missingCount > 0)
    .sort((a, b) => {
      const aTotal = a[1].orphanCount + a[1].missingCount;
      const bTotal = b[1].orphanCount + b[1].missingCount;
      return bTotal - aTotal;
    });

  // Compact variant
  if (compact) {
    return (
      <div className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SeverityIcon className={`h-4 w-4 ${config.color}`} />
            <span className={`text-sm font-medium ${config.color}`}>
              {config.label}
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            {health.completenessScore}%
          </Badge>
        </div>
        {(health.orphanCount > 0 || health.missingLinks.length > 0) && (
          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
            {health.orphanCount > 0 && (
              <span className="flex items-center gap-1">
                <Link2Off className="h-3 w-3" />
                {health.orphanCount} orphan{health.orphanCount !== 1 ? 's' : ''}
              </span>
            )}
            {health.missingLinks.length > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {health.missingLinks.length} missing
              </span>
            )}
          </div>
        )}
        {onViewDetails && (
          <Button
            variant="ghost"
            size="sm"
            className={`w-full mt-2 h-7 text-xs ${config.color}`}
            onClick={onViewDetails}
          >
            View Details
          </Button>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <Card className={`${config.borderColor} border ${className}`}>
      <CardHeader className={`pb-3 ${config.bgColor} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className={`h-5 w-5 ${config.color}`} />
            Portfolio Health
          </CardTitle>
          <div className="flex items-center gap-2">
            {showRefresh && onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Badge variant="outline" className={config.color}>
              <SeverityIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Main Scores */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {health.completenessScore}%
            </div>
            <div className="text-xs text-muted-foreground">Completeness</div>
            <Progress value={health.completenessScore} className="h-1 mt-1" />
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {health.crossModuleConsistency}%
            </div>
            <div className="text-xs text-muted-foreground">Consistency</div>
            <Progress value={health.crossModuleConsistency} className="h-1 mt-1" />
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${health.orphanCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
              {health.orphanCount}
            </div>
            <div className="text-xs text-muted-foreground">Orphans</div>
          </div>
        </div>

        {/* Issue Summary */}
        {health.missingLinks.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm text-amber-700 dark:text-amber-300">
              {health.missingLinks.length} missing link{health.missingLinks.length !== 1 ? 's' : ''} detected
            </span>
          </div>
        )}

        {/* Module Breakdown */}
        {showModules && modulesWithIssues.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between h-8 px-2"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <span className="text-xs font-medium text-muted-foreground">
                {modulesWithIssues.length} module{modulesWithIssues.length !== 1 ? 's' : ''} with issues
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {isExpanded && (
              <div className="space-y-2 pt-2 border-t">
                {modulesWithIssues.slice(0, 5).map(([module, metrics]) => (
                  <div
                    key={module}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {MODULE_LABELS[module as keyof ModuleBreakdown]}
                    </span>
                    <div className="flex items-center gap-2">
                      {metrics.orphanCount > 0 && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                          {metrics.orphanCount} orphan{metrics.orphanCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {metrics.missingCount > 0 && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          {metrics.missingCount} missing
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {modulesWithIssues.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{modulesWithIssues.length - 5} more...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* View Details Button */}
        {onViewDetails && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onViewDetails}
          >
            View Health Details
          </Button>
        )}

        {/* Last Updated */}
        <div className="text-xs text-muted-foreground text-center">
          Updated: {new Date(health.generatedAt).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}

export default HealthSummaryWidget;

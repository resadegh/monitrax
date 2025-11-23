'use client';

/**
 * MODULE HEALTH BLOCK
 * Phase 9 Task 9.5 - Unified UI Components for Insights & Health
 *
 * Used on module dashboards to show:
 * - Module name
 * - Issue counts
 * - Consistency score
 * - Status gauge
 * - "Open module insights" link
 * - "Open health modal"
 */

import React from 'react';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Link2Off,
  ExternalLink,
  Home,
  Banknote,
  Wallet,
  TrendingUp,
  TrendingDown,
  Briefcase,
  PieChart,
  ArrowLeftRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { HealthMetrics } from '@/lib/sync/types';

// =============================================================================
// MODULE CONFIGURATION
// =============================================================================

type ModuleName =
  | 'properties'
  | 'loans'
  | 'accounts'
  | 'offsetAccounts'
  | 'income'
  | 'expenses'
  | 'investmentAccounts'
  | 'holdings'
  | 'transactions';

const MODULE_CONFIG: Record<ModuleName, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
}> = {
  properties: {
    label: 'Properties',
    icon: Home,
    href: '/dashboard/properties',
    color: 'text-blue-600 dark:text-blue-400',
  },
  loans: {
    label: 'Loans',
    icon: Banknote,
    href: '/dashboard/loans',
    color: 'text-purple-600 dark:text-purple-400',
  },
  accounts: {
    label: 'Accounts',
    icon: Wallet,
    href: '/dashboard/accounts',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  offsetAccounts: {
    label: 'Offset Accounts',
    icon: Wallet,
    href: '/dashboard/accounts',
    color: 'text-teal-600 dark:text-teal-400',
  },
  income: {
    label: 'Income',
    icon: TrendingUp,
    href: '/dashboard/income',
    color: 'text-green-600 dark:text-green-400',
  },
  expenses: {
    label: 'Expenses',
    icon: TrendingDown,
    href: '/dashboard/expenses',
    color: 'text-red-600 dark:text-red-400',
  },
  investmentAccounts: {
    label: 'Investment Accounts',
    icon: Briefcase,
    href: '/dashboard/investments/accounts',
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  holdings: {
    label: 'Holdings',
    icon: PieChart,
    href: '/dashboard/investments/holdings',
    color: 'text-orange-600 dark:text-orange-400',
  },
  transactions: {
    label: 'Transactions',
    icon: ArrowLeftRight,
    href: '/dashboard/investments/transactions',
    color: 'text-pink-600 dark:text-pink-400',
  },
};

// =============================================================================
// STATUS HELPERS
// =============================================================================

function getStatusConfig(metrics: HealthMetrics): {
  status: 'healthy' | 'warning' | 'critical';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
} {
  const hasOrphans = metrics.orphanCount > 0;
  const hasMissing = metrics.missingCount > 0;
  const hasInvalid = metrics.invalidLinks > 0;
  const lowCompleteness = metrics.completeness < 70;

  if (hasInvalid || (hasOrphans && metrics.orphanCount > 3) || metrics.completeness < 50) {
    return {
      status: 'critical',
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
    };
  }

  if (hasOrphans || hasMissing || lowCompleteness) {
    return {
      status: 'warning',
      icon: AlertCircle,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    };
  }

  return {
    status: 'healthy',
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export interface ModuleHealthBlockProps {
  /** Module identifier */
  module: ModuleName;
  /** Health metrics for this module */
  metrics: HealthMetrics;
  /** Show navigation links */
  showLinks?: boolean;
  /** Compact variant */
  compact?: boolean;
  /** Callback when "Open insights" is clicked */
  onOpenInsights?: (module: ModuleName) => void;
  /** Callback when "Open health modal" is clicked */
  onOpenHealthModal?: () => void;
  /** Custom class name */
  className?: string;
}

export function ModuleHealthBlock({
  module,
  metrics,
  showLinks = true,
  compact = false,
  onOpenInsights,
  onOpenHealthModal,
  className = '',
}: ModuleHealthBlockProps) {
  const config = MODULE_CONFIG[module];
  const status = getStatusConfig(metrics);
  const ModuleIcon = config.icon;
  const StatusIcon = status.icon;

  const totalIssues = metrics.orphanCount + metrics.missingCount + metrics.invalidLinks;

  // Compact variant
  if (compact) {
    return (
      <div
        className={`
          flex items-center justify-between p-2 rounded-lg border
          ${status.bgColor} border-slate-200 dark:border-slate-700
          ${className}
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ModuleIcon className={`h-4 w-4 shrink-0 ${config.color}`} />
          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalIssues > 0 ? (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {totalIssues}
            </Badge>
          ) : (
            <StatusIcon className={`h-4 w-4 ${status.color}`} />
          )}
          <span className={`text-xs font-medium ${status.color}`}>
            {metrics.completeness}%
          </span>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <Card className={`${className}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${status.bgColor}`}>
              <ModuleIcon className={`h-4 w-4 ${config.color}`} />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {config.label}
            </h3>
          </div>
          <Badge
            variant="outline"
            className={`${status.color} border-current`}
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.status === 'healthy' ? 'Healthy' : status.status === 'warning' ? 'Warning' : 'Critical'}
          </Badge>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Completeness</div>
            <div className="flex items-center gap-2">
              <Progress value={metrics.completeness} className="h-2 flex-1" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {metrics.completeness}%
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className={`text-lg font-bold ${metrics.orphanCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                {metrics.orphanCount}
              </div>
              <div className="text-[10px] text-muted-foreground">Orphans</div>
            </div>
            <div>
              <div className={`text-lg font-bold ${metrics.missingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                {metrics.missingCount}
              </div>
              <div className="text-[10px] text-muted-foreground">Missing</div>
            </div>
            <div>
              <div className={`text-lg font-bold ${metrics.invalidLinks > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                {metrics.invalidLinks}
              </div>
              <div className="text-[10px] text-muted-foreground">Invalid</div>
            </div>
          </div>
        </div>

        {/* Issue Summary */}
        {totalIssues > 0 && (
          <div className={`flex items-center gap-2 p-2 rounded-md ${status.bgColor} mb-3`}>
            <Link2Off className={`h-4 w-4 ${status.color}`} />
            <span className={`text-sm ${status.color}`}>
              {totalIssues} issue{totalIssues !== 1 ? 's' : ''} need attention
            </span>
          </div>
        )}

        {/* Action Buttons */}
        {showLinks && (
          <div className="flex gap-2">
            {onOpenInsights && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => onOpenInsights(module)}
              >
                <Activity className="h-3 w-3 mr-1" />
                Module Insights
              </Button>
            )}
            {onOpenHealthModal && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={onOpenHealthModal}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Health Modal
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              asChild
            >
              <a href={config.href}>
                <ChevronRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MODULE HEALTH GRID
// =============================================================================

export interface ModuleHealthGridProps {
  /** Module breakdown from health state */
  moduleBreakdown: Record<ModuleName, HealthMetrics>;
  /** Show only modules with issues */
  onlyWithIssues?: boolean;
  /** Compact display */
  compact?: boolean;
  /** Callback for insights */
  onOpenInsights?: (module: ModuleName) => void;
  /** Callback for health modal */
  onOpenHealthModal?: () => void;
  /** Custom class name */
  className?: string;
}

export function ModuleHealthGrid({
  moduleBreakdown,
  onlyWithIssues = false,
  compact = false,
  onOpenInsights,
  onOpenHealthModal,
  className = '',
}: ModuleHealthGridProps) {
  const modules = Object.entries(moduleBreakdown) as [ModuleName, HealthMetrics][];

  const filteredModules = onlyWithIssues
    ? modules.filter(([_, metrics]) =>
        metrics.orphanCount > 0 || metrics.missingCount > 0 || metrics.invalidLinks > 0
      )
    : modules;

  if (filteredModules.length === 0) {
    return (
      <div className={`text-center py-6 ${className}`}>
        <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
        <p className="text-sm text-muted-foreground">All modules are healthy</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} ${className}`}>
      {filteredModules.map(([module, metrics]) => (
        <ModuleHealthBlock
          key={module}
          module={module}
          metrics={metrics}
          compact={compact}
          showLinks={!compact}
          onOpenInsights={onOpenInsights}
          onOpenHealthModal={onOpenHealthModal}
        />
      ))}
    </div>
  );
}

export default ModuleHealthBlock;

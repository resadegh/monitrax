'use client';

/**
 * GlobalHealthIndicator Component
 * Phase 9 Task 9.1 - Unified Navigation Layer
 *
 * Shows global health status in header.
 * - Fetches from GET /api/linkage/health
 * - Color-coded severity (green, yellow, orange, red)
 * - Tooltip showing summary breakdown
 * - Click opens modal with detailed health metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Link2,
  Link2Off,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { LinkageHealthResponse, ModuleBreakdown, HealthMetrics } from '@/lib/intelligence/linkageHealthService';

// Severity configuration
const SEVERITY_CONFIG = {
  healthy: {
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: CheckCircle2,
    label: 'Healthy',
  },
  warning: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    icon: AlertTriangle,
    label: 'Warning',
  },
  high: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    icon: AlertCircle,
    label: 'High',
  },
  critical: {
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: XCircle,
    label: 'Critical',
  },
};

// Module display configuration
const MODULE_CONFIG: Record<keyof ModuleBreakdown, { label: string; icon: string }> = {
  properties: { label: 'Properties', icon: '🏠' },
  loans: { label: 'Loans', icon: '🏦' },
  accounts: { label: 'Accounts', icon: '💳' },
  offsetAccounts: { label: 'Offset Accounts', icon: '💰' },
  income: { label: 'Income', icon: '📈' },
  expenses: { label: 'Expenses', icon: '📉' },
  investmentAccounts: { label: 'Investment Accounts', icon: '📊' },
  holdings: { label: 'Holdings', icon: '📦' },
  transactions: { label: 'Transactions', icon: '💱' },
};

interface GlobalHealthIndicatorProps {
  className?: string;
  compact?: boolean;
}

export function GlobalHealthIndicator({
  className,
  compact = false,
}: GlobalHealthIndicatorProps) {
  const [health, setHealth] = useState<LinkageHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/linkage/health');

      if (!response.ok) {
        throw new Error('Failed to fetch health data');
      }

      const data = await response.json();
      setHealth(data);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchHealth();

    // Poll every 60 seconds
    const interval = setInterval(fetchHealth, 60000);

    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Loading state
  if (isLoading && !health) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading health...</span>
      </div>
    );
  }

  // Error state
  if (error && !health) {
    return (
      <Tooltip content={error}>
        <button
          onClick={fetchHealth}
          className={cn('flex items-center gap-2 text-red-600', className)}
        >
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">Health unavailable</span>
        </button>
      </Tooltip>
    );
  }

  if (!health) return null;

  const severityConfig = SEVERITY_CONFIG[health.severity];
  const SeverityIcon = severityConfig.icon;

  // Tooltip content
  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-semibold">{severityConfig.label} Status</div>
      <div className="text-xs space-y-0.5">
        <div>Completeness: {health.completenessScore}%</div>
        <div>Orphans: {health.orphanCount}</div>
        <div>Missing Links: {health.missingLinks.length}</div>
      </div>
      <div className="text-xs text-muted-foreground pt-1">Click for details</div>
    </div>
  );

  return (
    <>
      <Tooltip content={tooltipContent} side="bottom">
        <button
          onClick={() => setIsModalOpen(true)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors',
            severityConfig.bgColor,
            severityConfig.borderColor,
            'hover:opacity-80',
            className
          )}
        >
          <SeverityIcon className={cn('h-4 w-4', severityConfig.color)} />
          {!compact && (
            <>
              <span className={cn('text-sm font-medium', severityConfig.color)}>
                {health.completenessScore}%
              </span>
              <span className="text-xs text-muted-foreground">
                Health
              </span>
            </>
          )}
        </button>
      </Tooltip>

      {/* Health Detail Modal */}
      <HealthDetailModal
        health={health}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRefresh={fetchHealth}
        isRefreshing={isLoading}
        lastFetched={lastFetched}
      />
    </>
  );
}

interface HealthDetailModalProps {
  health: LinkageHealthResponse;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastFetched: Date | null;
}

function HealthDetailModal({
  health,
  isOpen,
  onClose,
  onRefresh,
  isRefreshing,
  lastFetched,
}: HealthDetailModalProps) {
  const severityConfig = SEVERITY_CONFIG[health.severity];
  const SeverityIcon = severityConfig.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Linkage Health Dashboard
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="gap-1"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>
          <DialogDescription>
            Global relational integrity status across all modules
            {lastFetched && (
              <span className="text-xs ml-2">
                (Updated {lastFetched.toLocaleTimeString()})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Overall Health Score */}
        <div className={cn(
          'p-4 rounded-lg border',
          severityConfig.bgColor,
          severityConfig.borderColor
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <SeverityIcon className={cn('h-6 w-6', severityConfig.color)} />
              <span className={cn('text-lg font-semibold', severityConfig.color)}>
                {severityConfig.label}
              </span>
            </div>
            <span className={cn('text-3xl font-bold', severityConfig.color)}>
              {health.completenessScore}%
            </span>
          </div>
          <Progress value={health.completenessScore} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Cross-Module Consistency: {health.crossModuleConsistency}%</span>
            <span>
              {health.orphanCount} orphans | {health.missingLinks.length} missing links
            </span>
          </div>
        </div>

        {/* Module Breakdown */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Module Breakdown
          </h3>
          <div className="grid gap-2">
            {Object.entries(health.moduleBreakdown).map(([key, metrics]) => {
              const moduleConfig = MODULE_CONFIG[key as keyof ModuleBreakdown];
              return (
                <ModuleHealthRow
                  key={key}
                  label={moduleConfig.label}
                  icon={moduleConfig.icon}
                  metrics={metrics}
                />
              );
            })}
          </div>
        </div>

        {/* Missing Links Warning */}
        {health.missingLinks.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-amber-600">
              <Link2Off className="h-4 w-4" />
              Missing Links ({health.missingLinks.length})
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {health.missingLinks.slice(0, 5).map((link, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800 text-sm"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span className="flex-1">{link.reason}</span>
                  {link.suggestedAction && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}
              {health.missingLinks.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{health.missingLinks.length - 5} more missing links
                </p>
              )}
            </div>
          </div>
        )}

        {/* Cache Info */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          <p>Generated: {new Date(health.generatedAt).toLocaleString()}</p>
          <p>Cache expires: {new Date(health.cacheExpiresAt).toLocaleString()}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ModuleHealthRowProps {
  label: string;
  icon: string;
  metrics: HealthMetrics;
}

function ModuleHealthRow({ label, icon, metrics }: ModuleHealthRowProps) {
  const getCompletenessColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const hasIssues = metrics.orphanCount > 0 || metrics.missingCount > 0 || metrics.invalidLinks > 0;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <span className="text-lg">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3 text-xs">
        {hasIssues && (
          <div className="flex items-center gap-2 text-muted-foreground">
            {metrics.orphanCount > 0 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {metrics.orphanCount} orphan{metrics.orphanCount !== 1 ? 's' : ''}
              </Badge>
            )}
            {metrics.missingCount > 0 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 border-amber-300 text-amber-600">
                {metrics.missingCount} missing
              </Badge>
            )}
            {metrics.invalidLinks > 0 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 border-red-300 text-red-600">
                {metrics.invalidLinks} invalid
              </Badge>
            )}
          </div>
        )}
        <span className={cn('font-semibold', getCompletenessColor(metrics.completeness))}>
          {metrics.completeness}%
        </span>
      </div>
    </div>
  );
}

export default GlobalHealthIndicator;

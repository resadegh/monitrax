'use client';

/**
 * GLOBAL WARNING RIBBON
 * Phase 9 Task 9.4 - Real-Time Global Health Feed
 *
 * Displays at top of page when:
 * - orphanCount > 0
 * - missingLinks > threshold
 * - crossModuleConsistency < 75
 *
 * Features:
 * - Severity-based colours
 * - Summary text
 * - Clickable to open Health Metrics Modal
 */

import React, { useState, useCallback } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ChevronRight,
  Link2Off,
  AlertOctagon,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { WarningRibbonConfig, HealthSeverity, LinkageHealthState } from '@/lib/sync/types';

// =============================================================================
// SEVERITY STYLES
// =============================================================================

const SEVERITY_STYLES: Record<HealthSeverity, {
  bg: string;
  border: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-950/50',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
    icon: AlertOctagon,
    iconColor: 'text-red-600 dark:text-red-400',
    badgeVariant: 'destructive',
  },
  high: {
    bg: 'bg-orange-50 dark:bg-orange-950/50',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-800 dark:text-orange-200',
    icon: AlertTriangle,
    iconColor: 'text-orange-600 dark:text-orange-400',
    badgeVariant: 'destructive',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-200',
    icon: AlertCircle,
    iconColor: 'text-amber-600 dark:text-amber-400',
    badgeVariant: 'secondary',
  },
  healthy: {
    bg: 'bg-green-50 dark:bg-green-950/50',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-800 dark:text-green-200',
    icon: Info,
    iconColor: 'text-green-600 dark:text-green-400',
    badgeVariant: 'default',
  },
};

const TYPE_ICONS: Record<WarningRibbonConfig['type'], React.ComponentType<{ className?: string }>> = {
  orphan: Link2Off,
  missing_links: AlertTriangle,
  consistency: Activity,
  multiple: AlertCircle,
};

// =============================================================================
// HEALTH METRICS MODAL
// =============================================================================

interface HealthMetricsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  health: LinkageHealthState | null;
}

function HealthMetricsModal({ open, onOpenChange, health }: HealthMetricsModalProps) {
  if (!health) return null;

  const severityStyle = SEVERITY_STYLES[health.severity];
  const SeverityIcon = severityStyle.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Portfolio Health Metrics
          </DialogTitle>
          <DialogDescription>
            Detailed breakdown of your portfolio's data integrity and linkage health.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Overall Health */}
          <div className={`p-4 rounded-lg ${severityStyle.bg} ${severityStyle.border} border`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`font-medium ${severityStyle.text}`}>Overall Status</span>
              <Badge variant={severityStyle.badgeVariant} className="capitalize">
                <SeverityIcon className="h-3 w-3 mr-1" />
                {health.severity}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {health.completenessScore}%
                </div>
                <div className="text-xs text-muted-foreground">Completeness</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {health.crossModuleConsistency}%
                </div>
                <div className="text-xs text-muted-foreground">Consistency</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {health.orphanCount}
                </div>
                <div className="text-xs text-muted-foreground">Orphans</div>
              </div>
            </div>
          </div>

          {/* Module Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Module Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(health.moduleBreakdown).map(([module, metrics]) => (
                <div key={module} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm capitalize">
                      {module.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {metrics.completeness}%
                    </span>
                  </div>
                  <Progress value={metrics.completeness} className="h-2" />
                  {(metrics.orphanCount > 0 || metrics.missingCount > 0) && (
                    <div className="flex gap-2 text-xs">
                      {metrics.orphanCount > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          {metrics.orphanCount} orphan{metrics.orphanCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {metrics.missingCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {metrics.missingCount} missing link{metrics.missingCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Missing Links */}
          {health.missingLinks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Missing Links ({health.missingLinks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {health.missingLinks.slice(0, 5).map((link, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-slate-900 dark:text-white">{link.reason}</div>
                        {link.suggestedAction && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {link.suggestedAction}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                  {health.missingLinks.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      +{health.missingLinks.length - 5} more...
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Last Updated */}
          <div className="text-xs text-muted-foreground text-center">
            Last updated: {new Date(health.generatedAt).toLocaleString()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export interface GlobalWarningRibbonProps {
  /** Warning ribbon configuration from sync engine */
  config: WarningRibbonConfig;
  /** Full health state for modal */
  health?: LinkageHealthState | null;
  /** Allow dismissing the ribbon (persists for session) */
  dismissible?: boolean;
  /** Callback when ribbon is clicked */
  onClick?: () => void;
  /** Class name for custom styling */
  className?: string;
}

export function GlobalWarningRibbon({
  config,
  health = null,
  dismissible = true,
  onClick,
  className = '',
}: GlobalWarningRibbonProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else if (health) {
      setIsModalOpen(true);
    }
  }, [onClick, health]);

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  }, []);

  // Don't render if not showing or dismissed
  if (!config.show || isDismissed) {
    return null;
  }

  const severityStyle = SEVERITY_STYLES[config.severity];
  const SeverityIcon = severityStyle.icon;
  const TypeIcon = TYPE_ICONS[config.type];

  return (
    <>
      <div
        role="alert"
        onClick={handleClick}
        className={`
          w-full px-4 py-2.5 border-b cursor-pointer
          flex items-center justify-between gap-4
          transition-all duration-200
          hover:opacity-90
          ${severityStyle.bg}
          ${severityStyle.border}
          ${className}
        `}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 ${severityStyle.iconColor}`}>
            <SeverityIcon className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <TypeIcon className={`h-4 w-4 shrink-0 ${severityStyle.iconColor}`} />
            <span className={`font-medium truncate ${severityStyle.text}`}>
              {config.title}
            </span>
            {config.description && (
              <>
                <span className="text-slate-400 dark:text-slate-600">|</span>
                <span className={`text-sm truncate opacity-80 ${severityStyle.text}`}>
                  {config.description}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 ${severityStyle.text} hover:bg-black/5 dark:hover:bg-white/5`}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          >
            View Details
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          {dismissible && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${severityStyle.text} hover:bg-black/5 dark:hover:bg-white/5`}
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>

      {/* Health Metrics Modal */}
      <HealthMetricsModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        health={health}
      />
    </>
  );
}

export default GlobalWarningRibbon;

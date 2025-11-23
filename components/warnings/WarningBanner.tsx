'use client';

/**
 * UNIFIED WARNING BANNER
 * Phase 9 Task 9.5 - Unified UI Components for Insights & Health
 *
 * Standardized warning banner to replace inconsistent warnings across the UI.
 *
 * Levels: critical | high | warning | info
 *
 * Used in:
 * - Dashboard screens
 * - Module pages
 * - Entity dialogs
 * - Inline GRDCS links
 *
 * CTA options:
 * - "View health details" → opens health modal
 * - "Fix in context" → CMNF navigation
 */

import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ChevronRight,
  ExternalLink,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GRDCSEntityType } from '@/lib/grdcs';

// =============================================================================
// TYPES
// =============================================================================

export type WarningLevel = 'critical' | 'high' | 'warning' | 'info';

export interface WarningBannerAction {
  /** Button label */
  label: string;
  /** Action type */
  type: 'health_modal' | 'fix_in_context' | 'navigate' | 'custom';
  /** For navigate type: entity type */
  entityType?: GRDCSEntityType;
  /** For navigate type: entity id */
  entityId?: string;
  /** For custom type: click handler */
  onClick?: () => void;
  /** Custom href */
  href?: string;
}

// =============================================================================
// LEVEL CONFIGURATION
// =============================================================================

const LEVEL_CONFIG: Record<WarningLevel, {
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
  label: string;
}> = {
  critical: {
    icon: AlertOctagon,
    bgColor: 'bg-red-50 dark:bg-red-950/50',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-800 dark:text-red-200',
    iconColor: 'text-red-600 dark:text-red-400',
    label: 'Critical',
  },
  high: {
    icon: AlertTriangle,
    bgColor: 'bg-orange-50 dark:bg-orange-950/50',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-800 dark:text-orange-200',
    iconColor: 'text-orange-600 dark:text-orange-400',
    label: 'High',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-amber-50 dark:bg-amber-950/50',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-800 dark:text-amber-200',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Warning',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-950/50',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-800 dark:text-blue-200',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'Info',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export interface WarningBannerProps {
  /** Warning level */
  level: WarningLevel;
  /** Main message */
  message: string;
  /** Optional detailed description */
  description?: string;
  /** Primary action */
  action?: WarningBannerAction;
  /** Secondary action */
  secondaryAction?: WarningBannerAction;
  /** Allow dismissing */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Callback when "View health details" is clicked */
  onViewHealthDetails?: () => void;
  /** Callback for CMNF navigation */
  onNavigate?: (entityType: GRDCSEntityType, entityId: string) => void;
  /** Variant */
  variant?: 'default' | 'inline' | 'compact';
  /** Custom class name */
  className?: string;
}

export function WarningBanner({
  level,
  message,
  description,
  action,
  secondaryAction,
  dismissible = false,
  onDismiss,
  onViewHealthDetails,
  onNavigate,
  variant = 'default',
  className = '',
}: WarningBannerProps) {
  const config = LEVEL_CONFIG[level];
  const LevelIcon = config.icon;

  const handleAction = (actionConfig: WarningBannerAction) => {
    switch (actionConfig.type) {
      case 'health_modal':
        onViewHealthDetails?.();
        break;
      case 'fix_in_context':
      case 'navigate':
        if (actionConfig.entityType && actionConfig.entityId) {
          onNavigate?.(actionConfig.entityType, actionConfig.entityId);
        } else if (actionConfig.href) {
          window.location.href = actionConfig.href;
        }
        break;
      case 'custom':
        actionConfig.onClick?.();
        break;
    }
  };

  // Inline variant (minimal, for GRDCS links)
  if (variant === 'inline') {
    return (
      <span
        className={`
          inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
          ${config.bgColor} ${config.textColor}
          ${className}
        `}
      >
        <LevelIcon className={`h-3 w-3 ${config.iconColor}`} />
        <span>{message}</span>
      </span>
    );
  }

  // Compact variant (for dialogs/cards)
  if (variant === 'compact') {
    return (
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-md border
          ${config.bgColor} ${config.borderColor}
          ${className}
        `}
      >
        <LevelIcon className={`h-4 w-4 shrink-0 ${config.iconColor}`} />
        <span className={`text-sm flex-1 ${config.textColor}`}>{message}</span>
        {action && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-xs ${config.textColor}`}
            onClick={() => handleAction(action)}
          >
            {action.label}
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        )}
        {dismissible && onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 ${config.textColor}`}
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  // Default variant (full banner)
  return (
    <div
      className={`
        p-4 rounded-lg border
        ${config.bgColor} ${config.borderColor}
        ${className}
      `}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <LevelIcon className={`h-5 w-5 shrink-0 mt-0.5 ${config.iconColor}`} />

        <div className="flex-1 min-w-0">
          {/* Message */}
          <div className={`font-medium ${config.textColor}`}>
            {message}
          </div>

          {/* Description */}
          {description && (
            <p className={`text-sm mt-1 opacity-90 ${config.textColor}`}>
              {description}
            </p>
          )}

          {/* Actions */}
          {(action || secondaryAction) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {action && (
                <Button
                  variant="outline"
                  size="sm"
                  className={`${config.textColor} border-current hover:bg-white/50 dark:hover:bg-black/20`}
                  onClick={() => handleAction(action)}
                >
                  {action.type === 'health_modal' && <Activity className="h-3 w-3 mr-1" />}
                  {action.type === 'fix_in_context' && <ChevronRight className="h-3 w-3 mr-1" />}
                  {action.type === 'navigate' && <ExternalLink className="h-3 w-3 mr-1" />}
                  {action.label}
                </Button>
              )}
              {secondaryAction && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${config.textColor}`}
                  onClick={() => handleAction(secondaryAction)}
                >
                  {secondaryAction.label}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {dismissible && onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 shrink-0 ${config.textColor} hover:bg-white/50 dark:hover:bg-black/20`}
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CONVENIENCE COMPONENTS
// =============================================================================

export interface QuickWarningProps {
  /** Warning message */
  message: string;
  /** Description */
  description?: string;
  /** Custom class name */
  className?: string;
}

export function CriticalWarning({ message, description, className }: QuickWarningProps) {
  return (
    <WarningBanner
      level="critical"
      message={message}
      description={description}
      className={className}
    />
  );
}

export function HighWarning({ message, description, className }: QuickWarningProps) {
  return (
    <WarningBanner
      level="high"
      message={message}
      description={description}
      className={className}
    />
  );
}

export function Warning({ message, description, className }: QuickWarningProps) {
  return (
    <WarningBanner
      level="warning"
      message={message}
      description={description}
      className={className}
    />
  );
}

export function InfoBanner({ message, description, className }: QuickWarningProps) {
  return (
    <WarningBanner
      level="info"
      message={message}
      description={description}
      className={className}
    />
  );
}

// =============================================================================
// HEALTH-AWARE WARNING
// =============================================================================

export interface HealthAwareWarningProps {
  /** Orphan count */
  orphanCount?: number;
  /** Missing links count */
  missingLinksCount?: number;
  /** Consistency score */
  consistencyScore?: number;
  /** Callback for health modal */
  onViewHealthDetails?: () => void;
  /** Custom class name */
  className?: string;
}

export function HealthAwareWarning({
  orphanCount = 0,
  missingLinksCount = 0,
  consistencyScore = 100,
  onViewHealthDetails,
  className,
}: HealthAwareWarningProps) {
  // Determine level and message based on health metrics
  let level: WarningLevel = 'info';
  let message = '';
  const issues: string[] = [];

  if (orphanCount > 0) {
    issues.push(`${orphanCount} orphaned entit${orphanCount === 1 ? 'y' : 'ies'}`);
  }
  if (missingLinksCount > 0) {
    issues.push(`${missingLinksCount} missing link${missingLinksCount === 1 ? '' : 's'}`);
  }
  if (consistencyScore < 75) {
    issues.push(`${consistencyScore}% consistency`);
  }

  if (issues.length === 0) {
    return null;
  }

  message = issues.join(' • ');

  // Determine severity
  if (consistencyScore < 50 || orphanCount > 5) {
    level = 'critical';
  } else if (consistencyScore < 75 || orphanCount > 2) {
    level = 'high';
  } else if (orphanCount > 0 || missingLinksCount > 3) {
    level = 'warning';
  }

  return (
    <WarningBanner
      level={level}
      message="Data health issues detected"
      description={message}
      action={{
        label: 'View Health Details',
        type: 'health_modal',
      }}
      onViewHealthDetails={onViewHealthDetails}
      className={className}
    />
  );
}

export default WarningBanner;

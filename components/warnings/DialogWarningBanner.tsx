'use client';

/**
 * DIALOG WARNING BANNER
 * Phase 9 Task 9.4 - Real-Time Global Health Feed
 *
 * Displays at top of entity detail dialogs when:
 * - Entity has missing relations
 * - Entity has invalid references
 * - Entity is orphaned
 *
 * Features:
 * - Severity-based styling
 * - Actionable suggestions
 * - Compact design for dialog context
 */

import React from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Link2Off,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityWarning } from '@/lib/sync/types';
import { GRDCSEntityType } from '@/lib/grdcs';

// =============================================================================
// SEVERITY STYLES
// =============================================================================

const SEVERITY_STYLES: Record<EntityWarning['severity'], {
  bg: string;
  border: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}> = {
  error: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800/50',
    text: 'text-red-800 dark:text-red-200',
    icon: AlertTriangle,
    iconColor: 'text-red-600 dark:text-red-400',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    text: 'text-amber-800 dark:text-amber-200',
    icon: AlertCircle,
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800/50',
    text: 'text-blue-800 dark:text-blue-200',
    icon: Info,
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
};

const WARNING_TYPE_ICONS: Record<EntityWarning['type'], React.ComponentType<{ className?: string }>> = {
  missing_relation: Link2Off,
  invalid_reference: AlertTriangle,
  orphaned: AlertCircle,
};

// =============================================================================
// SINGLE WARNING ITEM
// =============================================================================

interface WarningItemProps {
  warning: EntityWarning;
  compact?: boolean;
  onNavigate?: (entityType: GRDCSEntityType) => void;
}

function WarningItem({ warning, compact = false, onNavigate }: WarningItemProps) {
  const style = SEVERITY_STYLES[warning.severity];
  const TypeIcon = WARNING_TYPE_ICONS[warning.type];
  const SeverityIcon = style.icon;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm ${style.text}`}>
        <TypeIcon className={`h-4 w-4 shrink-0 ${style.iconColor}`} />
        <span className="truncate">{warning.message}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 ${style.text}`}>
      <SeverityIcon className={`h-5 w-5 shrink-0 mt-0.5 ${style.iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <TypeIcon className={`h-4 w-4 shrink-0 ${style.iconColor}`} />
          <span className="font-medium capitalize">
            {warning.type.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="text-sm mt-0.5 opacity-90">{warning.message}</p>
        {warning.suggestedAction && (
          <p className="text-xs mt-1 opacity-70">
            Suggestion: {warning.suggestedAction}
          </p>
        )}
        {warning.relatedEntityType && onNavigate && (
          <Button
            variant="link"
            size="sm"
            className={`h-auto p-0 mt-1 ${style.text}`}
            onClick={() => onNavigate(warning.relatedEntityType!)}
          >
            Navigate to {warning.relatedEntityType}
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export interface DialogWarningBannerProps {
  /** Array of warnings for this entity */
  warnings: EntityWarning[];
  /** Show in compact mode (single line summary) */
  compact?: boolean;
  /** Maximum warnings to show before collapsing */
  maxVisible?: number;
  /** Callback when user wants to navigate to related entity */
  onNavigateToEntity?: (entityType: GRDCSEntityType) => void;
  /** Custom class name */
  className?: string;
}

export function DialogWarningBanner({
  warnings,
  compact = false,
  maxVisible = 3,
  onNavigateToEntity,
  className = '',
}: DialogWarningBannerProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Don't render if no warnings
  if (!warnings || warnings.length === 0) {
    return null;
  }

  // Sort by severity (error > warning > info)
  const sortedWarnings = [...warnings].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  // Get most severe warning for styling
  const mostSevere = sortedWarnings[0].severity;
  const style = SEVERITY_STYLES[mostSevere];

  // Compact mode: single line summary
  if (compact) {
    const errorCount = warnings.filter(w => w.severity === 'error').length;
    const warningCount = warnings.filter(w => w.severity === 'warning').length;
    const infoCount = warnings.filter(w => w.severity === 'info').length;

    return (
      <div
        className={`
          px-3 py-2 rounded-md border
          ${style.bg} ${style.border}
          ${className}
        `}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <style.icon className={`h-4 w-4 shrink-0 ${style.iconColor}`} />
            <span className={`text-sm font-medium ${style.text}`}>
              {warnings.length} {warnings.length === 1 ? 'Issue' : 'Issues'} Found
            </span>
            <div className="flex items-center gap-1 text-xs">
              {errorCount > 0 && (
                <span className="text-red-600 dark:text-red-400">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
              )}
              {warningCount > 0 && (
                <>
                  {errorCount > 0 && <span className="text-slate-400">|</span>}
                  <span className="text-amber-600 dark:text-amber-400">{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
                </>
              )}
              {infoCount > 0 && (
                <>
                  {(errorCount > 0 || warningCount > 0) && <span className="text-slate-400">|</span>}
                  <span className="text-blue-600 dark:text-blue-400">{infoCount} info</span>
                </>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-xs ${style.text}`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Hide' : 'Show'}
            <ChevronRight className={`h-3 w-3 ml-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </Button>
        </div>
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-current/10 space-y-2">
            {sortedWarnings.map((warning, index) => (
              <WarningItem
                key={index}
                warning={warning}
                compact
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full mode: detailed warning list
  const visibleWarnings = isExpanded ? sortedWarnings : sortedWarnings.slice(0, maxVisible);
  const hiddenCount = sortedWarnings.length - maxVisible;

  return (
    <div
      className={`
        p-4 rounded-lg border space-y-3
        ${style.bg} ${style.border}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <style.icon className={`h-5 w-5 ${style.iconColor}`} />
          <span className={`font-medium ${style.text}`}>
            {warnings.length} Data {warnings.length === 1 ? 'Issue' : 'Issues'} Detected
          </span>
        </div>
      </div>

      {/* Warning List */}
      <div className="space-y-3">
        {visibleWarnings.map((warning, index) => (
          <WarningItem
            key={index}
            warning={warning}
            onNavigate={onNavigateToEntity}
          />
        ))}
      </div>

      {/* Show More/Less */}
      {hiddenCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className={`w-full ${style.text} hover:bg-black/5 dark:hover:bg-white/5`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show Less' : `Show ${hiddenCount} More`}
          <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// CONVENIENCE WRAPPER
// =============================================================================

export interface EntityWarningBannerProps {
  /** Entity type for context */
  entityType: GRDCSEntityType;
  /** Entity ID */
  entityId: string;
  /** Entity name for display */
  entityName: string;
  /** Missing relations */
  missingRelations?: Array<{
    type: GRDCSEntityType;
    reason: string;
    suggestedAction?: string;
  }>;
  /** Invalid references */
  invalidReferences?: Array<{
    type: GRDCSEntityType;
    reason: string;
  }>;
  /** Is this entity orphaned */
  isOrphaned?: boolean;
  /** Orphan reason */
  orphanReason?: string;
  /** Callback for navigation */
  onNavigateToEntity?: (entityType: GRDCSEntityType) => void;
  /** Custom class name */
  className?: string;
}

export function EntityWarningBanner({
  entityType,
  entityId,
  entityName,
  missingRelations = [],
  invalidReferences = [],
  isOrphaned = false,
  orphanReason,
  onNavigateToEntity,
  className,
}: EntityWarningBannerProps) {
  const warnings: EntityWarning[] = [];

  // Add orphan warning
  if (isOrphaned) {
    warnings.push({
      type: 'orphaned',
      severity: 'error',
      message: orphanReason || `This ${entityType} is not linked to any parent entity`,
      suggestedAction: 'Link this entity to its parent record for accurate tracking',
    });
  }

  // Add missing relation warnings
  for (const missing of missingRelations) {
    warnings.push({
      type: 'missing_relation',
      severity: 'warning',
      message: missing.reason,
      suggestedAction: missing.suggestedAction,
      relatedEntityType: missing.type,
    });
  }

  // Add invalid reference warnings
  for (const invalid of invalidReferences) {
    warnings.push({
      type: 'invalid_reference',
      severity: 'error',
      message: invalid.reason,
      relatedEntityType: invalid.type,
    });
  }

  return (
    <DialogWarningBanner
      warnings={warnings}
      onNavigateToEntity={onNavigateToEntity}
      className={className}
    />
  );
}

export default DialogWarningBanner;

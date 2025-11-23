'use client';

/**
 * INSIGHT BADGES
 * Phase 9 Task 9.5 - Unified UI Components for Insights & Health
 *
 * Collection of inline badge components for:
 * - Severity indicator
 * - Category badge
 * - Entity count badge
 * - Missing relation indicator
 */

import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  Info,
  Link2Off,
  Users,
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InsightSeverity } from '@/lib/sync/types';

// =============================================================================
// SEVERITY BADGE
// =============================================================================

const SEVERITY_CONFIG: Record<InsightSeverity, {
  icon: React.ComponentType<{ className?: string }>;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  label: string;
}> = {
  critical: {
    icon: AlertOctagon,
    variant: 'destructive',
    className: 'bg-red-600 hover:bg-red-700 border-red-600',
    label: 'Critical',
  },
  high: {
    icon: AlertTriangle,
    variant: 'destructive',
    className: 'bg-orange-500 hover:bg-orange-600 border-orange-500',
    label: 'High',
  },
  medium: {
    icon: AlertCircle,
    variant: 'secondary',
    className: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    label: 'Medium',
  },
  low: {
    icon: Info,
    variant: 'outline',
    className: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    label: 'Low',
  },
};

export interface SeverityBadgeProps {
  /** Severity level */
  severity: InsightSeverity;
  /** Show icon */
  showIcon?: boolean;
  /** Show label text */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Custom class name */
  className?: string;
}

export function SeverityBadge({
  severity,
  showIcon = true,
  showLabel = true,
  size = 'md',
  className = '',
}: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`
        ${config.className}
        ${size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'}
        ${className}
      `}
    >
      {showIcon && <Icon className={`${size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} ${showLabel ? 'mr-1' : ''}`} />}
      {showLabel && config.label}
    </Badge>
  );
}

// =============================================================================
// CATEGORY BADGE
// =============================================================================

const CATEGORY_CONFIG: Record<string, {
  color: string;
  label: string;
}> = {
  missing_link: { color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700', label: 'Missing Link' },
  orphaned_entity: { color: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700', label: 'Orphaned' },
  cross_module_health: { color: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700', label: 'Cross-Module' },
  data_completeness: { color: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700', label: 'Completeness' },
  structural_gap: { color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600', label: 'Structure' },
  duplicate_invalid: { color: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-700', label: 'Duplicate' },
  financial_metric: { color: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700', label: 'Financial' },
  risk_signal: { color: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700', label: 'Risk' },
  opportunity: { color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700', label: 'Opportunity' },
};

export interface CategoryBadgeProps {
  /** Category key */
  category: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Custom class name */
  className?: string;
}

export function CategoryBadge({
  category,
  size = 'md',
  className = '',
}: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category] || {
    color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    label: category.replace(/_/g, ' '),
  };

  return (
    <Badge
      variant="outline"
      className={`
        ${config.color}
        ${size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'}
        capitalize
        ${className}
      `}
    >
      <Tag className={`${size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
      {config.label}
    </Badge>
  );
}

// =============================================================================
// ENTITY COUNT BADGE
// =============================================================================

export interface EntityCountBadgeProps {
  /** Number of affected entities */
  count: number;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Custom class name */
  className?: string;
}

export function EntityCountBadge({
  count,
  size = 'md',
  className = '',
}: EntityCountBadgeProps) {
  if (count === 0) return null;

  return (
    <Badge
      variant="secondary"
      className={`
        ${size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'}
        ${className}
      `}
    >
      <Users className={`${size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
      {count} {count === 1 ? 'entity' : 'entities'}
    </Badge>
  );
}

// =============================================================================
// MISSING RELATION INDICATOR
// =============================================================================

export interface MissingRelationIndicatorProps {
  /** Number of missing relations */
  count?: number;
  /** Tooltip text */
  tooltip?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Custom class name */
  className?: string;
}

export function MissingRelationIndicator({
  count = 1,
  tooltip,
  size = 'md',
  className = '',
}: MissingRelationIndicatorProps) {
  return (
    <Badge
      variant="outline"
      className={`
        bg-amber-50 dark:bg-amber-950/50
        text-amber-700 dark:text-amber-300
        border-amber-300 dark:border-amber-700
        ${size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'}
        ${className}
      `}
      title={tooltip || `${count} missing relation${count !== 1 ? 's' : ''}`}
    >
      <Link2Off className={`${size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
      {count} missing
    </Badge>
  );
}

// =============================================================================
// COMBINED INSIGHT BADGE GROUP
// =============================================================================

export interface InsightBadgeGroupProps {
  /** Severity level */
  severity?: InsightSeverity;
  /** Category */
  category?: string;
  /** Entity count */
  entityCount?: number;
  /** Missing relation count */
  missingCount?: number;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Custom class name */
  className?: string;
}

export function InsightBadgeGroup({
  severity,
  category,
  entityCount,
  missingCount,
  size = 'md',
  className = '',
}: InsightBadgeGroupProps) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {severity && (
        <SeverityBadge severity={severity} size={size} />
      )}
      {category && (
        <CategoryBadge category={category} size={size} />
      )}
      {entityCount !== undefined && entityCount > 0 && (
        <EntityCountBadge count={entityCount} size={size} />
      )}
      {missingCount !== undefined && missingCount > 0 && (
        <MissingRelationIndicator count={missingCount} size={size} />
      )}
    </div>
  );
}

export default {
  SeverityBadge,
  CategoryBadge,
  EntityCountBadge,
  MissingRelationIndicator,
  InsightBadgeGroup,
};

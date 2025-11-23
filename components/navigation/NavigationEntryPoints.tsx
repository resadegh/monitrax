'use client';

/**
 * NavigationEntryPoints Component
 * Phase 9 Task 9.1 - Unified Navigation Layer
 *
 * Entity-to-Entity navigation entry points.
 * - "Open in context" button to navigate with breadcrumb trail
 * - "View related" button to see linked entities
 * - All links use CMNF navigation functions (no hardcoded routes)
 */

import React from 'react';
import {
  ExternalLink,
  Link2,
  ArrowRight,
  Eye,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import type { GRDCSEntityType, GRDCSLinkedEntity } from '@/lib/grdcs';
import { cn } from '@/lib/utils';

interface NavigationEntryPointsProps {
  entityType: GRDCSEntityType;
  entityId: string;
  entityName: string;
  linkedEntities?: GRDCSLinkedEntity[];
  onViewRelated?: () => void;
  className?: string;
  variant?: 'default' | 'compact' | 'inline';
}

export function NavigationEntryPoints({
  entityType,
  entityId,
  entityName,
  linkedEntities = [],
  onViewRelated,
  className,
  variant = 'default',
}: NavigationEntryPointsProps) {
  const { navigateToEntity } = useCrossModuleNavigation();

  const handleOpenInContext = () => {
    navigateToEntity(entityType, entityId, entityName);
  };

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenInContext}
          className="h-7 px-2 gap-1"
          title="Open in context"
        >
          <Compass className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only text-xs">Open</span>
        </Button>
        {linkedEntities.length > 0 && onViewRelated && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewRelated}
            className="h-7 px-2 gap-1"
            title={`View ${linkedEntities.length} related`}
          >
            <Link2 className="h-3.5 w-3.5" />
            <span className="text-xs">{linkedEntities.length}</span>
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn('inline-flex items-center gap-2', className)}>
        <button
          onClick={handleOpenInContext}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <span>{entityName}</span>
          <ExternalLink className="h-3 w-3" />
        </button>
        {linkedEntities.length > 0 && onViewRelated && (
          <button
            onClick={onViewRelated}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ({linkedEntities.length} related)
          </button>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenInContext}
        className="gap-2"
      >
        <Compass className="h-4 w-4" />
        Open in context
        <ArrowRight className="h-3 w-3" />
      </Button>
      {linkedEntities.length > 0 && onViewRelated && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewRelated}
          className="gap-2"
        >
          <Link2 className="h-4 w-4" />
          View related ({linkedEntities.length})
        </Button>
      )}
    </div>
  );
}

/**
 * QuickNavigateButton - Minimal navigation entry point
 * For use in tables, lists, etc.
 */
interface QuickNavigateButtonProps {
  entityType: GRDCSEntityType;
  entityId: string;
  entityName: string;
  tab?: string;
  className?: string;
}

export function QuickNavigateButton({
  entityType,
  entityId,
  entityName,
  tab,
  className,
}: QuickNavigateButtonProps) {
  const { navigateToEntity } = useCrossModuleNavigation();

  return (
    <button
      onClick={() => navigateToEntity(entityType, entityId, entityName, { tab })}
      className={cn(
        'inline-flex items-center gap-1 text-sm hover:text-primary hover:underline transition-colors',
        className
      )}
      title={`Navigate to ${entityName}`}
    >
      <span className="truncate">{entityName}</span>
      <ArrowRight className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

/**
 * LinkedEntityLink - Navigate to a linked entity from GRDCS
 * Automatically uses the href from the entity
 */
interface LinkedEntityLinkProps {
  entity: GRDCSLinkedEntity;
  className?: string;
  showIcon?: boolean;
  tab?: string;
}

export function LinkedEntityLink({
  entity,
  className,
  showIcon = true,
  tab,
}: LinkedEntityLinkProps) {
  const { openLinkedEntity } = useCrossModuleNavigation();

  return (
    <button
      onClick={() => openLinkedEntity(entity, { tab })}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm text-primary hover:underline',
        className
      )}
    >
      {showIcon && <Eye className="h-3.5 w-3.5" />}
      <span className="truncate">{entity.name}</span>
    </button>
  );
}

/**
 * ViewAllLinkedButton - Navigate to see all linked entities
 */
interface ViewAllLinkedButtonProps {
  entityType: GRDCSEntityType;
  entityId: string;
  entityName: string;
  linkedCount: number;
  onClick?: () => void;
  className?: string;
}

export function ViewAllLinkedButton({
  entityType,
  entityId,
  entityName,
  linkedCount,
  onClick,
  className,
}: ViewAllLinkedButtonProps) {
  const { navigateToEntity } = useCrossModuleNavigation();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Navigate to entity with linked-data tab
      navigateToEntity(entityType, entityId, entityName, { tab: 'linked-data' });
    }
  };

  if (linkedCount === 0) return null;

  return (
    <Button
      variant="link"
      size="sm"
      onClick={handleClick}
      className={cn('gap-1 p-0 h-auto', className)}
    >
      <Link2 className="h-3.5 w-3.5" />
      View all {linkedCount} linked
    </Button>
  );
}

export default NavigationEntryPoints;

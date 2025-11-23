'use client';

/**
 * CMNF Breadcrumb Component
 * Phase 8 Task 10.8 - Cross-Module Navigation Framework
 *
 * Displays navigation breadcrumb based on relational ancestry.
 */

import React from 'react';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { GRDCSEntityType } from '@/lib/grdcs';
import { getEntityTypeDisplayName } from '@/lib/navigation/routeMap';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  type: GRDCSEntityType;
  id: string;
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  showBackButton?: boolean;
  onNavigate?: (item: BreadcrumbItem) => void;
  className?: string;
}

export function Breadcrumb({
  items: propItems,
  showBackButton = true,
  onNavigate,
  className,
}: BreadcrumbProps) {
  const { breadcrumb: contextItems, goBack, canGoBack, navigateToEntity } = useCrossModuleNavigation();

  // Use provided items or fall back to context
  const items = propItems || contextItems;

  if (items.length === 0) {
    return null;
  }

  const handleItemClick = (item: BreadcrumbItem, index: number) => {
    // Don't navigate if it's the last item (current entity)
    if (index === items.length - 1) return;

    if (onNavigate) {
      onNavigate(item);
    } else {
      navigateToEntity(item.type, item.id, item.label);
    }
  };

  return (
    <nav
      className={cn(
        'flex items-center gap-1 text-sm text-muted-foreground',
        className
      )}
      aria-label="Breadcrumb"
    >
      {/* Back Button */}
      {showBackButton && canGoBack && (
        <button
          onClick={goBack}
          className="mr-2 p-1 hover:bg-accent rounded-md transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}

      {/* Home */}
      <a
        href="/dashboard"
        className="hover:text-foreground transition-colors"
        aria-label="Dashboard"
      >
        <Home className="h-4 w-4" />
      </a>

      {/* Breadcrumb Items */}
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const typeDisplay = getEntityTypeDisplayName(item.type);

        return (
          <React.Fragment key={`${item.type}-${item.id}`}>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {item.label}
              </span>
            ) : (
              <button
                onClick={() => handleItemClick(item, index)}
                className="hover:text-foreground transition-colors truncate max-w-[150px]"
                title={`${typeDisplay}: ${item.label}`}
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/**
 * Simple breadcrumb for dialogs (no context dependency)
 */
interface SimpleBreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem) => void;
  className?: string;
}

export function SimpleBreadcrumb({ items, onNavigate, className }: SimpleBreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav
      className={cn(
        'flex items-center gap-1 text-sm text-muted-foreground mb-4',
        className
      )}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={`${item.type}-${item.id}`}>
            {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {item.label}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(item)}
                className="hover:text-foreground transition-colors truncate max-w-[150px]"
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

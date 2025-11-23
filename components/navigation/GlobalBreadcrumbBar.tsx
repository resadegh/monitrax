'use client';

/**
 * GlobalBreadcrumbBar Component
 * Phase 9 Task 9.1 - Unified Navigation Layer
 *
 * Global breadcrumb system using CMNF.
 * - Appears on all dashboard pages
 * - Final segment always reflects current entity
 * - Truncated middle segments for long chains
 */

import React from 'react';
import { ChevronRight, Home, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import { getEntityTypeDisplayName } from '@/lib/navigation/routeMap';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/components/ui/breadcrumb';

interface GlobalBreadcrumbBarProps {
  className?: string;
  maxVisibleItems?: number;
}

export function GlobalBreadcrumbBar({
  className,
  maxVisibleItems = 4,
}: GlobalBreadcrumbBarProps) {
  const { breadcrumb, goBack, canGoBack, navigateToEntity } = useCrossModuleNavigation();

  // Don't render if no breadcrumb items
  if (breadcrumb.length === 0) {
    return null;
  }

  const handleItemClick = (item: BreadcrumbItem) => {
    navigateToEntity(item.type, item.id, item.label);
  };

  // Truncate middle items if chain is too long
  const shouldTruncate = breadcrumb.length > maxVisibleItems;
  let visibleItems: (BreadcrumbItem | 'ellipsis')[] = [];

  if (shouldTruncate) {
    // Show first item, ellipsis, and last (maxVisibleItems - 2) items
    const keepAtEnd = maxVisibleItems - 2;
    visibleItems = [
      breadcrumb[0],
      'ellipsis' as const,
      ...breadcrumb.slice(-keepAtEnd),
    ];
  } else {
    visibleItems = breadcrumb;
  }

  return (
    <nav
      className={cn(
        'flex items-center gap-1.5 px-4 py-2 bg-background/95 backdrop-blur-sm border-b text-sm',
        className
      )}
      aria-label="Breadcrumb navigation"
    >
      {/* Back Button */}
      {canGoBack && (
        <button
          onClick={goBack}
          className="mr-2 p-1.5 hover:bg-accent rounded-md transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs">Back</span>
        </button>
      )}

      {/* Home Link */}
      <a
        href="/dashboard"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dashboard"
      >
        <Home className="h-4 w-4" />
        <span className="hidden sm:inline">Dashboard</span>
      </a>

      {/* Breadcrumb Items */}
      {visibleItems.map((item, index) => {
        if (item === 'ellipsis') {
          return (
            <React.Fragment key="ellipsis">
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
              <span className="px-1 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            </React.Fragment>
          );
        }

        const isLast = index === visibleItems.length - 1;
        const typeDisplay = getEntityTypeDisplayName(item.type);

        return (
          <React.Fragment key={`${item.type}-${item.id}`}>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
            {isLast ? (
              <span
                className="font-medium text-foreground truncate max-w-[200px]"
                title={`${typeDisplay}: ${item.label}`}
              >
                {item.label}
              </span>
            ) : (
              <button
                onClick={() => handleItemClick(item)}
                className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[150px]"
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

export default GlobalBreadcrumbBar;

/**
 * GlobalBreadcrumbBar - Visual breadcrumb navigation
 * Phase 07/09 Navigation Component
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface GlobalBreadcrumbBarProps {
  items: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
}

export function GlobalBreadcrumbBar({
  items,
  className,
  showHome = true,
}: GlobalBreadcrumbBarProps) {
  const allItems = showHome
    ? [{ label: 'Dashboard', href: '/dashboard', icon: <Home className="w-4 h-4" /> }, ...items]
    : items;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center text-sm text-gray-500', className)}
    >
      <ol className="flex items-center space-x-1">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
              )}
              {isLast ? (
                <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                  {item.icon}
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ) : (
                <span className="flex items-center gap-1">
                  {item.icon}
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * useBreadcrumbs - Hook for managing breadcrumb state
 */
export function useBreadcrumbs() {
  const [breadcrumbs, setBreadcrumbs] = React.useState<BreadcrumbItem[]>([]);

  const push = React.useCallback((item: BreadcrumbItem) => {
    setBreadcrumbs((prev) => [...prev, item]);
  }, []);

  const pop = React.useCallback(() => {
    setBreadcrumbs((prev) => prev.slice(0, -1));
  }, []);

  const reset = React.useCallback((items: BreadcrumbItem[] = []) => {
    setBreadcrumbs(items);
  }, []);

  return { breadcrumbs, push, pop, reset };
}

export type { BreadcrumbItem };

/**
 * SectionContainer - Section wrapper with consistent spacing
 * Phase 06 UI Core Component
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface SectionContainerProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function SectionContainer({
  title,
  description,
  children,
  className,
  actions,
}: SectionContainerProps) {
  return (
    <section className={cn('mb-8', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            {title && (
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

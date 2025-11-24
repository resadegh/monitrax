/**
 * PageTitleBlock - Standardized page title with actions
 * Phase 06 UI Core Component
 */

import React from 'react';

interface PageTitleBlockProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}

export function PageTitleBlock({
  title,
  description,
  actions,
  breadcrumb,
}: PageTitleBlockProps) {
  return (
    <div className="mb-6">
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

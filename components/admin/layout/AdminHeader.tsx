'use client';

/**
 * Phase 33: Admin Header Component
 *
 * Top header bar for the admin portal.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { SearchInput } from '../ui/AdminForm';
import { AdminButton } from '../ui/AdminButton';

interface AdminHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  searchValue?: string;
  className?: string;
}

export function AdminHeader({
  title,
  description,
  action,
  searchPlaceholder,
  onSearch,
  searchValue,
  className,
}: AdminHeaderProps) {
  return (
    <header className={cn('mb-8', className)}>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-gray-900 dark:text-white tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {onSearch && (
            <div className="w-64">
              <SearchInput
                placeholder={searchPlaceholder || 'Search...'}
                value={searchValue}
                onChange={(e) => onSearch(e.target.value)}
                onClear={() => onSearch('')}
              />
            </div>
          )}
          {action}
        </div>
      </div>
    </header>
  );
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  backHref?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  breadcrumbs,
  backHref,
  action,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-6', className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <svg
                  className="w-4 h-4 mx-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className="text-gray-900 dark:text-white">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {backHref && (
            <a
              href={backHref}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </a>
          )}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-4', className)}>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

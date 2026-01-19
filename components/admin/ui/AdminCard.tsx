'use client';

/**
 * Phase 33: Admin Card Component
 *
 * Reusable card component for the admin portal.
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface AdminCardProps {
  children?: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function AdminCard({ children, className, padding = 'md' }: AdminCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

interface AdminCardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function AdminCardHeader({ title, description, action, className }: AdminCardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-4', className)}>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function StatsCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend,
  className,
}: StatsCardProps) {
  const trendColor = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400',
  };

  const trendIcon = {
    up: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    neutral: null,
  };

  return (
    <AdminCard className={cn('relative overflow-hidden', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {change !== undefined && (
            <div className={cn('flex items-center gap-1 mt-2 text-sm', trend && trendColor[trend])}>
              {trend && trendIcon[trend]}
              <span>
                {change > 0 ? '+' : ''}
                {change}%
              </span>
              {changeLabel && <span className="text-gray-500 dark:text-gray-400">{changeLabel}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
            {icon}
          </div>
        )}
      </div>
    </AdminCard>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center',
        className
      )}
    >
      {icon && (
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <AdminCard className={cn('animate-pulse', className)}>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4" />
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
    </AdminCard>
  );
}

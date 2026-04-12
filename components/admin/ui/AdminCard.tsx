'use client';

/**
 * Phase M: Admin Card Component — Modernized
 *
 * Cleaner, more modern card design:
 * - Softer borders and shadows
 * - Better spacing
 * - Subtle hover states
 * - Modern typography hierarchy
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface AdminCardProps {
  children?: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

export function AdminCard({ children, className, padding = 'md', hoverable }: AdminCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-[#0F1624] rounded-xl border border-gray-200/70 dark:border-white/[0.06] shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_0_rgba(0,0,0,0.3)]',
        hoverable && 'transition-all duration-200 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_16px_0_rgba(0,0,0,0.4)] hover:border-gray-300/70 dark:hover:border-white/10',
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
    <div className={cn('flex items-start justify-between mb-5', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
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
  accentColor?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'gray';
}

export function StatsCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend,
  className,
  accentColor = 'blue',
}: StatsCardProps) {
  const trendColor = {
    up: 'text-emerald-600 dark:text-emerald-400',
    down: 'text-rose-600 dark:text-rose-400',
    neutral: 'text-gray-500 dark:text-gray-400',
  };

  const accentBg = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    red: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    gray: 'bg-gray-50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400',
  };

  const trendIcon = {
    up: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    down: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
      </svg>
    ),
    neutral: null,
  };

  return (
    <AdminCard className={cn('relative', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {title}
          </p>
          <p className="text-[28px] leading-none font-semibold text-gray-900 dark:text-white mt-2 tabular-nums">
            {value}
          </p>
          {change !== undefined && (
            <div className={cn('flex items-center gap-1.5 mt-3 text-[12px] font-medium', trend && trendColor[trend])}>
              {trend && trendIcon[trend]}
              <span>
                {change > 0 ? '+' : ''}
                {change}%
              </span>
              {changeLabel && <span className="text-gray-400 dark:text-gray-500 font-normal">{changeLabel}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className={cn('p-2.5 rounded-lg shrink-0', accentBg[accentColor])}>
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
        'flex flex-col items-center justify-center px-6 py-16 text-center',
        className
      )}
    >
      {icon && (
        <div className="w-14 h-14 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4 text-gray-400 ring-1 ring-gray-200/50 dark:ring-white/[0.06]">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-1.5 tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-[13px] text-gray-500 dark:text-gray-400 max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <AdminCard className={cn('animate-pulse', className)}>
      <div className="h-3 bg-gray-200 dark:bg-white/10 rounded-full w-1/4 mb-4" />
      <div className="h-7 bg-gray-200 dark:bg-white/10 rounded w-1/2 mb-3" />
      <div className="h-3 bg-gray-200 dark:bg-white/10 rounded-full w-1/3" />
    </AdminCard>
  );
}

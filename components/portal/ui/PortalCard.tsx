/**
 * Phase 32: Portal Card Component
 *
 * MODULAR: A flexible card component for the portal.
 * Can be used for stats, content sections, or any boxed content.
 */

'use client';

import { ReactNode } from 'react';

interface PortalCardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export function PortalCard({
  children,
  className = '',
  padding = 'md',
  hover = false,
  onClick,
}: PortalCardProps) {
  const baseClasses = 'bg-white rounded-xl border border-slate-200';
  const hoverClasses = hover ? 'hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer' : '';
  const paddingClass = paddingClasses[padding];

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${paddingClass} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Card Header Component
 */
interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, description, action, icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description && (
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Stats Card Component
 */
interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  icon?: ReactNode;
  loading?: boolean;
}

export function StatsCard({ title, value, subtitle, trend, icon, loading }: StatsCardProps) {
  return (
    <PortalCard>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          {loading ? (
            <div className="h-8 w-20 bg-slate-200 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          )}
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${
              trend.positive ? 'text-emerald-600' : 'text-red-600'
            }`}>
              <span>{trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              <span className="text-slate-400">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
            {icon}
          </div>
        )}
      </div>
    </PortalCard>
  );
}

/**
 * Empty State Card
 */
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="w-12 h-12 bg-slate-100 rounded-full mx-auto flex items-center justify-center mb-4 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 max-w-md mx-auto mb-6">{description}</p>
      {action}
    </div>
  );
}

/**
 * Loading Card Skeleton
 */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <PortalCard>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-200 rounded" style={{ width: `${80 - i * 15}%` }} />
        ))}
      </div>
    </PortalCard>
  );
}

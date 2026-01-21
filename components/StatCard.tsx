'use client';

import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'teal';
  badge?: string;
}

// Modern minimalist variant styles
const variantStyles = {
  default: {
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-600 dark:text-slate-400',
    accent: 'from-slate-500/10 to-transparent',
  },
  blue: {
    iconBg: 'bg-blue-50 dark:bg-blue-950/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
    accent: 'from-blue-500/10 to-transparent',
  },
  green: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    accent: 'from-emerald-500/10 to-transparent',
  },
  purple: {
    iconBg: 'bg-violet-50 dark:bg-violet-950/50',
    iconColor: 'text-violet-600 dark:text-violet-400',
    accent: 'from-violet-500/10 to-transparent',
  },
  orange: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accent: 'from-amber-500/10 to-transparent',
  },
  pink: {
    iconBg: 'bg-pink-50 dark:bg-pink-950/50',
    iconColor: 'text-pink-600 dark:text-pink-400',
    accent: 'from-pink-500/10 to-transparent',
  },
  teal: {
    iconBg: 'bg-teal-50 dark:bg-teal-950/50',
    iconColor: 'text-teal-600 dark:text-teal-400',
    accent: 'from-teal-500/10 to-transparent',
  },
};

export function StatCard({ title, value, description, icon: Icon, trend, variant = 'default', badge }: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className="relative overflow-hidden bg-card hover:shadow-lg transition-all duration-300 border border-border/50 h-full">
      {/* Subtle gradient accent */}
      <div className={`absolute inset-0 bg-gradient-to-br ${styles.accent} pointer-events-none`} />

      <div className="relative p-5 flex flex-col h-full min-h-[140px]">
        {/* Header with icon and badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className={`p-2 rounded-xl ${styles.iconBg}`}>
                <Icon className={`h-4 w-4 ${styles.iconColor}`} />
              </div>
            )}
            {badge && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend.isPositive
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
            }`}>
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        {/* Title */}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          {title}
        </p>

        {/* Value */}
        <p className="text-2xl font-bold text-foreground tracking-tight">
          {value}
        </p>

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground mt-auto pt-2">
            {description}
          </p>
        )}
      </div>
    </Card>
  );
}

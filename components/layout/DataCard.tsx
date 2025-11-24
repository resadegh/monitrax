/**
 * DataCard - Card wrapper for grid views with stats
 * Phase 06 UI Core Component
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DataCardProps {
  title: string;
  icon?: React.ReactNode;
  value?: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  actions?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function DataCard({
  title,
  icon,
  value,
  subtitle,
  trend,
  actions,
  children,
  onClick,
  className,
}: DataCardProps) {
  return (
    <Card
      className={cn(
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {icon && <span className="mr-2">{icon}</span>}
          {title}
        </CardTitle>
        {actions}
      </CardHeader>
      <CardContent>
        {value !== undefined && (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {subtitle}
          </p>
        )}
        {trend && (
          <p
            className={cn(
              'text-xs mt-1',
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * MetricStatBlock - Used for financial metrics display
 */
interface MetricStatBlockProps {
  label: string;
  value: string | number;
  delta?: {
    value: number;
    label?: string;
  };
  format?: 'currency' | 'percent' | 'number';
  size?: 'sm' | 'md' | 'lg';
}

export function MetricStatBlock({
  label,
  value,
  delta,
  size = 'md',
}: MetricStatBlockProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cn('font-bold', sizeClasses[size])}>{value}</p>
      {delta && (
        <p
          className={cn(
            'text-xs',
            delta.value >= 0 ? 'text-green-600' : 'text-red-600'
          )}
        >
          {delta.value >= 0 ? '+' : ''}
          {delta.value}% {delta.label}
        </p>
      )}
    </div>
  );
}

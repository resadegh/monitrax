'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

type StatCardVariant = 'default' | 'positive' | 'negative' | 'neutral';

interface StatCardProps {
  label: string;
  value: number;
  icon?: LucideIcon;
  variant?: StatCardVariant;
  format?: 'currency' | 'percent' | 'number';
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

const variantStyles: Record<StatCardVariant, { bg: string; text: string; icon: string }> = {
  default: { bg: 'bg-gray-50', text: 'text-gray-900', icon: 'text-gray-400' },
  positive: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
  negative: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-500' },
  neutral: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
};

/**
 * Statistics card component for displaying formatted values.
 * Used in review steps and summary displays.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  format = 'currency',
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}: StatCardProps) {
  const styles = variantStyles[variant];

  const formatValue = (val: number): string => {
    switch (format) {
      case 'currency':
        return formatCurrency(val);
      case 'percent':
        return `${val.toFixed(decimals)}%`;
      case 'number':
        return val.toLocaleString(undefined, { maximumFractionDigits: decimals });
      default:
        return val.toString();
    }
  };

  return (
    <div className={`${styles.bg} rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600">{label}</span>
        {Icon && <Icon className={`w-5 h-5 ${styles.icon}`} />}
      </div>
      <div className={`text-xl font-semibold ${styles.text}`}>
        {prefix}{formatValue(value)}{suffix}
      </div>
    </div>
  );
}

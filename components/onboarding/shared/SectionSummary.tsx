'use client';

import React from 'react';
import { Check, AlertCircle, LucideIcon } from 'lucide-react';

interface SectionSummaryItem {
  label: string;
  value: string | number;
  subtext?: string;
}

interface SectionSummaryProps {
  title: string;
  icon?: LucideIcon;
  items: SectionSummaryItem[];
  hasData: boolean;
  emptyMessage?: string;
  className?: string;
}

/**
 * Section summary card for displaying grouped data.
 * Used in review steps to show collected data by category.
 */
export function SectionSummary({
  title,
  icon: Icon,
  items,
  hasData,
  emptyMessage = 'Not added',
  className = '',
}: SectionSummaryProps) {
  const bgClass = hasData
    ? 'border-green-200 bg-green-50'
    : 'border-gray-200 bg-gray-50';

  const iconBgClass = hasData
    ? 'bg-green-100'
    : 'bg-gray-200';

  const iconColorClass = hasData
    ? 'text-green-600'
    : 'text-gray-400';

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-lg border ${bgClass} ${className}`}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${iconBgClass}`}
      >
        {hasData ? (
          <Check className={`w-5 h-5 ${iconColorClass}`} />
        ) : Icon ? (
          <Icon className={`w-5 h-5 ${iconColorClass}`} />
        ) : (
          <AlertCircle className={`w-5 h-5 ${iconColorClass}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900">{title}</div>
        {hasData ? (
          <div className="mt-1 space-y-1">
            {items.map((item, index) => (
              <div key={index} className="text-sm">
                <span className="text-gray-600">{item.label}:</span>{' '}
                <span className="font-medium text-gray-900">
                  {typeof item.value === 'number'
                    ? item.value.toLocaleString()
                    : item.value}
                </span>
                {item.subtext && (
                  <span className="text-gray-500 ml-1">({item.subtext})</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

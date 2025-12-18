'use client';

/**
 * BUDGET VS ACTUAL COMPONENT
 * Phase 29 - Cashflow Intelligence Center
 *
 * Compares budgeted amounts against actual spending by category.
 * Shows over/under budget status with visual indicators.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Scale,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface BudgetCategory {
  name: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'UNDER' | 'ON_TRACK' | 'OVER';
}

interface Props {
  categories: BudgetCategory[];
  totalBudgeted: number;
  totalActual: number;
  totalVariance: number;
  overallStatus: 'UNDER' | 'ON_TRACK' | 'OVER';
  periodStart: Date;
  periodEnd: Date;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

function statusToColor(status: 'UNDER' | 'ON_TRACK' | 'OVER'): string {
  switch (status) {
    case 'UNDER': return 'text-green-600';
    case 'ON_TRACK': return 'text-blue-600';
    case 'OVER': return 'text-red-600';
  }
}

function statusToBg(status: 'UNDER' | 'ON_TRACK' | 'OVER'): string {
  switch (status) {
    case 'UNDER': return 'bg-green-50 border-green-200';
    case 'ON_TRACK': return 'bg-blue-50 border-blue-200';
    case 'OVER': return 'bg-red-50 border-red-200';
  }
}

function StatusIcon({ status }: { status: 'UNDER' | 'ON_TRACK' | 'OVER' }) {
  if (status === 'UNDER') {
    return <TrendingDown className="h-4 w-4 text-green-500" />;
  }
  if (status === 'OVER') {
    return <TrendingUp className="h-4 w-4 text-red-500" />;
  }
  return <CheckCircle className="h-4 w-4 text-blue-500" />;
}

// =============================================================================
// CATEGORY ROW COMPONENT
// =============================================================================

function CategoryRow({ category }: { category: BudgetCategory }) {
  const progress = category.budgeted > 0
    ? Math.min(100, (category.actual / category.budgeted) * 100)
    : 0;

  const progressColor =
    category.status === 'OVER' ? 'bg-red-500' :
    category.status === 'UNDER' ? 'bg-green-500' : 'bg-blue-500';

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{category.name}</span>
        <div className="flex items-center gap-2">
          <StatusIcon status={category.status} />
          <span className={`text-sm font-semibold ${statusToColor(category.status)}`}>
            {category.variance > 0 ? '+' : ''}{formatCurrency(category.variance)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
        {/* Budget line marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
          style={{ left: '100%' }}
        />
        <div
          className={`h-full ${progressColor} transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Actual: {formatCurrency(category.actual)}</span>
        <span>Budget: {formatCurrency(category.budgeted)}</span>
      </div>
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

function NoBudgetState() {
  return (
    <div className="py-12 text-center">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <Scale className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-gray-700 font-medium">No budget configured</p>
      <p className="text-gray-500 text-sm mt-1 mb-4">
        Set up a budget to track your spending
      </p>
      <Link
        href="/dashboard/budget-analysis"
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <Scale className="h-4 w-4" />
        Set Up Budget
      </Link>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function BudgetVsActual({
  categories,
  totalBudgeted,
  totalActual,
  totalVariance,
  overallStatus,
  periodStart,
  periodEnd,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // If no budget data, show empty state
  if (!categories || categories.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-900">Budget vs Actual</h3>
          </div>
        </div>
        <NoBudgetState />
      </div>
    );
  }

  const overCategories = categories.filter(c => c.status === 'OVER');
  const displayedCategories = isExpanded ? categories : categories.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-900">Budget vs Actual</h3>
          </div>
          <Link
            href="/dashboard/budget-analysis"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Edit Budget
          </Link>
        </div>
      </div>

      {/* Overall Status */}
      <div className={`px-6 py-4 border-b ${statusToBg(overallStatus)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              {new Date(periodStart).toLocaleDateString('en-AU', { month: 'short' })} -{' '}
              {new Date(periodEnd).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
            </p>
            <div className="flex items-center gap-2">
              <StatusIcon status={overallStatus} />
              <span className={`text-lg font-bold ${statusToColor(overallStatus)}`}>
                {overallStatus === 'OVER' ? 'Over' : overallStatus === 'UNDER' ? 'Under' : 'On Track'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${statusToColor(overallStatus)}`}>
              {totalVariance > 0 ? '+' : ''}{formatCurrency(totalVariance)}
            </p>
            <p className="text-xs text-gray-500">
              {formatCurrency(totalActual)} of {formatCurrency(totalBudgeted)}
            </p>
          </div>
        </div>
      </div>

      {/* Warning for over-budget categories */}
      {overCategories.length > 0 && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-800">
              <span className="font-semibold">{overCategories.length}</span>{' '}
              {overCategories.length === 1 ? 'category' : 'categories'} over budget
            </p>
          </div>
        </div>
      )}

      {/* Category List */}
      <div className="px-6 py-2">
        <div className="divide-y divide-gray-100">
          {displayedCategories.map((category) => (
            <CategoryRow key={category.name} category={category} />
          ))}
        </div>
      </div>

      {/* Expand/Collapse */}
      {categories.length > 5 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-6 py-3 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
        >
          <span>{isExpanded ? 'Show less' : `Show all ${categories.length} categories`}</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}

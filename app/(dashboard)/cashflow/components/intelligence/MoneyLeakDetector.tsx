'use client';

/**
 * MONEY LEAK DETECTOR COMPONENT
 * Phase 29 - Cashflow Intelligence Center
 *
 * Displays detected spending leaks with transaction drill-down links.
 * Highlights categories bleeding money and provides actionable recommendations.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Droplets,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ExternalLink,
  Filter,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface MoneyLeak {
  id: string;
  category: string;
  description: string;
  monthlyAmount: number;
  percentOfIncome: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  transactionIds: string[];
  recommendation: string;
}

interface TopCategory {
  category: string;
  amount: number;
  percentage: number;
}

interface Props {
  totalLeakage: number;
  leaks: MoneyLeak[];
  topCategories: TopCategory[];
  analyzedFrom: Date;
  analyzedTo: Date;
  transactionCount: number;
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
  }).format(amount);
}

function severityToColor(severity: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (severity) {
    case 'HIGH': return 'text-red-600 bg-red-50 border-red-200';
    case 'MEDIUM': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'LOW': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  }
}

function severityToBadge(severity: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (severity) {
    case 'HIGH': return 'bg-red-100 text-red-700';
    case 'MEDIUM': return 'bg-orange-100 text-orange-700';
    case 'LOW': return 'bg-yellow-100 text-yellow-700';
  }
}

function TrendIcon({ trend }: { trend: 'INCREASING' | 'STABLE' | 'DECREASING' }) {
  if (trend === 'INCREASING') {
    return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  }
  if (trend === 'DECREASING') {
    return <TrendingDown className="h-3.5 w-3.5 text-green-500" />;
  }
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}

// =============================================================================
// LEAK CARD COMPONENT
// =============================================================================

function LeakCard({ leak }: { leak: MoneyLeak }) {
  const transactionUrl = `/dashboard/transactions?category=${encodeURIComponent(leak.category)}`;

  return (
    <div className={`rounded-xl border p-4 ${severityToColor(leak.severity)}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${severityToBadge(leak.severity)}`}>
            {leak.severity}
          </span>
          <TrendIcon trend={leak.trend} />
        </div>
        <span className="text-lg font-bold">
          {formatCurrency(leak.monthlyAmount)}
          <span className="text-xs font-normal text-gray-500">/mo</span>
        </span>
      </div>

      <h4 className="font-semibold text-gray-900 mb-1">{leak.category}</h4>
      <p className="text-sm text-gray-600 mb-3">{leak.description}</p>

      {/* Recommendation */}
      <div className="bg-white/50 rounded-lg p-3 mb-3">
        <p className="text-xs text-gray-500 mb-1">Recommendation</p>
        <p className="text-sm text-gray-700">{leak.recommendation}</p>
      </div>

      {/* Transaction link */}
      <Link
        href={transactionUrl}
        className="flex items-center justify-between text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors group"
      >
        <span>View {leak.transactionIds.length} transactions</span>
        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}

// =============================================================================
// CATEGORY BAR COMPONENT
// =============================================================================

function CategoryBar({ category, amount, percentage }: TopCategory) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-700">{category}</span>
          <span className="font-medium text-gray-900">{formatCurrency(amount)}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MoneyLeakDetector({
  totalLeakage,
  leaks,
  topCategories,
  analyzedFrom,
  analyzedTo,
  transactionCount,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayedLeaks = showAll ? leaks : leaks.slice(0, 3);

  // Calculate annual savings potential
  const annualSavings = totalLeakage * 12;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <Droplets className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Money Leaks</h3>
              <p className="text-sm text-gray-500">
                {transactionCount} transactions analyzed
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totalLeakage)}
            </p>
            <p className="text-xs text-gray-500">per month</p>
          </div>
        </div>
      </div>

      {/* Annual savings callout */}
      {annualSavings > 1000 && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{formatCurrency(annualSavings)}</span> in potential annual savings identified
            </p>
          </div>
        </div>
      )}

      {/* Top Categories */}
      {topCategories.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Top Leak Categories</h4>
          <div className="space-y-3">
            {topCategories.slice(0, 3).map((cat) => (
              <CategoryBar key={cat.category} {...cat} />
            ))}
          </div>
        </div>
      )}

      {/* Leak Cards */}
      <div className="px-6 py-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Detected Issues ({leaks.length})
        </h4>

        {leaks.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Droplets className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-gray-700 font-medium">No major leaks detected</p>
            <p className="text-gray-500 text-sm mt-1">
              Your spending patterns look healthy
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedLeaks.map((leak) => (
              <LeakCard key={leak.id} leak={leak} />
            ))}
          </div>
        )}

        {/* Show more button */}
        {leaks.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            {showAll ? 'Show less' : `Show ${leaks.length - 3} more`}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          Analysis period: {new Date(analyzedFrom).toLocaleDateString('en-AU')} - {new Date(analyzedTo).toLocaleDateString('en-AU')}
        </p>
      </div>
    </div>
  );
}

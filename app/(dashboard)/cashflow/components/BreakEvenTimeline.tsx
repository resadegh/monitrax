'use client';

/**
 * BREAK-EVEN TIMELINE
 * Section 3 - Visual bar showing when income catches expenses
 *
 * Shows the day of month when cumulative income >= cumulative expenses
 * Features:
 * - Split red/green timeline bar
 * - Improvement tips
 * - Historical comparison
 */

import { useMemo } from 'react';
import { Target, TrendingUp, TrendingDown, Lightbulb, CheckCircle } from 'lucide-react';
import { colors, formatCurrency, componentClasses } from '../design-system';

// =============================================================================
// TYPES
// =============================================================================

interface BreakEvenTimelineProps {
  breakEvenDay: number; // 1-31, or -1 if never breaks even
  totalIncome30: number;
  totalExpenses30: number;
  improvementTips?: string[];
  loading?: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function BreakEvenTimeline({
  breakEvenDay,
  totalIncome30,
  totalExpenses30,
  improvementTips = [],
  loading = false,
}: BreakEvenTimelineProps) {
  const netCashflow = totalIncome30 - totalExpenses30;
  const neverBreaksEven = breakEvenDay === -1 || breakEvenDay > 31;
  const healthyBreakEven = breakEvenDay > 0 && breakEvenDay <= 15;

  // Calculate percentage for the visual bar
  const breakEvenPercentage = useMemo(() => {
    if (neverBreaksEven) return 100; // All red
    return Math.min((breakEvenDay / 30) * 100, 100);
  }, [breakEvenDay, neverBreaksEven]);

  // Generate default tips if none provided
  const tips = useMemo(() => {
    if (improvementTips.length > 0) return improvementTips;

    const defaultTips: string[] = [];

    if (neverBreaksEven) {
      defaultTips.push('Your expenses exceed your income this month');
      defaultTips.push('Review recurring subscriptions for potential cuts');
      defaultTips.push('Consider ways to increase income');
    } else if (breakEvenDay > 20) {
      defaultTips.push('Move payment dates closer to your income date');
      defaultTips.push('Ask providers about changing billing dates');
    } else if (breakEvenDay > 15) {
      defaultTips.push('Good timing! Small adjustments could optimize further');
    }

    return defaultTips;
  }, [breakEvenDay, neverBreaksEven, improvementTips]);

  if (loading) {
    return (
      <div className={componentClasses.card}>
        <div className="p-6">
          <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="h-8 bg-gray-100 rounded-full animate-pulse mb-4" />
          <div className="h-20 bg-gray-50 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={componentClasses.card}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className={componentClasses.sectionTitle}>Break-Even Timeline</h3>
            <p className={componentClasses.sectionSubtitle}>
              When monthly income catches expenses
            </p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            healthyBreakEven
              ? 'bg-green-50'
              : neverBreaksEven
              ? 'bg-red-50'
              : 'bg-amber-50'
          }`}>
            <Target className={`h-5 w-5 ${
              healthyBreakEven
                ? 'text-green-600'
                : neverBreaksEven
                ? 'text-red-600'
                : 'text-amber-600'
            }`} />
          </div>
        </div>

        {/* Visual Timeline Bar */}
        <div className="mb-6">
          <div className="relative h-10 bg-gray-100 rounded-full overflow-hidden">
            {/* Red portion (expenses) */}
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500"
              style={{ width: `${breakEvenPercentage}%` }}
            />

            {/* Green portion (income) */}
            {!neverBreaksEven && (
              <div
                className="absolute right-0 top-0 h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                style={{ width: `${100 - breakEvenPercentage}%` }}
              />
            )}

            {/* Break-even marker */}
            {!neverBreaksEven && (
              <div
                className="absolute top-0 h-full w-1 bg-white shadow-sm transition-all duration-500"
                style={{ left: `${breakEvenPercentage}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded shadow-sm">
                    Day {breakEvenDay}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Day labels */}
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>Day 1</span>
            <span>Day 15</span>
            <span>Day 30</span>
          </div>
        </div>

        {/* Status Message */}
        <div className={`rounded-lg p-4 mb-4 ${
          healthyBreakEven
            ? 'bg-green-50 border border-green-100'
            : neverBreaksEven
            ? 'bg-red-50 border border-red-100'
            : 'bg-amber-50 border border-amber-100'
        }`}>
          <div className="flex items-start gap-3">
            {healthyBreakEven ? (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : neverBreaksEven ? (
              <TrendingDown className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            ) : (
              <Target className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`font-medium ${
                healthyBreakEven
                  ? 'text-green-800'
                  : neverBreaksEven
                  ? 'text-red-800'
                  : 'text-amber-800'
              }`}>
                {healthyBreakEven
                  ? 'Great timing!'
                  : neverBreaksEven
                  ? 'Expenses exceed income'
                  : 'Room for improvement'}
              </p>
              <p className={`text-sm mt-0.5 ${
                healthyBreakEven
                  ? 'text-green-700'
                  : neverBreaksEven
                  ? 'text-red-700'
                  : 'text-amber-700'
              }`}>
                {healthyBreakEven
                  ? `You break even by day ${breakEvenDay}, leaving ${30 - breakEvenDay} days of surplus.`
                  : neverBreaksEven
                  ? `Your monthly expenses (${formatCurrency(totalExpenses30)}) exceed income (${formatCurrency(totalIncome30)}).`
                  : `You break even on day ${breakEvenDay}. Moving payments could improve cashflow.`}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-t border-b border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Income</p>
            <p className="text-sm font-semibold text-green-600 tabular-nums">
              +{formatCurrency(totalIncome30)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Expenses</p>
            <p className="text-sm font-semibold text-red-600 tabular-nums">
              -{formatCurrency(totalExpenses30)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Net</p>
            <p className={`text-sm font-semibold tabular-nums ${
              netCashflow >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {netCashflow >= 0 ? '+' : ''}{formatCurrency(netCashflow)}
            </p>
          </div>
        </div>

        {/* Improvement Tips */}
        {tips.length > 0 && !healthyBreakEven && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-gray-700">Tips to improve</span>
            </div>
            <ul className="space-y-1.5">
              {tips.slice(0, 3).map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-gray-300 mt-1">|</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

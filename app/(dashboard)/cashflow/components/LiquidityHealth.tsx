'use client';

/**
 * LIQUIDITY HEALTH
 * Section 5 - How fast can you access cash if emergency hits
 *
 * Shows tiered access levels with coverage metrics
 * Features:
 * - Today / 7 Days / 30 Days tiers
 * - Coverage as months of expenses
 * - Account breakdown per tier
 */

import { useMemo } from 'react';
import { Droplets, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { colors, formatCurrency, componentClasses } from '../design-system';

// =============================================================================
// TYPES
// =============================================================================

interface LiquidityTier {
  label: string;
  description: string;
  amount: number;
  accounts: { name: string; balance: number }[];
}

interface LiquidityHealthProps {
  tiers: {
    today: LiquidityTier;
    week: LiquidityTier;
    month: LiquidityTier;
  };
  monthlyExpenses: number;
  targetMonths?: number;
  loading?: boolean;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function TierCard({
  tier,
  monthlyExpenses,
  index,
}: {
  tier: LiquidityTier;
  monthlyExpenses: number;
  index: number;
}) {
  const coverageMonths = monthlyExpenses > 0 ? tier.amount / monthlyExpenses : 0;
  const coveragePercent = Math.min((coverageMonths / 6) * 100, 100); // 6 months = 100%

  const getStatusColor = () => {
    if (coverageMonths >= 3) return 'green';
    if (coverageMonths >= 1) return 'amber';
    return 'red';
  };

  const statusColor = getStatusColor();

  const colorClasses = {
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      progress: 'bg-green-500',
      icon: 'text-green-600',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      progress: 'bg-amber-500',
      icon: 'text-amber-600',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      progress: 'bg-red-500',
      icon: 'text-red-600',
    },
  };

  const classes = colorClasses[statusColor];

  return (
    <div
      className={`rounded-xl border p-4 ${classes.bg} ${classes.border} transition-all duration-200 hover:shadow-md`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{tier.label}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{tier.description}</p>
        </div>
        <div className={`w-8 h-8 rounded-lg ${classes.bg} flex items-center justify-center`}>
          {statusColor === 'green' ? (
            <CheckCircle className={`h-4 w-4 ${classes.icon}`} />
          ) : statusColor === 'amber' ? (
            <Clock className={`h-4 w-4 ${classes.icon}`} />
          ) : (
            <AlertCircle className={`h-4 w-4 ${classes.icon}`} />
          )}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900 tabular-nums">
            {formatCurrency(tier.amount)}
          </span>
        </div>
        <p className={`text-sm font-medium ${classes.text}`}>
          {coverageMonths.toFixed(1)} months coverage
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white rounded-full overflow-hidden mb-3">
        <div
          className={`h-full ${classes.progress} transition-all duration-500`}
          style={{ width: `${coveragePercent}%` }}
        />
      </div>

      {/* Account breakdown */}
      {tier.accounts.length > 0 && (
        <div className="space-y-1.5">
          {tier.accounts.slice(0, 3).map((account, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 truncate">{account.name}</span>
              <span className="text-gray-900 font-medium tabular-nums">
                {formatCurrency(account.balance)}
              </span>
            </div>
          ))}
          {tier.accounts.length > 3 && (
            <p className="text-xs text-gray-400">
              +{tier.accounts.length - 3} more accounts
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LOADING STATE
// =============================================================================

function LoadingSkeleton() {
  return (
    <div className={componentClasses.card}>
      <div className="p-6">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function LiquidityHealth({
  tiers,
  monthlyExpenses,
  targetMonths = 6,
  loading = false,
}: LiquidityHealthProps) {
  const totalLiquidity = useMemo(() => {
    return tiers.today.amount + tiers.week.amount + tiers.month.amount;
  }, [tiers]);

  const totalCoverage = useMemo(() => {
    return monthlyExpenses > 0 ? totalLiquidity / monthlyExpenses : 0;
  }, [totalLiquidity, monthlyExpenses]);

  const healthStatus = useMemo(() => {
    if (totalCoverage >= targetMonths) return 'excellent';
    if (totalCoverage >= 3) return 'good';
    if (totalCoverage >= 1) return 'fair';
    return 'poor';
  }, [totalCoverage, targetMonths]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className={componentClasses.card}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className={componentClasses.sectionTitle}>Liquidity Health</h3>
              <div className="group relative">
                <Info className="h-4 w-4 text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  How quickly you can access cash in an emergency
                </div>
              </div>
            </div>
            <p className={componentClasses.sectionSubtitle}>
              Emergency fund accessibility
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 tabular-nums">
              {totalCoverage.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500">months coverage</p>
          </div>
        </div>

        {/* Overall status bar */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Total accessible funds
            </span>
            <span className="text-lg font-bold text-gray-900 tabular-nums">
              {formatCurrency(totalLiquidity)}
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                healthStatus === 'excellent'
                  ? 'bg-green-500'
                  : healthStatus === 'good'
                  ? 'bg-emerald-500'
                  : healthStatus === 'fair'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min((totalCoverage / targetMonths) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>0 months</span>
            <span>{targetMonths} months (target)</span>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TierCard tier={tiers.today} monthlyExpenses={monthlyExpenses} index={0} />
          <TierCard tier={tiers.week} monthlyExpenses={monthlyExpenses} index={1} />
          <TierCard tier={tiers.month} monthlyExpenses={monthlyExpenses} index={2} />
        </div>

        {/* Recommendation */}
        {healthStatus === 'poor' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              Your emergency fund is below recommended levels. Aim for at least 3 months of expenses in accessible funds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * CASHFLOW PAGE - PREMIUM REDESIGN
 * Phase 14 - Cashflow Optimisation Engine UI
 *
 * A premium financial command center that shows users
 * WHEN and WHERE their money moves, not just how much.
 *
 * Design Philosophy: Bloomberg Terminal meets Apple design
 * - Sophisticated, minimal, actionable
 * - Every chart tells a story, every number drives a decision
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import {
  RefreshCw,
  Wallet,
  Loader2,
} from 'lucide-react';

// Components
import {
  CashPositionChart,
  UpcomingMovements,
  BreakEvenTimeline,
  SmartAllocation,
  LiquidityHealth,
  StabilityScore,
  SmartActions,
} from './components';

// Design system
import { formatCurrency, componentClasses } from './design-system';

// =============================================================================
// TYPES
// =============================================================================

interface ForecastPoint {
  date: string;
  predictedBalance: number;
  predictedIncome: number;
  predictedExpenses: number;
  confidenceScore: number;
  shortfallRisk: boolean;
  upperBound?: number;
  lowerBound?: number;
}

interface ForecastSummary {
  avgDailyBalance30: number;
  totalIncome30: number;
  totalExpenses30: number;
  netCashflow30: number;
  avgDailyBalance90: number;
  totalIncome90: number;
  totalExpenses90: number;
  netCashflow90: number;
  monthlyBurnRate: number;
  threeMonthBurnRate: number;
  withdrawableCash: number;
}

interface RecurringEntry {
  date: string;
  merchantStandardised: string;
  expectedAmount: number;
  accountId: string;
}

interface FundMovement {
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  reason: string;
  projectedBenefit: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface CashflowData {
  forecast: {
    globalForecast: ForecastPoint[];
    summary: ForecastSummary;
    shortfallAnalysis: {
      hasShortfall: boolean;
      shortfallDates: string[];
      maxShortfallAmount: number;
      totalShortfallDays: number;
      firstShortfallDate?: string;
      accountsAtRisk: string[];
    };
    volatilityIndex: number;
    recurringTimeline: RecurringEntry[];
    accountForecasts?: {
      accountId: string;
      accountName: string;
      averageBalance: number;
    }[];
  };
  optimisations: {
    fundMovements: FundMovement[];
    breakEvenDay: number;
    summary: {
      totalPotentialSavings: number;
    };
    strategies?: { id: string; title: string; summary: string; projectedBenefit: number }[];
  };
}

// =============================================================================
// DATA TRANSFORMATION
// =============================================================================

function transformToMovements(recurring: RecurringEntry[]): {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  isRecurring: boolean;
}[] {
  return recurring.map((r, i) => ({
    id: `recurring-${i}`,
    date: r.date,
    description: r.merchantStandardised,
    amount: r.expectedAmount,
    type: 'outflow' as const,
    isRecurring: true,
  }));
}

function transformToAllocationRecommendations(movements: FundMovement[]): {
  id: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  reason: string;
  projectedBenefit: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  type: 'offset' | 'shortfall' | 'optimization';
}[] {
  return movements.map((m, i) => ({
    id: `alloc-${i}`,
    ...m,
    type: m.reason.toLowerCase().includes('offset')
      ? 'offset'
      : m.reason.toLowerCase().includes('shortfall')
      ? 'shortfall'
      : 'optimization',
  }));
}

function calculateLiquidityTiers(
  accountForecasts?: { accountId: string; accountName: string; averageBalance: number }[],
  withdrawableCash = 0
) {
  // Default tiers if no account data
  if (!accountForecasts || accountForecasts.length === 0) {
    return {
      today: {
        label: 'Today',
        description: 'Immediately accessible',
        amount: withdrawableCash,
        accounts: [],
      },
      week: {
        label: '7 Days',
        description: 'Short-term access',
        amount: 0,
        accounts: [],
      },
      month: {
        label: '30 Days',
        description: 'Medium-term access',
        amount: 0,
        accounts: [],
      },
    };
  }

  // Split accounts into tiers (simplified - in production would check account types)
  const allAccounts = accountForecasts.map((a) => ({
    name: a.accountName,
    balance: a.averageBalance,
  }));

  const todayAccounts = allAccounts.filter(
    (a) =>
      a.name.toLowerCase().includes('transaction') ||
      a.name.toLowerCase().includes('everyday') ||
      a.name.toLowerCase().includes('checking')
  );

  const weekAccounts = allAccounts.filter(
    (a) =>
      a.name.toLowerCase().includes('savings') ||
      a.name.toLowerCase().includes('offset')
  );

  const monthAccounts = allAccounts.filter(
    (a) =>
      a.name.toLowerCase().includes('term') ||
      a.name.toLowerCase().includes('investment')
  );

  // If no categorization worked, put all in today
  if (todayAccounts.length === 0 && weekAccounts.length === 0 && monthAccounts.length === 0) {
    todayAccounts.push(...allAccounts);
  }

  return {
    today: {
      label: 'Today',
      description: 'Immediately accessible',
      amount: todayAccounts.reduce((sum, a) => sum + a.balance, 0),
      accounts: todayAccounts,
    },
    week: {
      label: '7 Days',
      description: 'Short-term access',
      amount: weekAccounts.reduce((sum, a) => sum + a.balance, 0),
      accounts: weekAccounts,
    },
    month: {
      label: '30 Days',
      description: 'Medium-term access',
      amount: monthAccounts.reduce((sum, a) => sum + a.balance, 0),
      accounts: monthAccounts,
    },
  };
}

function generateSmartActions(
  data: CashflowData
): {
  id: string;
  title: string;
  description: string;
  impact: number;
  timeEstimate: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'transfer' | 'cancel' | 'schedule' | 'review' | 'save';
}[] {
  const actions: ReturnType<typeof generateSmartActions> = [];

  // Add fund movement actions
  data.optimisations.fundMovements.slice(0, 2).forEach((m, i) => {
    actions.push({
      id: `action-fund-${i}`,
      title: `Transfer to ${m.toAccountName}`,
      description: m.reason,
      impact: m.projectedBenefit,
      timeEstimate: '5 min',
      priority: m.urgency === 'HIGH' ? 'critical' : m.urgency === 'MEDIUM' ? 'high' : 'medium',
      category: 'transfer',
    });
  });

  // Add shortfall prevention action if needed
  if (data.forecast.shortfallAnalysis.hasShortfall) {
    actions.unshift({
      id: 'action-shortfall',
      title: 'Prevent upcoming shortfall',
      description: `Move funds to avoid ${formatCurrency(data.forecast.shortfallAnalysis.maxShortfallAmount)} shortfall`,
      impact: data.forecast.shortfallAnalysis.maxShortfallAmount * 0.1,
      timeEstimate: '10 min',
      priority: 'critical',
      category: 'transfer',
    });
  }

  // Add break-even optimization if late
  if (data.optimisations.breakEvenDay > 20) {
    actions.push({
      id: 'action-breakeven',
      title: 'Optimize payment dates',
      description: 'Move bill dates closer to income date to improve cashflow timing',
      impact: 100,
      timeEstimate: '15 min',
      priority: 'medium',
      category: 'schedule',
    });
  }

  // Add strategy-based actions
  data.optimisations.strategies?.slice(0, 2).forEach((s, i) => {
    actions.push({
      id: `action-strategy-${i}`,
      title: s.title,
      description: s.summary,
      impact: s.projectedBenefit,
      timeEstimate: '10 min',
      priority: s.projectedBenefit > 500 ? 'high' : 'medium',
      category: 'review',
    });
  });

  return actions.slice(0, 5);
}

function calculateStabilityScore(volatilityIndex: number): number {
  // Convert volatility (0-100 where higher = more volatile) to stability (0-100 where higher = more stable)
  return Math.max(0, Math.min(100, 100 - volatilityIndex));
}

function generateRiskFactors(data: CashflowData) {
  const factors: { name: string; impact: 'high' | 'medium' | 'low'; description: string }[] = [];

  if (data.forecast.volatilityIndex > 50) {
    factors.push({
      name: 'High spending variability',
      impact: 'high',
      description: 'Your expenses vary significantly month to month',
    });
  }

  if (data.forecast.shortfallAnalysis.hasShortfall) {
    factors.push({
      name: 'Shortfall risk',
      impact: 'high',
      description: 'Predicted cash shortfall in the forecast period',
    });
  }

  if (data.optimisations.breakEvenDay > 25 || data.optimisations.breakEvenDay === -1) {
    factors.push({
      name: 'Late break-even',
      impact: 'medium',
      description: 'Income catches expenses late in the month',
    });
  }

  if (data.forecast.summary.netCashflow30 < 0) {
    factors.push({
      name: 'Negative cashflow',
      impact: 'high',
      description: 'Spending exceeds income this month',
    });
  }

  return factors;
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function PageSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header skeleton */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mt-2" />
        </div>
        <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      {/* Chart skeleton */}
      <div className="h-96 bg-gray-100 rounded-xl animate-pulse mb-8" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-80 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

// =============================================================================
// ERROR STATE
// =============================================================================

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wallet className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Unable to load cashflow data
        </h3>
        <p className="text-gray-500 mb-6">{error}</p>
        <button onClick={onRetry} className={componentClasses.buttonPrimary}>
          Try Again
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CashflowPage() {
  const { token } = useAuth();
  const [data, setData] = useState<CashflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLiteMode, setIsLiteMode] = useState(false);

  // Fetch full data with timeout fallback
  const fetchCashflowData = useCallback(async (useLite = false, isBackgroundFetch = false) => {
    if (!token) return;

    try {
      // Don't clear error on background fetch - keep existing data visible
      if (!isBackgroundFetch) {
        setError(null);
      }

      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), useLite ? 10000 : 25000);

      const url = useLite ? '/api/cashflow?type=lite' : '/api/cashflow?type=full&days=90';
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const json = await response.json();

      if (response.ok && json.success) {
        setData(json.data);
        setIsLiteMode(useLite || json.data.metadata?.mode === 'lite');
        setError(null); // Clear any previous errors

        // If we loaded lite mode, try to load full data in background (silently)
        if (useLite && !refreshing) {
          setTimeout(() => fetchCashflowData(false, true), 2000);
        }
      } else {
        // If full mode failed, try lite mode (but not if this is a background fetch)
        if (!useLite && !isBackgroundFetch) {
          console.log('Full cashflow load failed, trying lite mode...');
          fetchCashflowData(true);
          return;
        }
        // Only show error if we don't have any data yet
        if (!data && !isBackgroundFetch) {
          setError(json.error || json.details || 'Failed to load cashflow data');
        }
      }
    } catch (err) {
      // If full mode timed out, try lite mode (but not if background fetch)
      if (!useLite && !isBackgroundFetch && err instanceof Error && err.name === 'AbortError') {
        console.log('Cashflow request timed out, trying lite mode...');
        fetchCashflowData(true);
        return;
      }
      // Silently fail background fetches - we already have lite data
      if (isBackgroundFetch) {
        console.log('Background full data fetch failed, keeping lite mode data');
        return;
      }
      // Only show error if we don't have data
      if (!data) {
        setError(err instanceof Error ? err.message : 'Network error');
      }
    } finally {
      if (!isBackgroundFetch) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [token, refreshing, data]);

  useEffect(() => {
    if (token) {
      fetchCashflowData(false);
    }
  }, [token, fetchCashflowData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setIsLiteMode(false);
    await fetchCashflowData(false);
  };

  // Transform data for components
  const movements = useMemo(
    () => (data ? transformToMovements(data.forecast.recurringTimeline) : []),
    [data]
  );

  const allocationRecommendations = useMemo(
    () => (data ? transformToAllocationRecommendations(data.optimisations.fundMovements) : []),
    [data]
  );

  const liquidityTiers = useMemo(
    () =>
      data
        ? calculateLiquidityTiers(
            data.forecast.accountForecasts,
            data.forecast.summary.withdrawableCash
          )
        : calculateLiquidityTiers(),
    [data]
  );

  const smartActions = useMemo(
    () => (data ? generateSmartActions(data) : []),
    [data]
  );

  const stabilityScore = useMemo(
    () => (data ? calculateStabilityScore(data.forecast.volatilityIndex) : 0),
    [data]
  );

  const riskFactors = useMemo(
    () => (data ? generateRiskFactors(data) : []),
    [data]
  );

  // Render loading state
  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  // Render error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <ErrorState error={error} onRetry={fetchCashflowData} />
        </div>
      </DashboardLayout>
    );
  }

  // Render empty state
  if (!data) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <ErrorState
            error="No cashflow data available. Add accounts and transactions to see your forecast."
            onRetry={fetchCashflowData}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Cash Position
            </h1>
            <p className="text-gray-500 mt-1">
              Your 90-day financial forecast and optimization
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`${componentClasses.buttonSecondary} min-w-[120px]`}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
        </div>

        {/* Section 1: Cash Position Forecast (Hero) */}
        <div className="mb-8">
          <CashPositionChart
            forecast={data.forecast.globalForecast}
            emergencyBuffer={data.forecast.summary.monthlyBurnRate * 3}
          />
        </div>

        {/* Sections 2 & 3: Upcoming Movements + Break-Even */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <UpcomingMovements movements={movements} />
          <BreakEvenTimeline
            breakEvenDay={data.optimisations.breakEvenDay}
            totalIncome30={data.forecast.summary.totalIncome30}
            totalExpenses30={data.forecast.summary.totalExpenses30}
          />
        </div>

        {/* Section 4: Smart Cash Allocation */}
        {allocationRecommendations.length > 0 && (
          <div className="mb-8">
            <SmartAllocation
              recommendations={allocationRecommendations}
              // onTransfer would connect to actual transfer API
            />
          </div>
        )}

        {/* Sections 5 & 6: Liquidity Health + Stability Score */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <LiquidityHealth
            tiers={liquidityTiers}
            monthlyExpenses={data.forecast.summary.monthlyBurnRate}
          />
          <StabilityScore
            score={stabilityScore}
            riskFactors={riskFactors}
          />
        </div>

        {/* Section 7: Smart Actions */}
        {smartActions.length > 0 && (
          <div className="mb-8">
            <SmartActions
              actions={smartActions}
              // onComplete and onDismiss would update state/API
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

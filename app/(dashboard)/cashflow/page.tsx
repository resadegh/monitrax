/**
 * CASHFLOW DASHBOARD
 * Phase 14 - Cashflow Optimisation Engine UI
 *
 * Displays:
 * - 90-day forecast curve
 * - Shortfall predictions
 * - Monthly cashflow histogram
 * - Surplus/deficit gauges
 * - Category impact panel
 * - Strategy recommendations
 */

'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  RefreshCw,
  DollarSign,
  Calendar,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  Shield,
  Clock,
  CreditCard,
  Wallet,
} from 'lucide-react';

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

interface ShortfallAnalysis {
  hasShortfall: boolean;
  shortfallDates: string[];
  maxShortfallAmount: number;
  totalShortfallDays: number;
  firstShortfallDate?: string;
  accountsAtRisk: string[];
}

interface RecurringEntry {
  date: string;
  merchantStandardised: string;
  expectedAmount: number;
  accountId: string;
}

interface Strategy {
  id: string;
  type: string;
  priority: number;
  title: string;
  summary: string;
  detail?: string;
  confidence: number;
  projectedBenefit: number;
  recommendedSteps: { order: number; action: string; description: string }[];
  status: string;
}

interface Inefficiency {
  id: string;
  category: string;
  merchantOrCategory: string;
  description: string;
  currentSpend: number;
  potentialSavings: number;
  confidenceScore: number;
}

interface CashflowInsight {
  id: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  recommendedAction: string;
  valueEstimate?: number;
  savingsPotential?: number;
}

interface OptimisationSummary {
  totalPotentialSavings: number;
  inefficiencyCount: number;
  subscriptionCount: number;
  priceIncreaseCount: number;
  strategyCount: number;
  highPriorityActions: number;
}

interface CashflowData {
  forecast: {
    globalForecast: ForecastPoint[];
    summary: ForecastSummary;
    shortfallAnalysis: ShortfallAnalysis;
    volatilityIndex: number;
    recurringTimeline: RecurringEntry[];
  };
  optimisations: {
    inefficiencies: Inefficiency[];
    strategies: Strategy[];
    breakEvenDay: number;
    summary: OptimisationSummary;
  };
  insights: CashflowInsight[];
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
  });
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return 'text-red-600 bg-red-100';
    case 'HIGH':
      return 'text-orange-600 bg-orange-100';
    case 'MEDIUM':
      return 'text-yellow-600 bg-yellow-100';
    default:
      return 'text-blue-600 bg-blue-100';
  }
}

function getStrategyTypeIcon(type: string) {
  switch (type) {
    case 'PREVENT_SHORTFALL':
      return <Shield className="h-5 w-5 text-red-500" />;
    case 'MAXIMISE_OFFSET':
      return <DollarSign className="h-5 w-5 text-green-500" />;
    case 'REDUCE_WASTE':
      return <Zap className="h-5 w-5 text-yellow-500" />;
    case 'REPAYMENT_OPTIMISE':
      return <Target className="h-5 w-5 text-blue-500" />;
    default:
      return <Target className="h-5 w-5 text-gray-500" />;
  }
}

// =============================================================================
// COMPONENTS
// =============================================================================

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'red' | 'yellow';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        {trend && (
          <div
            className={`flex items-center text-sm ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
            }`}
          >
            {trend === 'up' && <TrendingUp className="h-4 w-4" />}
            {trend === 'down' && <TrendingDown className="h-4 w-4" />}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function ForecastChart({ forecast }: { forecast: ForecastPoint[] }) {
  // Simple text-based chart (in production, use a charting library)
  const maxBalance = Math.max(...forecast.map((f) => f.predictedBalance));
  const minBalance = Math.min(...forecast.map((f) => f.predictedBalance));
  const range = maxBalance - minBalance || 1;

  // Sample 30 points for display
  const sampled = forecast.filter((_, i) => i % 3 === 0).slice(0, 30);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold mb-4">90-Day Forecast</h3>
      <div className="h-40 flex items-end gap-1">
        {sampled.map((point, i) => {
          const height = ((point.predictedBalance - minBalance) / range) * 100;
          return (
            <div
              key={i}
              className="flex-1 group relative"
              title={`${formatDate(point.date)}: ${formatCurrency(point.predictedBalance)}`}
            >
              <div
                className={`w-full rounded-t ${
                  point.shortfallRisk ? 'bg-red-400' : 'bg-blue-400'
                }`}
                style={{ height: `${Math.max(5, height)}%` }}
              />
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                {formatDate(point.date)}: {formatCurrency(point.predictedBalance)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>{formatDate(forecast[0]?.date || '')}</span>
        <span>{formatDate(forecast[forecast.length - 1]?.date || '')}</span>
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-400 rounded" />
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-400 rounded" />
          <span>Shortfall Risk</span>
        </div>
      </div>
    </div>
  );
}

function ShortfallAlert({ analysis }: { analysis: ShortfallAnalysis }) {
  if (!analysis.hasShortfall) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-red-800">Shortfall Predicted</h4>
          <p className="text-sm text-red-700 mt-1">
            You may experience a cash shortfall of up to{' '}
            {formatCurrency(analysis.maxShortfallAmount)} in{' '}
            {analysis.totalShortfallDays} days.
          </p>
          {analysis.firstShortfallDate && (
            <p className="text-sm text-red-600 mt-2">
              First shortfall expected: {formatDate(analysis.firstShortfallDate)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function UpcomingPayments({ recurring }: { recurring: RecurringEntry[] }) {
  const upcoming = recurring.slice(0, 10);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-gray-500" />
        Upcoming Payments
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {upcoming.map((payment, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <div>
              <p className="font-medium text-sm">{payment.merchantStandardised}</p>
              <p className="text-xs text-gray-500">{formatDate(payment.date)}</p>
            </div>
            <p className="font-medium text-red-600">
              -{formatCurrency(payment.expectedAmount)}
            </p>
          </div>
        ))}
        {upcoming.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">
            No upcoming payments detected
          </p>
        )}
      </div>
    </div>
  );
}

function StrategyCard({
  strategy,
  onAccept,
  onDismiss,
}: {
  strategy: Strategy;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-start gap-3">
        {getStrategyTypeIcon(strategy.type)}
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h4 className="font-medium">{strategy.title}</h4>
            <span className="text-sm font-semibold text-green-600">
              +{formatCurrency(strategy.projectedBenefit)}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{strategy.summary}</p>

          {expanded && strategy.recommendedSteps.length > 0 && (
            <div className="mt-3 bg-gray-50 rounded p-3">
              <p className="text-xs font-medium text-gray-700 mb-2">Steps:</p>
              <ol className="text-xs text-gray-600 space-y-1">
                {strategy.recommendedSteps.map((step) => (
                  <li key={step.order}>
                    {step.order}. {step.description}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onAccept}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
            >
              Accept
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Dismiss
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-auto text-gray-500 text-xs flex items-center gap-1"
            >
              {expanded ? 'Less' : 'More'}
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: CashflowInsight }) {
  return (
    <div className="border rounded-lg p-3 bg-white">
      <div className="flex items-start gap-2">
        <span className={`px-2 py-0.5 text-xs rounded-full ${getSeverityColor(insight.severity)}`}>
          {insight.severity}
        </span>
        <div className="flex-1">
          <h4 className="font-medium text-sm">{insight.title}</h4>
          <p className="text-xs text-gray-600 mt-1">{insight.description}</p>
          {insight.savingsPotential && (
            <p className="text-xs text-green-600 mt-1">
              Potential: {formatCurrency(insight.savingsPotential)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CashflowDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<CashflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchCashflowData();
    }
  }, [token]);

  async function fetchCashflowData() {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/cashflow?type=full&days=90', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();

      if (response.ok && json.success) {
        setData(json.data);
      } else {
        setError(json.error || json.details || 'Failed to load cashflow data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchCashflowData();
    setRefreshing(false);
  }

  async function handleStrategyAction(strategyId: string, action: 'accept' | 'dismiss') {
    if (!token) return;

    try {
      await fetch('/api/cashflow/strategies', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ strategyId, action }),
      });
      // Refresh data
      await fetchCashflowData();
    } catch (err) {
      console.error('Failed to update strategy:', err);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-48 bg-gray-200 rounded mb-6"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              {error ? 'Error Loading Cashflow Data' : 'No Cashflow Data Available'}
            </h3>
            <p className="text-gray-500 mt-2">
              {error || 'Add transactions and accounts to see your cashflow forecast.'}
            </p>
            {error && (
              <button
                onClick={fetchCashflowData}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const { forecast, optimisations, insights } = data;
  const summary = forecast.summary;

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Cashflow Forecast</h1>
            <p className="text-gray-500 text-sm">90-day prediction & optimisation</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Shortfall Alert */}
        {forecast.shortfallAnalysis.hasShortfall && (
          <div className="mb-6">
            <ShortfallAlert analysis={forecast.shortfallAnalysis} />
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="30-Day Net Cashflow"
            value={formatCurrency(summary.netCashflow30)}
            icon={<DollarSign className="h-5 w-5" />}
            trend={summary.netCashflow30 >= 0 ? 'up' : 'down'}
            color={summary.netCashflow30 >= 0 ? 'green' : 'red'}
          />
          <MetricCard
            title="Monthly Burn Rate"
            value={formatCurrency(summary.monthlyBurnRate)}
            subtitle="Average monthly expenses"
            icon={<CreditCard className="h-5 w-5" />}
            color="yellow"
          />
          <MetricCard
            title="Withdrawable Cash"
            value={formatCurrency(summary.withdrawableCash)}
            subtitle="After 3-month buffer"
            icon={<Wallet className="h-5 w-5" />}
            color="blue"
          />
          <MetricCard
            title="Potential Savings"
            value={formatCurrency(optimisations.summary.totalPotentialSavings)}
            subtitle={`${optimisations.summary.strategyCount} strategies`}
            icon={<Zap className="h-5 w-5" />}
            color="green"
          />
        </div>

        {/* Forecast Chart + Upcoming Payments */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2">
            <ForecastChart forecast={forecast.globalForecast} />
          </div>
          <div>
            <UpcomingPayments recurring={forecast.recurringTimeline} />
          </div>
        </div>

        {/* Strategies + Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strategies */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Recommended Strategies
              {optimisations.strategies.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({optimisations.strategies.length})
                </span>
              )}
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {optimisations.strategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onAccept={() => handleStrategyAction(strategy.id, 'accept')}
                  onDismiss={() => handleStrategyAction(strategy.id, 'dismiss')}
                />
              ))}
              {optimisations.strategies.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-2" />
                  <p>No strategies needed - you&apos;re doing great!</p>
                </div>
              )}
            </div>
          </div>

          {/* Insights */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Info className="h-5 w-5 text-yellow-500" />
              Cashflow Insights
              {insights.length > 0 && (
                <span className="text-sm font-normal text-gray-500">({insights.length})</span>
              )}
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
              {insights.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-2" />
                  <p>No issues detected</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Break-even Info */}
        {optimisations.breakEvenDay > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <Clock className="h-5 w-5" />
              <span className="font-medium">
                Break-even Day: {optimisations.breakEvenDay} of each month
              </span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              This is when your monthly income catches up with expenses.
            </p>
          </div>
        )}

        {/* Volatility Index */}
        {forecast.volatilityIndex > 30 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">
                Volatility Index: {forecast.volatilityIndex.toFixed(0)}/100
              </span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Your spending patterns show some variability. Consider tracking expenses more closely.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

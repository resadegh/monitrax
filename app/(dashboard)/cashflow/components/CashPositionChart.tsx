'use client';

/**
 * CASH POSITION FORECAST CHART
 * Section 1 - Hero Component
 *
 * Beautiful line chart showing projected bank balance over 90 days
 * Features:
 * - Smooth animated curve with gradient fill
 * - Emergency buffer threshold line
 * - Large movement markers
 * - Interactive tooltips
 * - Confidence bands
 */

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { colors, formatCurrency, formatDate, componentClasses } from '../design-system';

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

interface CashPositionChartProps {
  forecast: ForecastPoint[];
  emergencyBuffer?: number;
  loading?: boolean;
}

// =============================================================================
// CUSTOM TOOLTIP
// =============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ForecastPoint }>;
  label?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload as ForecastPoint;
  const balance = data.predictedBalance;
  const isShortfall = data.shortfallRisk;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 min-w-[200px]">
      <p className="text-sm font-medium text-gray-500 mb-2">
        {formatDate(data.date, 'long')}
      </p>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Balance</span>
          <span
            className={`text-lg font-bold ${
              isShortfall ? 'text-red-600' : 'text-gray-900'
            }`}
          >
            {formatCurrency(balance)}
          </span>
        </div>
        {data.predictedIncome > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Income</span>
            <span className="text-green-600 font-medium">
              +{formatCurrency(data.predictedIncome)}
            </span>
          </div>
        )}
        {data.predictedExpenses > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Expenses</span>
            <span className="text-red-600 font-medium">
              -{formatCurrency(data.predictedExpenses)}
            </span>
          </div>
        )}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Confidence</span>
            <span className="text-gray-500">
              {Math.round(data.confidenceScore * 100)}%
            </span>
          </div>
        </div>
        {isShortfall && (
          <div className="flex items-center gap-1.5 pt-2 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Shortfall risk detected</span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function ChartSkeleton() {
  return (
    <div className={componentClasses.card}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-80 bg-gradient-to-b from-gray-100 to-gray-50 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

function EmptyState() {
  return (
    <div className={componentClasses.card}>
      <div className="p-6">
        <h3 className={componentClasses.sectionTitle}>Cash Position Forecast</h3>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No forecast data available</p>
            <p className="text-gray-400 text-sm mt-1">
              Add accounts and transactions to see your 90-day prediction
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CashPositionChart({
  forecast,
  emergencyBuffer = 5000,
  loading = false,
}: CashPositionChartProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!forecast || forecast.length === 0) return [];

    return forecast.map((point) => ({
      ...point,
      date: point.date,
      displayDate: formatDate(point.date, 'short'),
      balance: point.predictedBalance,
      upper: point.upperBound,
      lower: point.lowerBound,
    }));
  }, [forecast]);

  // Calculate stats
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        currentBalance: 0,
        endBalance: 0,
        minBalance: 0,
        maxBalance: 0,
        trend: 'neutral' as const,
        hasShortfall: false,
        shortfallDays: 0,
      };
    }

    const balances = chartData.map((d) => d.balance);
    const currentBalance = balances[0] || 0;
    const endBalance = balances[balances.length - 1] || 0;
    const minBalance = Math.min(...balances);
    const maxBalance = Math.max(...balances);
    const trend = endBalance > currentBalance ? 'up' : endBalance < currentBalance ? 'down' : 'neutral';
    const shortfallDays = chartData.filter((d) => d.shortfallRisk).length;

    return {
      currentBalance,
      endBalance,
      minBalance,
      maxBalance,
      trend,
      hasShortfall: shortfallDays > 0,
      shortfallDays,
    };
  }, [chartData]);

  // Y-axis domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 10000];

    const allValues = chartData.flatMap((d) => [
      d.balance,
      d.upper || d.balance,
      d.lower || d.balance,
    ]);
    const min = Math.min(...allValues, emergencyBuffer * 0.5);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1;

    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData, emergencyBuffer]);

  if (loading) return <ChartSkeleton />;
  if (!forecast || forecast.length === 0) return <EmptyState />;

  return (
    <div className={componentClasses.card}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className={componentClasses.sectionTitle}>Cash Position Forecast</h3>
            <p className={componentClasses.sectionSubtitle}>
              Projected balance over the next 90 days
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              {stats.trend === 'up' && (
                <TrendingUp className="h-5 w-5 text-green-500" />
              )}
              {stats.trend === 'down' && (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
              <span className={componentClasses.metricValue}>
                {formatCurrency(stats.endBalance)}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Projected end balance
            </p>
          </div>
        </div>

        {/* Shortfall Warning */}
        {stats.hasShortfall && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Shortfall risk detected
              </p>
              <p className="text-xs text-red-600">
                {stats.shortfallDays} day{stats.shortfallDays !== 1 ? 's' : ''} with potential negative balance
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                {/* Primary gradient */}
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.purple} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={colors.purple} stopOpacity={0.05} />
                </linearGradient>

                {/* Confidence band gradient */}
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.purple} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={colors.purple} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke={colors.gray100}
                vertical={false}
              />

              <XAxis
                dataKey="displayDate"
                axisLine={false}
                tickLine={false}
                tick={{ fill: colors.gray400, fontSize: 12 }}
                interval="preserveStartEnd"
                tickMargin={8}
              />

              <YAxis
                domain={yDomain}
                axisLine={false}
                tickLine={false}
                tick={{ fill: colors.gray400, fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value, { compact: true })}
                width={60}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Emergency buffer threshold */}
              <ReferenceLine
                y={emergencyBuffer}
                stroke={colors.warning}
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: 'Emergency Buffer',
                  position: 'insideTopRight',
                  fill: colors.warning,
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />

              {/* Zero line */}
              <ReferenceLine
                y={0}
                stroke={colors.danger}
                strokeWidth={1}
              />

              {/* Confidence upper bound */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="url(#colorConfidence)"
                fillOpacity={1}
              />

              {/* Main balance line */}
              <Area
                type="monotone"
                dataKey="balance"
                stroke={colors.purple}
                strokeWidth={2.5}
                fill="url(#colorBalance)"
                fillOpacity={1}
                dot={false}
                activeDot={{
                  r: 6,
                  strokeWidth: 2,
                  fill: colors.white,
                  stroke: colors.purple,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <span className="text-xs text-gray-500">Predicted Balance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-amber-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #f59e0b 0px, #f59e0b 4px, transparent 4px, transparent 8px)' }} />
            <span className="text-xs text-gray-500">Emergency Buffer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-gray-500">Shortfall Risk</span>
          </div>
        </div>

        {/* Stats footer */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Current</p>
            <p className="text-sm font-semibold text-gray-900 tabular-nums">
              {formatCurrency(stats.currentBalance)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Min Projected</p>
            <p className={`text-sm font-semibold tabular-nums ${
              stats.minBalance < 0 ? 'text-red-600' : 'text-gray-900'
            }`}>
              {formatCurrency(stats.minBalance)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Max Projected</p>
            <p className="text-sm font-semibold text-gray-900 tabular-nums">
              {formatCurrency(stats.maxBalance)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

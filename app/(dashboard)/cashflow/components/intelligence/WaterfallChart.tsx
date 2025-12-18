'use client';

/**
 * WATERFALL CHART COMPONENT
 * Phase 29 - Cashflow Intelligence Center
 *
 * Visualizes money flow from income through expenses to net result.
 * Shows where money goes at a glance.
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { ArrowRight, DollarSign } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface WaterfallItem {
  name: string;
  value: number;
  type: 'income' | 'expense' | 'net';
  isSubtotal?: boolean;
  category?: string;
}

interface Props {
  items: WaterfallItem[];
  netIncome: number;
  totalExpenses: number;
  surplus: number;
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

function getBarColor(type: 'income' | 'expense' | 'net', value: number): string {
  if (type === 'income') return '#22c55e'; // green-500
  if (type === 'expense') return '#ef4444'; // red-500
  return value >= 0 ? '#22c55e' : '#ef4444'; // net based on value
}

// =============================================================================
// CUSTOM TOOLTIP
// =============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: WaterfallItem & { displayValue: number; runningTotal: number } }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
      <p className="font-semibold text-gray-900 mb-1">{data.name}</p>
      <p className={`text-lg font-bold ${data.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {data.value >= 0 ? '+' : ''}{formatCurrency(data.value)}
      </p>
      {data.type === 'net' && (
        <p className="text-xs text-gray-500 mt-1">
          {data.value >= 0 ? 'Monthly surplus' : 'Monthly deficit'}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// SUMMARY STATS
// =============================================================================

function SummaryStats({ netIncome, totalExpenses, surplus }: Omit<Props, 'items'>) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-6 text-xs sm:text-sm py-3 border-t border-gray-100 mt-4 flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="text-gray-600">Income:</span>
        <span className="font-semibold text-gray-900">{formatCurrency(netIncome)}</span>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-gray-300 hidden sm:block" />
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <span className="text-gray-600">Outflow:</span>
        <span className="font-semibold text-gray-900">{formatCurrency(totalExpenses)}</span>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-gray-300 hidden sm:block" />
      <div className="flex items-center gap-1.5">
        <div className={`w-3 h-3 rounded-full ${surplus >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-gray-600">{surplus >= 0 ? 'Surplus' : 'Deficit'}:</span>
        <span className={`font-semibold ${surplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(surplus)}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function WaterfallChart({
  items,
  netIncome,
  totalExpenses,
  surplus,
}: Props) {
  // Transform data for the waterfall chart
  const chartData = useMemo(() => {
    let runningTotal = 0;

    return items.map((item) => {
      const start = runningTotal;
      runningTotal += item.value;

      return {
        ...item,
        start,
        end: runningTotal,
        displayValue: Math.abs(item.value),
        runningTotal,
      };
    });
  }, [items]);

  // Calculate chart bounds
  const maxValue = Math.max(...chartData.map(d => Math.max(d.start, d.end)));
  const minValue = Math.min(...chartData.map(d => Math.min(d.start, d.end)));
  const yDomain = [Math.min(0, minValue * 1.1), maxValue * 1.1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-900">Money Flow</h3>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Where your money goes each month
        </p>
      </div>

      {/* Chart */}
      <div className="px-4 py-6">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              domain={yDomain as [number, number]}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#e5e7eb" />

            {/* Invisible bar for positioning */}
            <Bar
              dataKey="start"
              stackId="stack"
              fill="transparent"
            />

            {/* Visible bar for values */}
            <Bar
              dataKey="displayValue"
              stackId="stack"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry.type, entry.value)}
                  opacity={entry.isSubtotal ? 1 : 0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary */}
      <div className="px-6 pb-4">
        <SummaryStats
          netIncome={netIncome}
          totalExpenses={totalExpenses}
          surplus={surplus}
        />
      </div>
    </div>
  );
}

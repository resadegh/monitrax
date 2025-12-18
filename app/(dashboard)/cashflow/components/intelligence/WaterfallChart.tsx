'use client';

/**
 * WATERFALL CHART COMPONENT
 * Phase 31 - Cashflow Intelligence Center
 *
 * Visualizes money flow from income through expenses to net result.
 * Shows green (remaining) being "eaten away" by red (expenses).
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

// =============================================================================
// CUSTOM TOOLTIP
// =============================================================================

interface TooltipData {
  name: string;
  value: number;
  type: 'income' | 'expense' | 'net';
  runningTotal: number;
  remaining: number;
  expense: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TooltipData }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
      <p className="font-semibold text-gray-900 mb-2">{data.name}</p>
      {data.type === 'income' ? (
        <p className="text-lg font-bold text-green-600">
          +{formatCurrency(data.value)}
        </p>
      ) : data.type === 'expense' ? (
        <>
          <p className="text-sm text-red-600 font-medium">
            -{formatCurrency(Math.abs(data.value))}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Remaining: {formatCurrency(data.runningTotal)}
          </p>
        </>
      ) : (
        <p className={`text-lg font-bold ${data.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {data.value >= 0 ? 'Surplus: ' : 'Deficit: '}{formatCurrency(data.value)}
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
  // Transform data for stacked bar visualization
  // Shows: remaining green (positive) + red expense at each step
  const chartData = useMemo(() => {
    let runningTotal = 0;

    return items.map((item) => {
      const prevTotal = runningTotal;
      runningTotal += item.value;

      if (item.type === 'income') {
        // Income: just show green bar
        return {
          ...item,
          remaining: item.value, // Green portion (the income)
          expense: 0, // No red
          negative: 0, // No negative portion
          runningTotal,
        };
      } else if (item.type === 'expense') {
        // Expense: show remaining green + red expense
        // If running total is still positive, show green remaining + red expense
        // If running total goes negative, show the negative portion in red below zero
        const expenseAmount = Math.abs(item.value);

        if (runningTotal >= 0) {
          // Still positive - show remaining green + red on top
          return {
            ...item,
            remaining: runningTotal, // Green portion (what's left)
            expense: expenseAmount, // Red portion on top
            negative: 0,
            runningTotal,
          };
        } else if (prevTotal > 0) {
          // Crossed into negative - split the expense
          return {
            ...item,
            remaining: 0, // No green left
            expense: prevTotal, // Red portion above zero
            negative: Math.abs(runningTotal), // Red portion below zero
            runningTotal,
          };
        } else {
          // Already negative - all red below zero
          return {
            ...item,
            remaining: 0,
            expense: 0,
            negative: Math.abs(runningTotal),
            runningTotal,
          };
        }
      } else {
        // Net/subtotal: show final result
        if (runningTotal >= 0) {
          return {
            ...item,
            remaining: runningTotal,
            expense: 0,
            negative: 0,
            runningTotal,
          };
        } else {
          return {
            ...item,
            remaining: 0,
            expense: 0,
            negative: Math.abs(runningTotal),
            runningTotal,
          };
        }
      }
    });
  }, [items]);

  // Calculate chart bounds
  const maxValue = Math.max(netIncome * 1.1, ...chartData.map(d => d.remaining + d.expense));
  const minValue = Math.min(0, ...chartData.map(d => -d.negative)) * 1.1;

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
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis
              domain={[minValue, maxValue]}
              tickFormatter={(value) => {
                if (Math.abs(value) >= 1000) {
                  return `$${(value / 1000).toFixed(0)}k`;
                }
                return `$${value}`;
              }}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1} />

            {/* Green bar: remaining positive balance */}
            <Bar
              dataKey="remaining"
              stackId="stack"
              fill="#22c55e"
              radius={[0, 0, 0, 0]}
            />

            {/* Red bar: expense amount (stacked on top of green) */}
            <Bar
              dataKey="expense"
              stackId="stack"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
            />

            {/* Red bar below zero for negative values */}
            <Bar
              dataKey="negative"
              fill="#ef4444"
              radius={[0, 0, 4, 4]}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`negative-${index}`}
                  fill="#ef4444"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend explanation */}
      <div className="px-6 pb-2">
        <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Remaining balance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Expense/Outflow</span>
          </div>
        </div>
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

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  History,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

// ============================================================================
// PHASE 3: NET WORTH TREND MINI CHART
// ============================================================================

export interface NetWorthDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface NetWorthTrendData {
  current: number;
  previous: number;
  change: number;
  percentChange: number;
  trend: 'up' | 'down' | 'stable';
  history: NetWorthDataPoint[];
  periodLabel: string;
}

interface NetWorthTrendProps {
  data: NetWorthTrendData;
  showChart?: boolean;
}

// Simple SVG sparkline component
function Sparkline({
  data,
  width = 120,
  height = 40,
  color = '#22c55e',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) {
    return null;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // Create area fill path
  const areaPoints = [
    `0,${height}`,
    ...points,
    `${width},${height}`,
  ];
  const areaD = `M ${areaPoints.join(' L ')} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Area fill */}
      <path
        d={areaD}
        fill={color}
        fillOpacity={0.1}
      />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r={3}
        fill={color}
      />
    </svg>
  );
}

export function NetWorthTrend({ data, showChart = true }: NetWorthTrendProps) {
  const getTrendConfig = () => {
    if (data.trend === 'up') {
      return {
        icon: TrendingUp,
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-950/50',
        chartColor: '#22c55e',
        label: 'Growing',
      };
    }
    if (data.trend === 'down') {
      return {
        icon: TrendingDown,
        color: 'text-red-600',
        bgColor: 'bg-red-100 dark:bg-red-950/50',
        chartColor: '#ef4444',
        label: 'Declining',
      };
    }
    return {
      icon: Minus,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
      chartColor: '#6b7280',
      label: 'Stable',
    };
  };

  const config = getTrendConfig();
  const Icon = config.icon;

  // Extract values for sparkline
  const chartData = data.history.map(h => h.value);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-600" />
            Net Worth Trend
          </div>
          <Badge className={`${config.bgColor} ${config.color}`}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {/* Current Value & Change */}
          <div className="space-y-1">
            <p className="text-2xl font-bold">{formatCurrency(data.current)}</p>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${config.color}`}>
                {data.change >= 0 ? '+' : ''}{formatCurrency(data.change)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({data.percentChange >= 0 ? '+' : ''}{data.percentChange.toFixed(1)}%)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{data.periodLabel}</p>
          </div>

          {/* Mini Chart */}
          {showChart && chartData.length >= 2 && (
            <div className="flex-shrink-0">
              <Sparkline
                data={chartData}
                width={100}
                height={40}
                color={config.chartColor}
              />
            </div>
          )}
        </div>

        {/* Historical Values */}
        {data.history.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <div className="flex justify-between text-xs text-muted-foreground">
              {data.history.slice(-4).map((point, idx) => (
                <div key={idx} className="text-center">
                  <p className="font-medium">{formatCurrency(point.value, { abbreviate: true })}</p>
                  <p>{point.label || point.date}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to generate mock trend data (in production, this would come from historical snapshots)
export function generateNetWorthTrendData(
  currentNetWorth: number,
  monthlyChange: number = 0
): NetWorthTrendData {
  // Generate simulated historical data (6 months)
  const history: NetWorthDataPoint[] = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();

  for (let i = 5; i >= 0; i--) {
    const monthIndex = (currentMonth - i + 12) % 12;
    // Simulate gradual growth/decline
    const variance = (Math.random() - 0.5) * 0.02; // ±1% random variance
    const baseGrowth = monthlyChange > 0 ? 0.01 : monthlyChange < 0 ? -0.01 : 0;
    const monthlyGrowthRate = baseGrowth + variance;
    const historicalValue = currentNetWorth / Math.pow(1 + monthlyGrowthRate, i + 1);

    history.push({
      date: months[monthIndex],
      value: Math.round(historicalValue),
      label: months[monthIndex],
    });
  }

  // Add current value
  history.push({
    date: months[currentMonth],
    value: currentNetWorth,
    label: 'Now',
  });

  const previous = history.length > 1 ? history[history.length - 2].value : currentNetWorth;
  const change = currentNetWorth - previous;
  const percentChange = previous > 0 ? (change / previous) * 100 : 0;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (percentChange > 1) trend = 'up';
  else if (percentChange < -1) trend = 'down';

  return {
    current: currentNetWorth,
    previous,
    change,
    percentChange,
    trend,
    history,
    periodLabel: 'vs last month',
  };
}

// ============================================================================
// COMPACT NET WORTH TREND (for StatCard enhancement)
// ============================================================================

interface CompactTrendProps {
  change: number;
  percentChange: number;
  periodLabel?: string;
}

export function CompactNetWorthTrend({ change, percentChange, periodLabel = 'vs last month' }: CompactTrendProps) {
  const isPositive = change >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? 'text-green-600' : 'text-red-600';

  return (
    <div className="flex items-center gap-1 text-xs">
      <Icon className={`h-3 w-3 ${colorClass}`} />
      <span className={colorClass}>
        {isPositive ? '+' : ''}{formatCurrency(change)}
      </span>
      <span className="text-muted-foreground">
        ({isPositive ? '+' : ''}{percentChange.toFixed(1)}% {periodLabel})
      </span>
    </div>
  );
}

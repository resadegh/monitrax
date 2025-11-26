/**
 * FORECAST CHART COMPONENT
 * Phase 11 - Stage 7: UI Components
 *
 * Interactive chart displaying multi-year financial forecasts
 * Shows Conservative, Default, and Aggressive scenarios
 */

'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// =============================================================================
// TYPES
// =============================================================================

interface YearlyProjection {
  year: number;
  age: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  annualIncome: number;
  annualExpenses: number;
  annualSavings: number;
  investmentReturns: number;
}

interface ForecastResult {
  userId: string;
  generatedAt: Date;
  scenario: 'CONSERVATIVE' | 'DEFAULT' | 'AGGRESSIVE';
  projections: YearlyProjection[];
  summary: {
    currentAge: number;
    retirementAge: number;
    yearsToRetirement: number;
    netWorthAtRetirement: number;
    projectedRetirementIncome: number;
    replacementRatio: number;
    canRetireComfortably: boolean;
  };
}

interface ForecastChartProps {
  timeHorizon?: 5 | 10 | 20 | 30;
  metric?: 'netWorth' | 'totalAssets' | 'annualIncome' | 'annualSavings';
  showScenarios?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ForecastChart({
  timeHorizon = 30,
  metric = 'netWorth',
  showScenarios = true,
}: ForecastChartProps) {
  const [forecasts, setForecasts] = useState<{
    conservative: ForecastResult | null;
    default: ForecastResult | null;
    aggressive: ForecastResult | null;
  }>({
    conservative: null,
    default: null,
    aggressive: null,
  });
  const [loading, setLoading] = useState(true);
  const [selectedScenarios, setSelectedScenarios] = useState({
    conservative: true,
    default: true,
    aggressive: true,
  });

  useEffect(() => {
    fetchForecasts();
  }, []);

  async function fetchForecasts() {
    try {
      setLoading(true);

      // Fetch all three scenarios in parallel
      const [conservativeRes, defaultRes, aggressiveRes] = await Promise.all([
        fetch('/api/strategy/forecast?scenario=CONSERVATIVE'),
        fetch('/api/strategy/forecast?scenario=DEFAULT'),
        fetch('/api/strategy/forecast?scenario=AGGRESSIVE'),
      ]);

      const [conservative, defaultForecast, aggressive] = await Promise.all([
        conservativeRes.ok ? conservativeRes.json() : null,
        defaultRes.ok ? defaultRes.json() : null,
        aggressiveRes.ok ? aggressiveRes.json() : null,
      ]);

      setForecasts({
        conservative: conservative?.data || null,
        default: defaultForecast?.data || null,
        aggressive: aggressive?.data || null,
      });
    } catch (error) {
      console.error('Failed to fetch forecasts:', error);
    } finally {
      setLoading(false);
    }
  }

  // Prepare chart data
  const chartData = (() => {
    if (!forecasts.default) return [];

    const data: any[] = [];
    const maxYear = Math.min(timeHorizon, forecasts.default.projections.length - 1);

    for (let i = 0; i <= maxYear; i++) {
      const dataPoint: any = {
        year: i,
        age: forecasts.default.projections[i]?.age || 0,
      };

      if (selectedScenarios.conservative && forecasts.conservative) {
        dataPoint.conservative = forecasts.conservative.projections[i]?.[metric] || 0;
      }
      if (selectedScenarios.default && forecasts.default) {
        dataPoint.default = forecasts.default.projections[i]?.[metric] || 0;
      }
      if (selectedScenarios.aggressive && forecasts.aggressive) {
        dataPoint.aggressive = forecasts.aggressive.projections[i]?.[metric] || 0;
      }

      data.push(dataPoint);
    }

    return data;
  })();

  // Format currency for tooltip
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;

    const year = label;
    const age = payload[0]?.payload?.age || 0;

    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">
          Year {year} (Age {age})
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            <span className="font-medium capitalize">{entry.name}: </span>
            {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  // Get metric label
  const getMetricLabel = () => {
    switch (metric) {
      case 'netWorth':
        return 'Net Worth';
      case 'totalAssets':
        return 'Total Assets';
      case 'annualIncome':
        return 'Annual Income';
      case 'annualSavings':
        return 'Annual Savings';
      default:
        return 'Value';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow">
        <p className="text-gray-500">Loading forecast data...</p>
      </div>
    );
  }

  if (!forecasts.default) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white rounded-lg shadow">
        <p className="text-gray-500 mb-4">No forecast data available.</p>
        <button
          onClick={fetchForecasts}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Generate Forecast
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {timeHorizon}-Year {getMetricLabel()} Forecast
        </h2>

        {/* Scenario Toggle */}
        {showScenarios && (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedScenarios.conservative}
                onChange={(e) =>
                  setSelectedScenarios((prev) => ({
                    ...prev,
                    conservative: e.target.checked,
                  }))
                }
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Conservative</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedScenarios.default}
                onChange={(e) =>
                  setSelectedScenarios((prev) => ({
                    ...prev,
                    default: e.target.checked,
                  }))
                }
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Default</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedScenarios.aggressive}
                onChange={(e) =>
                  setSelectedScenarios((prev) => ({
                    ...prev,
                    aggressive: e.target.checked,
                  }))
                }
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Aggressive</span>
            </label>
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="year"
            label={{ value: 'Years from Now', position: 'insideBottom', offset: -5 }}
            stroke="#6b7280"
          />
          <YAxis
            tickFormatter={(value: number) => formatCurrency(value)}
            label={{ value: getMetricLabel(), angle: -90, position: 'insideLeft' }}
            stroke="#6b7280"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {selectedScenarios.conservative && (
            <Line
              type="monotone"
              dataKey="conservative"
              name="Conservative"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          )}
          {selectedScenarios.default && (
            <Line
              type="monotone"
              dataKey="default"
              name="Default"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6 }}
            />
          )}
          {selectedScenarios.aggressive && (
            <Line
              type="monotone"
              dataKey="aggressive"
              name="Aggressive"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-1">Retirement Age</p>
          <p className="text-2xl font-bold text-gray-900">
            {forecasts.default.summary.retirementAge}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-1">Net Worth at Retirement</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(forecasts.default.summary.netWorthAtRetirement)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-1">Retirement Readiness</p>
          <p
            className={`text-2xl font-bold ${
              forecasts.default.summary.canRetireComfortably
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {forecasts.default.summary.canRetireComfortably ? '✓ On Track' : '✗ Below Target'}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * FINANCIAL HEALTH MINI WIDGET
 * Phase 12 - Financial Health Engine
 *
 * Small sidebar widget displaying the financial health score
 * with link to full health dashboard.
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

interface FinancialHealthData {
  score: number;
  riskBand: string;
  trend: {
    direction: 'IMPROVING' | 'STABLE' | 'DECLINING';
    changePercent: number;
  };
}

function getRiskBandColor(band: string): string {
  switch (band) {
    case 'EXCELLENT':
      return 'bg-green-500';
    case 'GOOD':
      return 'bg-green-400';
    case 'MODERATE':
      return 'bg-yellow-400';
    case 'CONCERNING':
      return 'bg-orange-500';
    case 'CRITICAL':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}

function getRiskBandBgColor(band: string): string {
  switch (band) {
    case 'EXCELLENT':
    case 'GOOD':
      return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50';
    case 'MODERATE':
      return 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800/50';
    case 'CONCERNING':
      return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50';
    case 'CRITICAL':
      return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50';
    default:
      return 'bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800/50';
  }
}

function getRiskBandTextColor(band: string): string {
  switch (band) {
    case 'EXCELLENT':
    case 'GOOD':
      return 'text-green-600 dark:text-green-400';
    case 'MODERATE':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'CONCERNING':
      return 'text-orange-600 dark:text-orange-400';
    case 'CRITICAL':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

export function FinancialHealthMiniWidget() {
  const { token } = useAuth();
  const [health, setHealth] = useState<FinancialHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchHealth = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(false);
      const response = await fetch('/api/financial-health', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data?.healthScore) {
          setHealth({
            score: json.data.healthScore.score,
            riskBand: json.data.healthScore.riskBand,
            trend: json.data.healthScore.trend,
          });
        } else {
          setHealth(null);
        }
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchHealth();
    // Refresh every 60 seconds
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Loading state
  if (loading && !health) {
    return (
      <div className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-center py-2">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error or no data state
  if (error || !health) {
    return (
      <Link href="/health">
        <div className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Financial Health</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {error ? 'Unable to load' : 'Add data to see score'}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link href="/health">
      <div className={`p-3 rounded-lg border ${getRiskBandBgColor(health.riskBand)} hover:opacity-90 transition-opacity cursor-pointer`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={`h-4 w-4 ${getRiskBandTextColor(health.riskBand)}`} />
            <span className={`text-sm font-medium ${getRiskBandTextColor(health.riskBand)}`}>
              Financial Health
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${getRiskBandTextColor(health.riskBand)}`}>
              {health.score}
            </span>
            <ChevronRight className={`h-4 w-4 ${getRiskBandTextColor(health.riskBand)}`} />
          </div>
        </div>

        <div className="mt-2">
          {/* Score bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${getRiskBandColor(health.riskBand)}`}
              style={{ width: `${health.score}%` }}
            />
          </div>

          {/* Status and trend */}
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs font-medium ${getRiskBandTextColor(health.riskBand)}`}>
              {health.riskBand}
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {health.trend.direction === 'IMPROVING' && (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">
                    +{health.trend.changePercent.toFixed(1)}%
                  </span>
                </>
              )}
              {health.trend.direction === 'DECLINING' && (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-600 dark:text-red-400">
                    {health.trend.changePercent.toFixed(1)}%
                  </span>
                </>
              )}
              {health.trend.direction === 'STABLE' && (
                <>
                  <Minus className="h-3 w-3 text-gray-500" />
                  <span>Stable</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default FinancialHealthMiniWidget;

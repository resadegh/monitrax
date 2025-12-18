'use client';

/**
 * CASHFLOW INTELLIGENCE CENTER
 * Phase 29 - The Heart and Soul of Monitrax
 *
 * A premium financial command center that provides:
 * - Unified health score across all financial dimensions
 * - Money leak detection with transaction drill-down
 * - AI-powered insights (Gemini)
 * - Budget vs actual tracking
 * - Tax optimization tips
 * - Smart actionable recommendations
 *
 * Key Principles:
 * - Uses ONLY real calculated numbers (zero hallucination)
 * - All sources from existing engines (CFE, COE, Health, Tax, Budget)
 * - Transaction-level drill-down for accountability
 */

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  LineChart,
} from 'lucide-react';

// Intelligence Center Components
import {
  CashflowHealthScore,
  WaterfallChart,
  MoneyLeakDetector,
  BudgetVsActual,
  TaxOptimization,
  GeminiSummary,
  SmartActionsEnhanced,
} from './components/intelligence';

// Existing Components (retained for forecast chart)
import { CashPositionChart, BreakEvenTimeline } from './components';

// Design system
import { componentClasses } from './design-system';

// =============================================================================
// TYPES
// =============================================================================

interface IntelligenceData {
  healthScore: {
    overallScore: number;
    tier: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'CONCERNING' | 'CRITICAL';
    breakdown: {
      category: string;
      score: number;
      weight: number;
      description: string;
      trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    }[];
    confidence: number;
    lastCalculated: string;
  };
  forecast: {
    current: {
      balance: number;
      income: number;
      expenses: number;
      net: number;
    };
    forecast30Day: {
      predictedBalance: number;
      confidence: number;
      risk: 'LOW' | 'MEDIUM' | 'HIGH';
    };
    forecast90Day: {
      predictedBalance: number;
      confidence: number;
      risk: 'LOW' | 'MEDIUM' | 'HIGH';
    };
    breakEvenDay: number;
    shortfallRisk: boolean;
  };
  leaks: {
    totalLeakage: number;
    leaks: {
      id: string;
      category: string;
      description: string;
      monthlyAmount: number;
      percentOfIncome: number;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      trend: 'INCREASING' | 'STABLE' | 'DECREASING';
      transactionIds: string[];
      recommendation: string;
    }[];
    topCategories: {
      category: string;
      amount: number;
      percentage: number;
    }[];
    analyzedFrom: string;
    analyzedTo: string;
    transactionCount: number;
  };
  waterfall: {
    items: {
      name: string;
      value: number;
      type: 'income' | 'expense' | 'net';
      isSubtotal?: boolean;
      category?: string;
    }[];
    netIncome: number;
    totalExpenses: number;
    surplus: number;
  };
  budgetComparison?: {
    categories: {
      name: string;
      budgeted: number;
      actual: number;
      variance: number;
      variancePercent: number;
      status: 'UNDER' | 'ON_TRACK' | 'OVER';
    }[];
    totalBudgeted: number;
    totalActual: number;
    totalVariance: number;
    overallStatus: 'UNDER' | 'ON_TRACK' | 'OVER';
    period: { start: string; end: string };
  };
  taxOptimization?: {
    estimatedAnnualTax: number;
    deductibleExpenses: number;
    potentialSavings: number;
    recommendations: {
      id: string;
      title: string;
      description: string;
      potentialSaving: number;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      actionUrl?: string;
    }[];
    effectiveTaxRate: number;
    paygWithheld: number;
  };
  smartActions: {
    id: string;
    rank: number;
    title: string;
    description: string;
    impact: number;
    impactDescription: string;
    category: 'SAVE' | 'TRANSFER' | 'CANCEL' | 'OPTIMIZE' | 'REVIEW';
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    source: 'COE' | 'HEALTH' | 'TAX' | 'BUDGET' | 'FORECAST';
    actionUrl?: string;
    learnMoreUrl?: string;
  }[];
  dataQuality: {
    transactionCoverage: number;
    incomeCoverage: number;
    expenseCoverage: number;
    confidence: number;
  };
}

interface SummaryData {
  content: string;
  keyInsights: string[];
  generatedAt: string;
  isStale: boolean;
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function PageSkeleton() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mt-2" />
        </div>
        <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="h-80 bg-gray-100 rounded-xl animate-pulse" />
        <div className="lg:col-span-2 h-80 bg-gray-100 rounded-xl animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Unable to load intelligence data
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
  const [intelligence, setIntelligence] = useState<IntelligenceData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Fetch intelligence data
  const fetchIntelligence = useCallback(async () => {
    if (!token) return;

    try {
      setError(null);

      const response = await fetch('/api/cashflow/intelligence', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const json = await response.json();

      if (response.ok && json.success) {
        setIntelligence(json.data);
      } else {
        setError(json.error || 'Failed to load intelligence data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Fetch AI summary
  const fetchSummary = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/cashflow/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return; // Silently fail for summary
      }

      const json = await response.json();

      if (response.ok && json.success && json.data) {
        setSummary({
          content: json.data.content,
          keyInsights: json.data.keyInsights || [],
          generatedAt: json.data.generatedAt,
          isStale: json.data.isStale || false,
        });
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }, [token]);

  // Regenerate AI summary
  const regenerateSummary = useCallback(async () => {
    if (!token) return;

    setSummaryLoading(true);

    try {
      const response = await fetch('/api/cashflow/summary', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await response.json();

      if (response.ok && json.success && json.data) {
        setSummary({
          content: json.data.content,
          keyInsights: json.data.keyInsights || [],
          generatedAt: json.data.generatedAt,
          isStale: false,
        });
      }
    } catch (err) {
      console.error('Failed to regenerate summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchIntelligence();
      fetchSummary();
    }
  }, [token, fetchIntelligence, fetchSummary]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchIntelligence();
    await fetchSummary();
  };

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
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <ErrorState error={error} onRetry={fetchIntelligence} />
        </div>
      </DashboardLayout>
    );
  }

  // Render empty state
  if (!intelligence) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <ErrorState
            error="No financial data available. Add accounts, income, and expenses to see your intelligence dashboard."
            onRetry={fetchIntelligence}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Cashflow Intelligence
            </h1>
            <p className="text-gray-500 mt-1">
              Your complete financial picture in one place
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

        {/* Section 1: AI Summary (Hero) */}
        {summary && (
          <div className="mb-6">
            <GeminiSummary
              content={summary.content}
              keyInsights={summary.keyInsights}
              generatedAt={new Date(summary.generatedAt)}
              isStale={summary.isStale}
              isLoading={summaryLoading}
              onRegenerate={regenerateSummary}
            />
          </div>
        )}

        {/* Section 2: Health Score + Forecast Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Health Score */}
          <CashflowHealthScore
            overallScore={intelligence.healthScore.overallScore}
            tier={intelligence.healthScore.tier}
            breakdown={intelligence.healthScore.breakdown}
            confidence={intelligence.healthScore.confidence}
            lastCalculated={new Date(intelligence.healthScore.lastCalculated)}
          />

          {/* Quick Stats */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <LineChart className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-semibold text-gray-900">Forecast Summary</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Current Balance</p>
                <p className="text-xl font-bold text-gray-900">
                  ${intelligence.forecast.current.balance.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Monthly Net</p>
                <p className={`text-xl font-bold ${intelligence.forecast.current.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {intelligence.forecast.current.net >= 0 ? '+' : ''}${intelligence.forecast.current.net.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">30-Day Forecast</p>
                <p className={`text-xl font-bold ${intelligence.forecast.forecast30Day.risk === 'HIGH' ? 'text-red-600' : 'text-gray-900'}`}>
                  ${intelligence.forecast.forecast30Day.predictedBalance.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Break-Even Day</p>
                <p className="text-xl font-bold text-gray-900">
                  {intelligence.forecast.breakEvenDay > 0 ? `Day ${intelligence.forecast.breakEvenDay}` : 'N/A'}
                </p>
              </div>
            </div>

            {intelligence.forecast.shortfallRisk && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-800">Shortfall risk detected in forecast period</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Money Flow (Waterfall) + Leaks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <WaterfallChart
            items={intelligence.waterfall.items}
            netIncome={intelligence.waterfall.netIncome}
            totalExpenses={intelligence.waterfall.totalExpenses}
            surplus={intelligence.waterfall.surplus}
          />
          <MoneyLeakDetector
            totalLeakage={intelligence.leaks.totalLeakage}
            leaks={intelligence.leaks.leaks}
            topCategories={intelligence.leaks.topCategories}
            analyzedFrom={new Date(intelligence.leaks.analyzedFrom)}
            analyzedTo={new Date(intelligence.leaks.analyzedTo)}
            transactionCount={intelligence.leaks.transactionCount}
          />
        </div>

        {/* Section 4: Budget vs Actual + Tax */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {intelligence.budgetComparison ? (
            <BudgetVsActual
              categories={intelligence.budgetComparison.categories}
              totalBudgeted={intelligence.budgetComparison.totalBudgeted}
              totalActual={intelligence.budgetComparison.totalActual}
              totalVariance={intelligence.budgetComparison.totalVariance}
              overallStatus={intelligence.budgetComparison.overallStatus}
              periodStart={new Date(intelligence.budgetComparison.period.start)}
              periodEnd={new Date(intelligence.budgetComparison.period.end)}
            />
          ) : (
            <BudgetVsActual
              categories={[]}
              totalBudgeted={0}
              totalActual={0}
              totalVariance={0}
              overallStatus="ON_TRACK"
              periodStart={new Date()}
              periodEnd={new Date()}
            />
          )}

          {intelligence.taxOptimization && (
            <TaxOptimization
              estimatedAnnualTax={intelligence.taxOptimization.estimatedAnnualTax}
              deductibleExpenses={intelligence.taxOptimization.deductibleExpenses}
              potentialSavings={intelligence.taxOptimization.potentialSavings}
              recommendations={intelligence.taxOptimization.recommendations}
              effectiveTaxRate={intelligence.taxOptimization.effectiveTaxRate}
              paygWithheld={intelligence.taxOptimization.paygWithheld}
            />
          )}
        </div>

        {/* Section 5: Smart Actions */}
        {intelligence.smartActions.length > 0 && (
          <div className="mb-6">
            <SmartActionsEnhanced actions={intelligence.smartActions} />
          </div>
        )}

        {/* Footer: Data Quality Indicator */}
        <div className="flex items-center justify-center gap-4 py-4 text-xs text-gray-400">
          <span>Data coverage: {intelligence.dataQuality.confidence.toFixed(0)}%</span>
          <span>•</span>
          <span>{intelligence.leaks.transactionCount} transactions analyzed</span>
        </div>
      </div>
    </DashboardLayout>
  );
}

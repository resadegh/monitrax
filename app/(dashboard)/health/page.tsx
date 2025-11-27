/**
 * FINANCIAL HEALTH DASHBOARD
 * Phase 12 - Financial Health Engine UI
 *
 * Displays comprehensive financial health score with:
 * - Overall score with trend
 * - Category breakdown
 * - Risk signals
 * - Improvement actions
 */

'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Target,
  RefreshCw,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface HealthCategory {
  name: string;
  score: number;
  weight: number;
  riskBand: string;
  contributingMetrics: {
    name: string;
    value: number;
    weight: number;
    score: number;
    benchmark: number;
  }[];
}

interface RiskSignal {
  id: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  tier: number;
  evidence: {
    metric: string;
    currentValue: number;
    threshold: number;
    trend: string;
  };
}

interface ImprovementAction {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'EASY' | 'MODERATE' | 'HARD';
  impact: {
    scoreImprovement: number;
    financialImpact: number;
    timeframe: string;
  };
  priority: number;
}

interface HealthReport {
  healthScore: {
    score: number;
    confidence: number;
    riskBand: string;
    trend: {
      direction: 'IMPROVING' | 'STABLE' | 'DECLINING';
      changePercent: number;
      periodMonths: number;
    };
  };
  categories: HealthCategory[];
  riskSignals: RiskSignal[];
  improvementActions: ImprovementAction[];
  modifiers: {
    totalPenalty: number;
  };
  evidence: {
    confidenceLevel: number;
    riskMap: any[];
  };
  generatedAt: string;
}

// =============================================================================
// HELPERS
// =============================================================================

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

function getRiskBandTextColor(band: string): string {
  switch (band) {
    case 'EXCELLENT':
      return 'text-green-600';
    case 'GOOD':
      return 'text-green-500';
    case 'MODERATE':
      return 'text-yellow-600';
    case 'CONCERNING':
      return 'text-orange-600';
    case 'CRITICAL':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'CRITICAL':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case 'HIGH':
      return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    case 'MEDIUM':
      return <Info className="h-5 w-5 text-yellow-500" />;
    default:
      return <Info className="h-5 w-5 text-blue-500" />;
  }
}

function getDifficultyBadge(difficulty: string) {
  switch (difficulty) {
    case 'EASY':
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
          Easy
        </span>
      );
    case 'MODERATE':
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
          Moderate
        </span>
      );
    case 'HARD':
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
          Hard
        </span>
      );
    default:
      return null;
  }
}

function formatCategoryName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// =============================================================================
// COMPONENTS
// =============================================================================

function ScoreGauge({ score, riskBand }: { score: number; riskBand: string }) {
  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90 w-32 h-32">
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-gray-200"
        />
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className={getRiskBandTextColor(riskBand)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold">{score}</span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>
    </div>
  );
}

function CategoryBar({ category }: { category: HealthCategory }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium">{formatCategoryName(category.name)}</span>
        <span className={`text-sm font-bold ${getRiskBandTextColor(category.riskBand)}`}>
          {category.score}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full ${getRiskBandColor(category.riskBand)}`}
          style={{ width: `${category.score}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 mt-1">Weight: {(category.weight * 100).toFixed(0)}%</div>
    </div>
  );
}

function RiskSignalCard({ signal }: { signal: RiskSignal }) {
  return (
    <div className="border rounded-lg p-4 mb-3 bg-white shadow-sm">
      <div className="flex items-start gap-3">
        {getSeverityIcon(signal.severity)}
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h4 className="font-medium">{signal.title}</h4>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                signal.severity === 'CRITICAL'
                  ? 'bg-red-100 text-red-800'
                  : signal.severity === 'HIGH'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {signal.severity}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{signal.description}</p>
          <div className="text-xs text-gray-500 mt-2">
            {signal.evidence.metric}: {signal.evidence.currentValue.toFixed(1)} (threshold:{' '}
            {signal.evidence.threshold})
          </div>
        </div>
      </div>
    </div>
  );
}

function ImprovementCard({ action }: { action: ImprovementAction }) {
  return (
    <div className="border rounded-lg p-4 mb-3 bg-white shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Target className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h4 className="font-medium">{action.title}</h4>
            {getDifficultyBadge(action.difficulty)}
          </div>
          <p className="text-sm text-gray-600 mt-1">{action.description}</p>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span>+{action.impact.scoreImprovement} pts</span>
            <span>{action.impact.timeframe}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function HealthDashboard() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthReport();
  }, []);

  async function fetchHealthReport() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/financial-health');
      const json = await response.json();

      if (response.ok && json.success) {
        setReport(json.data);
      } else {
        setError(json.error || json.details || 'Failed to load health data');
        console.error('Health API error:', json);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      setError(errorMessage);
      console.error('Failed to fetch health report:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchHealthReport();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded col-span-2"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              {error ? 'Error Loading Health Data' : 'No Health Data Available'}
            </h3>
            <p className="text-gray-500 mt-2">
              {error || 'Add financial data to see your health score.'}
            </p>
            {error && (
              <button
                onClick={fetchHealthReport}
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

  const { healthScore, categories, riskSignals, improvementActions } = report;

  return (
    <DashboardLayout>
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Financial Health</h1>
          <p className="text-gray-500 text-sm">
            Last updated: {new Date(report.generatedAt).toLocaleString()}
          </p>
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

      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Main Score */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Overall Score</h2>
          <div className="flex flex-col items-center">
            <ScoreGauge score={healthScore.score} riskBand={healthScore.riskBand} />
            <div className="mt-4 text-center">
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getRiskBandColor(
                  healthScore.riskBand
                )} text-white`}
              >
                {healthScore.riskBand}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
              {healthScore.trend.direction === 'IMPROVING' && (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
              {healthScore.trend.direction === 'DECLINING' && (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              {healthScore.trend.direction === 'STABLE' && (
                <Minus className="h-4 w-4 text-gray-500" />
              )}
              <span>
                {healthScore.trend.direction === 'STABLE'
                  ? 'Stable'
                  : `${healthScore.trend.changePercent > 0 ? '+' : ''}${healthScore.trend.changePercent.toFixed(1)}%`}
              </span>
              <span className="text-gray-400">
                ({healthScore.trend.periodMonths}m)
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Confidence: {healthScore.confidence}%
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-lg shadow p-6 col-span-2">
          <h2 className="text-lg font-semibold mb-4">Category Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {categories.map((category) => (
              <CategoryBar key={category.name} category={category} />
            ))}
          </div>
        </div>
      </div>

      {/* Risk Signals & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Signals */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Risk Signals
            {riskSignals.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({riskSignals.length})
              </span>
            )}
          </h2>
          {riskSignals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-2" />
              <p>No significant risks detected</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {riskSignals.map((signal) => (
                <RiskSignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </div>

        {/* Improvement Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Improvement Actions
            {improvementActions.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({improvementActions.length})
              </span>
            )}
          </h2>
          {improvementActions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-2" />
              <p>No improvement actions needed</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {improvementActions.map((action) => (
                <ImprovementCard key={action.id} action={action} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modifiers & Evidence */}
      {report.modifiers.totalPenalty > 0 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <Info className="h-5 w-5" />
            <span className="font-medium">Score Adjustments Applied</span>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            Your score has been reduced by {report.modifiers.totalPenalty.toFixed(1)} points due to
            data quality or system factors. Improve data completeness for a more accurate score.
          </p>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}

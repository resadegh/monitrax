'use client';

/**
 * STABILITY SCORE
 * Section 6 - How predictable is your cash flow
 *
 * Volatility index as a score out of 100
 * Features:
 * - Circular gauge visualization
 * - Risk factors breakdown
 * - Trend indicator
 */

import { useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { colors, componentClasses } from '../design-system';

// =============================================================================
// TYPES
// =============================================================================

interface RiskFactor {
  name: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
}

interface StabilityScoreProps {
  score: number; // 0-100, where 100 is most stable
  previousScore?: number;
  riskFactors?: RiskFactor[];
  loading?: boolean;
}

// =============================================================================
// CIRCULAR GAUGE COMPONENT
// =============================================================================

function CircularGauge({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = () => {
    if (score >= 80) return colors.success;
    if (score >= 60) return colors.successLight;
    if (score >= 40) return colors.warning;
    return colors.danger;
  };

  const scoreColor = getScoreColor();

  return (
    <div className="relative w-40 h-40 mx-auto">
      {/* Background circle */}
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={colors.gray100}
          strokeWidth="12"
        />
        {/* Progress circle */}
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={scoreColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Score display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-gray-900 tabular-nums">
          {score}
        </span>
        <span className="text-sm text-gray-500">out of 100</span>
      </div>
    </div>
  );
}

// =============================================================================
// RISK FACTOR COMPONENT
// =============================================================================

function RiskFactorItem({ factor }: { factor: RiskFactor }) {
  const impactColors = {
    high: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    medium: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    low: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  };

  const classes = impactColors[factor.impact];

  return (
    <div className="flex items-start gap-3 py-2">
      <div className={`w-2 h-2 rounded-full mt-1.5 ${classes.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm">{factor.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{factor.description}</p>
      </div>
      <span className={`text-xs font-medium px-2 py-0.5 rounded ${classes.bg} ${classes.text}`}>
        {factor.impact}
      </span>
    </div>
  );
}

// =============================================================================
// LOADING STATE
// =============================================================================

function LoadingSkeleton() {
  return (
    <div className={componentClasses.card}>
      <div className="p-6">
        <div className="h-6 w-36 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="w-40 h-40 bg-gray-100 rounded-full mx-auto animate-pulse mb-6" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function StabilityScore({
  score,
  previousScore,
  riskFactors = [],
  loading = false,
}: StabilityScoreProps) {
  const trend = useMemo(() => {
    if (!previousScore) return 'neutral';
    if (score > previousScore + 5) return 'up';
    if (score < previousScore - 5) return 'down';
    return 'neutral';
  }, [score, previousScore]);

  const scoreLabel = useMemo(() => {
    if (score >= 80) return { text: 'Highly Stable', color: 'text-green-600' };
    if (score >= 60) return { text: 'Stable', color: 'text-emerald-600' };
    if (score >= 40) return { text: 'Moderate', color: 'text-amber-600' };
    return { text: 'Volatile', color: 'text-red-600' };
  }, [score]);

  const interpretation = useMemo(() => {
    if (score >= 80) {
      return 'Your cashflow is highly predictable. You can confidently plan investments and major purchases.';
    }
    if (score >= 60) {
      return 'Your cashflow is fairly predictable. Maintain a moderate emergency buffer.';
    }
    if (score >= 40) {
      return 'Your cashflow has some variability. Consider building a larger emergency fund.';
    }
    return 'Your cashflow is unpredictable. Focus on stabilizing income and expenses before major commitments.';
  }, [score]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className={componentClasses.card}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={componentClasses.sectionTitle}>Stability Score</h3>
            <p className={componentClasses.sectionSubtitle}>Cashflow predictability</p>
          </div>
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Activity className="h-5 w-5 text-indigo-600" />
          </div>
        </div>

        {/* Gauge */}
        <CircularGauge score={score} />

        {/* Score label and trend */}
        <div className="text-center mt-4 mb-6">
          <div className="flex items-center justify-center gap-2">
            <span className={`text-lg font-semibold ${scoreLabel.color}`}>
              {scoreLabel.text}
            </span>
            {trend !== 'neutral' && (
              <div className={`flex items-center gap-1 ${
                trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend === 'up' ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {Math.abs(score - (previousScore || 0))} pts
                </span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
            {interpretation}
          </p>
        </div>

        {/* Risk factors */}
        {riskFactors.length > 0 && (
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Contributing Factors
            </h4>
            <div className="space-y-1">
              {riskFactors.slice(0, 4).map((factor, i) => (
                <RiskFactorItem key={i} factor={factor} />
              ))}
            </div>
          </div>
        )}

        {/* Stability tips */}
        {score < 60 && (
          <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
            <p className="text-sm text-indigo-700">
              <strong>Tip:</strong> Setting up automated transfers and consolidating payment dates can improve stability by 10-20 points.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

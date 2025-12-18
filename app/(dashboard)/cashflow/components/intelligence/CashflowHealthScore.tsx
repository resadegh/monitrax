'use client';

/**
 * CASHFLOW HEALTH SCORE COMPONENT
 * Phase 29 - Cashflow Intelligence Center
 *
 * Displays the unified cashflow health score (0-100)
 * with breakdown by category and visual indicators.
 */

import { useState } from 'react';
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface HealthBreakdown {
  category: string;
  score: number;
  weight: number;
  description: string;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

interface Props {
  overallScore: number;
  tier: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'CONCERNING' | 'CRITICAL';
  breakdown: HealthBreakdown[];
  confidence: number;
  lastCalculated: Date;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function tierToColor(tier: Props['tier']): string {
  switch (tier) {
    case 'EXCELLENT': return 'text-green-600';
    case 'GOOD': return 'text-lime-600';
    case 'MODERATE': return 'text-yellow-600';
    case 'CONCERNING': return 'text-orange-600';
    case 'CRITICAL': return 'text-red-600';
  }
}

function tierToBgColor(tier: Props['tier']): string {
  switch (tier) {
    case 'EXCELLENT': return 'bg-green-500';
    case 'GOOD': return 'bg-lime-500';
    case 'MODERATE': return 'bg-yellow-500';
    case 'CONCERNING': return 'bg-orange-500';
    case 'CRITICAL': return 'bg-red-500';
  }
}

function tierToLightBg(tier: Props['tier']): string {
  switch (tier) {
    case 'EXCELLENT': return 'bg-green-50';
    case 'GOOD': return 'bg-lime-50';
    case 'MODERATE': return 'bg-yellow-50';
    case 'CONCERNING': return 'bg-orange-50';
    case 'CRITICAL': return 'bg-red-50';
  }
}

function scoreToBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-lime-500';
  if (score >= 40) return 'bg-yellow-500';
  if (score >= 20) return 'bg-orange-500';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: 'IMPROVING' | 'STABLE' | 'DECLINING' }) {
  if (trend === 'IMPROVING') {
    return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  }
  if (trend === 'DECLINING') {
    return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  }
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}

// =============================================================================
// BREAKDOWN ITEM COMPONENT
// =============================================================================

function BreakdownItem({ item }: { item: HealthBreakdown }) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{item.category}</span>
          <TrendIcon trend={item.trend} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{item.score}</span>
          <span className="text-xs text-gray-400">/ 100</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full ${scoreToBarColor(item.score)} transition-all duration-500`}
          style={{ width: `${item.score}%` }}
        />
      </div>

      <p className="text-xs text-gray-500">{item.description}</p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CashflowHealthScore({
  overallScore,
  tier,
  breakdown,
  confidence,
  lastCalculated,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate the arc for the score gauge (0-180 degrees)
  const arcDegrees = (overallScore / 100) * 180;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 ${tierToLightBg(tier)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className={`h-5 w-5 ${tierToColor(tier)}`} />
            <h3 className="text-lg font-semibold text-gray-900">Cashflow Health</h3>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Info className="h-3.5 w-3.5" />
            <span>{confidence}% confidence</span>
          </div>
        </div>
      </div>

      {/* Score Display */}
      <div className="px-6 py-8">
        <div className="flex flex-col items-center">
          {/* Circular Score Gauge */}
          <div className="relative w-44 h-24 mb-4">
            {/* Background arc */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 176 88">
              <path
                d="M 8 80 A 80 80 0 0 1 168 80"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Colored arc */}
              <path
                d="M 8 80 A 80 80 0 0 1 168 80"
                fill="none"
                stroke={
                  tier === 'EXCELLENT' ? '#22c55e' :
                  tier === 'GOOD' ? '#84cc16' :
                  tier === 'MODERATE' ? '#eab308' :
                  tier === 'CONCERNING' ? '#f97316' : '#ef4444'
                }
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(arcDegrees / 180) * 251.3} 251.3`}
                className="transition-all duration-700"
              />
            </svg>

            {/* Score number */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
              <span className={`text-4xl font-bold ${tierToColor(tier)}`}>
                {overallScore}
              </span>
            </div>
          </div>

          {/* Tier badge */}
          <div className={`px-4 py-1.5 rounded-full ${tierToLightBg(tier)}`}>
            <span className={`text-sm font-semibold ${tierToColor(tier)}`}>
              {tier}
            </span>
          </div>

          {/* Quick summary */}
          <p className="text-sm text-gray-500 mt-3 text-center max-w-xs">
            {tier === 'EXCELLENT' && 'Your cashflow is in excellent shape. Keep it up!'}
            {tier === 'GOOD' && 'Your cashflow is healthy with room for improvement.'}
            {tier === 'MODERATE' && 'Your cashflow needs some attention.'}
            {tier === 'CONCERNING' && 'Your cashflow has some issues to address.'}
            {tier === 'CRITICAL' && 'Your cashflow needs immediate attention.'}
          </p>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-3 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
      >
        <span>{isExpanded ? 'Hide breakdown' : 'View breakdown'}</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Breakdown Section */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="divide-y divide-gray-100">
            {breakdown.map((item) => (
              <BreakdownItem key={item.category} item={item} />
            ))}
          </div>

          {/* Last updated */}
          <p className="text-xs text-gray-400 text-center mt-4">
            Last calculated: {new Date(lastCalculated).toLocaleString('en-AU', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
      )}
    </div>
  );
}

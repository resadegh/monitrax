'use client';

/**
 * SMART CASH ALLOCATION
 * Section 4 - AI recommendations for moving money TODAY
 *
 * Shows opportunities to optimize cash across accounts
 * Features:
 * - One-click transfer buttons
 * - Calculated savings
 * - Priority ranking
 * - Offset maximization
 */

import { useState } from 'react';
import {
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  TrendingUp,
  CheckCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { colors, formatCurrency, componentClasses } from '../design-system';

// =============================================================================
// TYPES
// =============================================================================

interface AllocationRecommendation {
  id: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  reason: string;
  projectedBenefit: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  type: 'offset' | 'shortfall' | 'optimization';
}

interface SmartAllocationProps {
  recommendations: AllocationRecommendation[];
  onTransfer?: (recommendation: AllocationRecommendation) => Promise<void>;
  loading?: boolean;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function getTypeIcon(type: AllocationRecommendation['type']) {
  switch (type) {
    case 'offset':
      return <TrendingUp className="h-5 w-5 text-indigo-600" />;
    case 'shortfall':
      return <Shield className="h-5 w-5 text-red-600" />;
    case 'optimization':
      return <Zap className="h-5 w-5 text-amber-600" />;
    default:
      return <Sparkles className="h-5 w-5 text-gray-600" />;
  }
}

function getTypeLabel(type: AllocationRecommendation['type']) {
  switch (type) {
    case 'offset':
      return { text: 'Offset Maximization', color: 'bg-indigo-50 text-indigo-700' };
    case 'shortfall':
      return { text: 'Prevent Shortfall', color: 'bg-red-50 text-red-700' };
    case 'optimization':
      return { text: 'Cash Optimization', color: 'bg-amber-50 text-amber-700' };
    default:
      return { text: 'Recommendation', color: 'bg-gray-50 text-gray-700' };
  }
}

function getUrgencyBadge(urgency: AllocationRecommendation['urgency']) {
  switch (urgency) {
    case 'HIGH':
      return 'bg-red-100 text-red-700';
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function AllocationCard({
  recommendation,
  onTransfer,
}: {
  recommendation: AllocationRecommendation;
  onTransfer?: (rec: AllocationRecommendation) => Promise<void>;
}) {
  const [transferring, setTransferring] = useState(false);
  const [transferred, setTransferred] = useState(false);

  const handleTransfer = async () => {
    if (!onTransfer || transferring || transferred) return;

    setTransferring(true);
    try {
      await onTransfer(recommendation);
      setTransferred(true);
    } catch (error) {
      console.error('Transfer failed:', error);
    } finally {
      setTransferring(false);
    }
  };

  const typeLabel = getTypeLabel(recommendation.type);

  if (transferred) {
    return (
      <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-green-800">Transfer initiated</p>
            <p className="text-sm text-green-600">
              {formatCurrency(recommendation.amount)} to {recommendation.toAccountName}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-200 hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            recommendation.type === 'offset'
              ? 'bg-indigo-50'
              : recommendation.type === 'shortfall'
              ? 'bg-red-50'
              : 'bg-amber-50'
          }`}>
            {getTypeIcon(recommendation.type)}
          </div>
          <div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeLabel.color}`}>
              {typeLabel.text}
            </span>
            <p className="text-xs text-gray-500 mt-1">
              {recommendation.urgency === 'HIGH' ? 'Action recommended today' : 'Optimization opportunity'}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getUrgencyBadge(recommendation.urgency)}`}>
          {recommendation.urgency}
        </span>
      </div>

      {/* Transfer Flow */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-0.5">From</p>
          <p className="font-medium text-gray-900 truncate">
            {recommendation.fromAccountName}
          </p>
        </div>

        <div className="flex-shrink-0 px-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-indigo-600" />
          </div>
        </div>

        <div className="flex-1 min-w-0 text-right">
          <p className="text-xs text-gray-500 mb-0.5">To</p>
          <p className="font-medium text-gray-900 truncate">
            {recommendation.toAccountName}
          </p>
        </div>
      </div>

      {/* Amount and Benefit */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {formatCurrency(recommendation.amount)}
          </p>
          <p className="text-sm text-gray-500">{recommendation.reason}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Annual savings</p>
          <p className="text-lg font-bold text-green-600 tabular-nums">
            +{formatCurrency(recommendation.projectedBenefit)}
          </p>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleTransfer}
        disabled={transferring || !onTransfer}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
          onTransfer
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
            : 'bg-gray-100 text-gray-500 cursor-not-allowed'
        }`}
      >
        {transferring ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Initiating transfer...</span>
          </>
        ) : (
          <>
            <span>Transfer Now</span>
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
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
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
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
        <h3 className={componentClasses.sectionTitle}>Smart Cash Allocation</h3>
        <div className="py-12 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-gray-700 font-medium">Your cash is optimally allocated</p>
          <p className="text-gray-500 text-sm mt-1">
            No transfer recommendations at this time
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SmartAllocation({
  recommendations,
  onTransfer,
  loading = false,
}: SmartAllocationProps) {
  // Sort by urgency and benefit
  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const urgencyOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return b.projectedBenefit - a.projectedBenefit;
  });

  // Calculate total potential savings
  const totalSavings = recommendations.reduce(
    (sum, r) => sum + r.projectedBenefit,
    0
  );

  if (loading) return <LoadingSkeleton />;
  if (!recommendations || recommendations.length === 0) return <EmptyState />;

  return (
    <div className={componentClasses.card}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className={componentClasses.sectionTitle}>Smart Cash Allocation</h3>
              <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-indigo-600" />
              </div>
            </div>
            <p className={componentClasses.sectionSubtitle}>
              AI-powered optimization recommendations
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-0.5">Total potential savings</p>
            <p className="text-lg font-bold text-green-600 tabular-nums">
              +{formatCurrency(totalSavings)}/yr
            </p>
          </div>
        </div>

        {/* Recommendations */}
        <div className="space-y-4">
          {sortedRecommendations.map((rec) => (
            <AllocationCard
              key={rec.id}
              recommendation={rec}
              onTransfer={onTransfer}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

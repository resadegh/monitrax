'use client';

/**
 * ENHANCED SMART ACTIONS COMPONENT
 * Phase 29 - Cashflow Intelligence Center
 *
 * Displays ranked list of actionable recommendations with navigation links.
 * Combines recommendations from all engines (COE, Health, Tax, Budget).
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  ArrowRight,
  Wallet,
  Ban,
  Search,
  PiggyBank,
  Settings,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface SmartAction {
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
}

interface Props {
  actions: SmartAction[];
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
  }).format(amount);
}

function priorityToColor(priority: SmartAction['priority']): {
  bg: string;
  text: string;
  border: string;
} {
  switch (priority) {
    case 'CRITICAL':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    case 'HIGH':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
    case 'MEDIUM':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'LOW':
      return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
  }
}

function categoryIcon(category: SmartAction['category']) {
  switch (category) {
    case 'SAVE':
      return <PiggyBank className="h-4 w-4" />;
    case 'TRANSFER':
      return <ArrowRight className="h-4 w-4" />;
    case 'CANCEL':
      return <Ban className="h-4 w-4" />;
    case 'OPTIMIZE':
      return <Settings className="h-4 w-4" />;
    case 'REVIEW':
      return <Search className="h-4 w-4" />;
  }
}

function sourceToLabel(source: SmartAction['source']): string {
  switch (source) {
    case 'COE': return 'Optimization';
    case 'HEALTH': return 'Health';
    case 'TAX': return 'Tax';
    case 'BUDGET': return 'Budget';
    case 'FORECAST': return 'Forecast';
  }
}

// =============================================================================
// ACTION CARD COMPONENT
// =============================================================================

function ActionCard({ action, index }: { action: SmartAction; index: number }) {
  const [isComplete, setIsComplete] = useState(false);
  const colors = priorityToColor(action.priority);

  if (isComplete) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
        <span className="text-sm text-green-700 line-through">{action.title}</span>
        <span className="ml-auto text-xs text-green-600">Done</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4 hover:shadow-md transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Rank badge */}
        <div className={`flex-shrink-0 w-7 h-7 rounded-full ${colors.bg} border-2 ${colors.border} flex items-center justify-center`}>
          <span className={`text-sm font-bold ${colors.text}`}>{index + 1}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">{action.title}</h4>
          </div>
          <p className="text-sm text-gray-600">{action.description}</p>
        </div>

        {/* Category icon */}
        <div className={`flex-shrink-0 p-2 rounded-lg ${colors.bg} ${colors.text}`}>
          {categoryIcon(action.category)}
        </div>
      </div>

      {/* Impact and Source */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
            {action.priority}
          </span>
          <span className="text-xs text-gray-400">
            via {sourceToLabel(action.source)}
          </span>
        </div>
        {action.impact > 0 && (
          <span className="text-sm font-semibold text-green-600">
            {action.impactDescription}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {action.actionUrl && (
          <Link
            href={action.actionUrl}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <span>View Details</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}

        {action.learnMoreUrl && (
          <Link
            href={action.learnMoreUrl}
            className="flex items-center justify-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span>Learn How</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}

        {!action.actionUrl && !action.learnMoreUrl && (
          <button
            onClick={() => setIsComplete(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <CheckCircle className="h-4 w-4" />
            <span>Mark Complete</span>
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <CheckCircle className="h-6 w-6 text-green-600" />
      </div>
      <p className="text-gray-700 font-medium">All caught up!</p>
      <p className="text-gray-500 text-sm mt-1">
        No urgent actions needed right now
      </p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SmartActionsEnhanced({ actions }: Props) {
  const [showAll, setShowAll] = useState(false);

  // Sort by priority and rank
  const sortedActions = [...actions].sort((a, b) => {
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return a.rank - b.rank;
  });

  const displayedActions = showAll ? sortedActions : sortedActions.slice(0, 3);

  // Calculate total potential impact
  const totalImpact = actions.reduce((sum, a) => sum + a.impact, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Zap className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Smart Actions</h3>
              <p className="text-sm text-gray-500">
                {actions.length} recommendation{actions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {totalImpact > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Total potential</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(totalImpact)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions List */}
      <div className="p-4">
        {actions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {displayedActions.map((action, index) => (
              <ActionCard key={action.id} action={action} index={index} />
            ))}
          </div>
        )}

        {/* Show more button */}
        {actions.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            {showAll ? 'Show less' : `Show all ${actions.length} actions`}
          </button>
        )}
      </div>

      {/* Footer tip */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
          <Zap className="h-3.5 w-3.5 text-indigo-400" />
          Complete actions to improve your cashflow health score
        </p>
      </div>
    </div>
  );
}

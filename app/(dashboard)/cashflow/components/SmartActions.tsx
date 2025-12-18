'use client';

/**
 * SMART ACTIONS (This Week)
 * Section 7 - Time-sensitive cash-specific actions
 *
 * 3-5 things to do THIS WEEK to improve cash position
 * Features:
 * - Prioritized list
 * - Time estimates
 * - Impact scores
 * - One-click actions
 */

import { useState } from 'react';
import {
  Zap,
  Clock,
  ChevronRight,
  CheckCircle,
  Circle,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { colors, formatCurrency, componentClasses } from '../design-system';

// =============================================================================
// TYPES
// =============================================================================

interface SmartAction {
  id: string;
  title: string;
  description: string;
  impact: number; // $ value
  timeEstimate: string; // e.g., "5 min", "15 min"
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'transfer' | 'cancel' | 'schedule' | 'review' | 'save';
  actionUrl?: string;
  completed?: boolean;
}

interface SmartActionsProps {
  actions: SmartAction[];
  onComplete?: (actionId: string) => void;
  onDismiss?: (actionId: string) => void;
  loading?: boolean;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function getPriorityStyles(priority: SmartAction['priority']) {
  switch (priority) {
    case 'critical':
      return {
        badge: 'bg-red-100 text-red-700',
        border: 'border-l-red-500',
        icon: 'bg-red-50 text-red-600',
      };
    case 'high':
      return {
        badge: 'bg-amber-100 text-amber-700',
        border: 'border-l-amber-500',
        icon: 'bg-amber-50 text-amber-600',
      };
    case 'medium':
      return {
        badge: 'bg-blue-100 text-blue-700',
        border: 'border-l-blue-500',
        icon: 'bg-blue-50 text-blue-600',
      };
    default:
      return {
        badge: 'bg-gray-100 text-gray-700',
        border: 'border-l-gray-300',
        icon: 'bg-gray-50 text-gray-600',
      };
  }
}

function getCategoryIcon(category: SmartAction['category']) {
  switch (category) {
    case 'transfer':
      return 'Send';
    case 'cancel':
      return 'Cancel';
    case 'schedule':
      return 'Calendar';
    case 'review':
      return 'Search';
    case 'save':
      return 'Wallet';
    default:
      return 'Zap';
  }
}

function ActionCard({
  action,
  onComplete,
  onDismiss,
}: {
  action: SmartAction;
  onComplete?: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  const [isCompleted, setIsCompleted] = useState(action.completed || false);
  const [isDismissed, setIsDismissed] = useState(false);

  const styles = getPriorityStyles(action.priority);

  const handleComplete = () => {
    setIsCompleted(true);
    onComplete?.(action.id);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.(action.id);
  };

  if (isDismissed) return null;

  if (isCompleted) {
    return (
      <div className="flex items-center gap-3 py-3 px-4 bg-green-50 rounded-xl border border-green-100">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <span className="text-sm text-green-700 line-through">{action.title}</span>
        <span className="ml-auto text-xs text-green-600">Completed</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-white ${styles.border} border-l-4 p-4 hover:shadow-md transition-all duration-200`}
    >
      <div className="flex items-start gap-3">
        {/* Complete button */}
        <button
          onClick={handleComplete}
          className="flex-shrink-0 mt-0.5 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
        >
          <Circle className="h-5 w-5 text-gray-300 hover:text-indigo-500 transition-colors" />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-medium text-gray-900">{action.title}</h4>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <p className="text-sm text-gray-500 mb-3">{action.description}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Time estimate */}
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{action.timeEstimate}</span>
              </div>

              {/* Priority badge */}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles.badge}`}>
                {action.priority}
              </span>

              {/* Impact */}
              <span className="text-xs font-medium text-green-600">
                +{formatCurrency(action.impact)}
              </span>
            </div>

            {/* Action button */}
            {action.actionUrl && (
              <a
                href={action.actionUrl}
                className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <span>Do it</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
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
        <h3 className={componentClasses.sectionTitle}>Smart Actions</h3>
        <div className="py-12 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-gray-700 font-medium">All caught up!</p>
          <p className="text-gray-500 text-sm mt-1">
            No urgent actions needed this week
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SmartActions({
  actions,
  onComplete,
  onDismiss,
  loading = false,
}: SmartActionsProps) {
  // Sort by priority
  const sortedActions = [...actions].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Calculate total impact
  const totalImpact = actions.reduce((sum, a) => sum + a.impact, 0);

  // Filter out completed actions from count
  const pendingCount = actions.filter((a) => !a.completed).length;

  if (loading) return <LoadingSkeleton />;
  if (!actions || actions.length === 0) return <EmptyState />;

  return (
    <div className={componentClasses.card}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className={componentClasses.sectionTitle}>Smart Actions</h3>
              <span className="inline-flex items-center justify-center w-5 h-5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                {pendingCount}
              </span>
            </div>
            <p className={componentClasses.sectionSubtitle}>
              This week's priorities
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-0.5">Total impact</p>
            <p className="text-lg font-bold text-green-600 tabular-nums">
              +{formatCurrency(totalImpact)}
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{actions.filter((a) => a.completed).length}/{actions.length} completed</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{
                width: `${(actions.filter((a) => a.completed).length / actions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Action list */}
        <div className="space-y-3">
          {sortedActions.slice(0, 5).map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onComplete={onComplete}
              onDismiss={onDismiss}
            />
          ))}
        </div>

        {/* Footer tip */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Zap className="h-3.5 w-3.5" />
            Complete all actions to unlock your full savings potential
          </p>
        </div>
      </div>
    </div>
  );
}

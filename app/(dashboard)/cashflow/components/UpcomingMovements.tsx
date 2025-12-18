'use client';

/**
 * UPCOMING MOVEMENTS (30 DAYS)
 * Section 2 - Timeline of exact dates/amounts
 *
 * Shows what hits when - precise calendar-like display
 * Features:
 * - Collapsible inflow/outflow sections
 * - Sorted by date
 * - Color-coded (green inflows, red outflows)
 * - Total summaries
 */

import { useState, useMemo } from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ChevronDown,
  ChevronRight,
  Calendar,
  Banknote,
} from 'lucide-react';
import { colors, formatCurrency, formatDate, formatRelativeTime, componentClasses } from '../design-system';

// =============================================================================
// TYPES
// =============================================================================

interface Movement {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category?: string;
  accountName?: string;
  isRecurring?: boolean;
}

interface UpcomingMovementsProps {
  movements: Movement[];
  loading?: boolean;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function MovementItem({ movement }: { movement: Movement }) {
  const isInflow = movement.type === 'inflow';

  return (
    <div className={`${componentClasses.listItem} group hover:bg-gray-50 -mx-4 px-4 transition-colors`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
            isInflow ? 'bg-green-50' : 'bg-red-50'
          }`}
        >
          {isInflow ? (
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
          ) : (
            <ArrowDownCircle className="h-5 w-5 text-red-600" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">
            {movement.description}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">
              {formatRelativeTime(movement.date)}
            </span>
            {movement.category && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-xs text-gray-400">{movement.category}</span>
              </>
            )}
            {movement.isRecurring && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600">
                Recurring
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p
          className={`text-sm font-semibold tabular-nums ${
            isInflow ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {isInflow ? '+' : '-'}{formatCurrency(Math.abs(movement.amount))}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatDate(movement.date, 'short')}
        </p>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  count,
  total,
  expanded,
  onToggle,
  colorClass,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  colorClass: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 px-4 -mx-4 hover:bg-gray-50 transition-colors rounded-lg"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-left">
          <p className="font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">
            {count} payment{count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <p className={`font-semibold tabular-nums ${colorClass.includes('green') ? 'text-green-600' : 'text-red-600'}`}>
          {title === 'Inflows' ? '+' : '-'}{formatCurrency(total)}
        </p>
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </div>
    </button>
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
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-100">
            <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-20 bg-gray-100 rounded animate-pulse mt-1" />
            </div>
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
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
        <h3 className={componentClasses.sectionTitle}>Upcoming Movements</h3>
        <div className="py-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Calendar className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-gray-500">No upcoming movements detected</p>
          <p className="text-gray-400 text-sm mt-1">
            Your recurring payments will appear here
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function UpcomingMovements({
  movements,
  loading = false,
}: UpcomingMovementsProps) {
  const [inflowsExpanded, setInflowsExpanded] = useState(true);
  const [outflowsExpanded, setOutflowsExpanded] = useState(true);

  // Split and sort movements
  const { inflows, outflows, totals } = useMemo(() => {
    const sorted = [...movements].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const inflows = sorted.filter((m) => m.type === 'inflow');
    const outflows = sorted.filter((m) => m.type === 'outflow');

    return {
      inflows,
      outflows,
      totals: {
        inflow: inflows.reduce((sum, m) => sum + m.amount, 0),
        outflow: outflows.reduce((sum, m) => sum + m.amount, 0),
        net:
          inflows.reduce((sum, m) => sum + m.amount, 0) -
          outflows.reduce((sum, m) => sum + m.amount, 0),
      },
    };
  }, [movements]);

  if (loading) return <LoadingSkeleton />;
  if (!movements || movements.length === 0) return <EmptyState />;

  return (
    <div className={componentClasses.card}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={componentClasses.sectionTitle}>Upcoming Movements</h3>
            <p className={componentClasses.sectionSubtitle}>Next 30 days</p>
          </div>
          <div className="text-right">
            <p
              className={`text-lg font-bold tabular-nums ${
                totals.net >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {totals.net >= 0 ? '+' : ''}{formatCurrency(totals.net)}
            </p>
            <p className="text-xs text-gray-500">Net movement</p>
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
            {totals.inflow > 0 && (
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{
                  width: `${
                    (totals.inflow / (totals.inflow + totals.outflow)) * 100
                  }%`,
                }}
              />
            )}
            {totals.outflow > 0 && (
              <div
                className="h-full bg-red-500 transition-all duration-300"
                style={{
                  width: `${
                    (totals.outflow / (totals.inflow + totals.outflow)) * 100
                  }%`,
                }}
              />
            )}
          </div>
        </div>

        {/* Inflows Section */}
        {inflows.length > 0 && (
          <div className="mb-4">
            <SectionHeader
              title="Inflows"
              icon={ArrowUpCircle}
              count={inflows.length}
              total={totals.inflow}
              expanded={inflowsExpanded}
              onToggle={() => setInflowsExpanded(!inflowsExpanded)}
              colorClass="bg-green-50 text-green-600"
            />

            {inflowsExpanded && (
              <div className="mt-2 space-y-1">
                {inflows.slice(0, 5).map((movement) => (
                  <MovementItem key={movement.id} movement={movement} />
                ))}
                {inflows.length > 5 && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    +{inflows.length - 5} more inflows
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Outflows Section */}
        {outflows.length > 0 && (
          <div>
            <SectionHeader
              title="Outflows"
              icon={ArrowDownCircle}
              count={outflows.length}
              total={totals.outflow}
              expanded={outflowsExpanded}
              onToggle={() => setOutflowsExpanded(!outflowsExpanded)}
              colorClass="bg-red-50 text-red-600"
            />

            {outflowsExpanded && (
              <div className="mt-2 space-y-1">
                {outflows.slice(0, 8).map((movement) => (
                  <MovementItem key={movement.id} movement={movement} />
                ))}
                {outflows.length > 8 && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    +{outflows.length - 8} more outflows
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * RECURRING PAYMENTS CENTER
 * Phase 13 - Transactional Intelligence
 *
 * Features:
 * - All recurring payments list
 * - Next occurrence prediction
 * - Monthly cost summaries
 * - Price change alerts
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.5.3
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import {
  RefreshCw,
  Calendar,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Pause,
  Play,
  Clock,
  Building,
  ChevronRight,
  CheckCircle,
  Bell,
  CreditCard,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface RecurringPayment {
  id: string;
  merchantStandardised: string;
  pattern: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'IRREGULAR';
  expectedAmount: number;
  amountVariance: number;
  lastOccurrence: string;
  nextExpected: string;
  occurrenceCount: number;
  priceIncreaseAlert: boolean;
  isActive: boolean;
  isPaused: boolean;
  account: {
    id: string;
    name: string;
    institution: string;
  };
}

interface RecurringSummary {
  total: number;
  active: number;
  paused: number;
  monthlyTotal: number;
  priceAlerts: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPattern(pattern: string): string {
  const patterns: Record<string, string> = {
    WEEKLY: 'Weekly',
    FORTNIGHTLY: 'Fortnightly',
    MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly',
    ANNUALLY: 'Annually',
    IRREGULAR: 'Irregular',
  };
  return patterns[pattern] || pattern;
}

function getPatternColor(pattern: string): string {
  const colors: Record<string, string> = {
    WEEKLY: 'bg-blue-100 text-blue-800',
    FORTNIGHTLY: 'bg-purple-100 text-purple-800',
    MONTHLY: 'bg-green-100 text-green-800',
    QUARTERLY: 'bg-orange-100 text-orange-800',
    ANNUALLY: 'bg-red-100 text-red-800',
    IRREGULAR: 'bg-gray-100 text-gray-800',
  };
  return colors[pattern] || colors.IRREGULAR;
}

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDaysUntilText(dateStr: string | null): string {
  const days = getDaysUntil(dateStr);
  if (days === null) return 'Unknown';
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `${days} days`;
  if (days <= 30) return `${Math.ceil(days / 7)} weeks`;
  return `${Math.ceil(days / 30)} months`;
}

// =============================================================================
// SUB COMPONENTS
// =============================================================================

function SummaryCards({ summary }: { summary: RecurringSummary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Total Recurring</div>
        <div className="text-2xl font-bold">{summary.total}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Active</div>
        <div className="text-2xl font-bold text-green-600">{summary.active}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Paused</div>
        <div className="text-2xl font-bold text-gray-500">{summary.paused}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Monthly Total</div>
        <div className="text-2xl font-bold text-blue-600">
          {formatCurrency(summary.monthlyTotal)}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Price Alerts</div>
        <div className={`text-2xl font-bold ${summary.priceAlerts > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
          {summary.priceAlerts}
        </div>
      </div>
    </div>
  );
}

function RecurringPaymentCard({
  payment,
  onTogglePause,
}: {
  payment: RecurringPayment;
  onTogglePause: (id: string, isPaused: boolean) => void;
}) {
  const daysUntil = getDaysUntil(payment.nextExpected);
  const isUpcoming = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
  const isOverdue = daysUntil !== null && daysUntil < 0;

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 ${
        payment.isPaused ? 'opacity-60' : ''
      } ${payment.priceIncreaseAlert ? 'ring-2 ring-orange-400' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{payment.merchantStandardised}</h3>
            {payment.priceIncreaseAlert && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">
                <TrendingUp className="h-3 w-3" />
                Price Increase
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <Building className="h-4 w-4" />
            <span>{payment.account.name}</span>
          </div>
        </div>
        <button
          onClick={() => onTogglePause(payment.id, !payment.isPaused)}
          className={`p-2 rounded-full ${
            payment.isPaused
              ? 'bg-green-100 text-green-600 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={payment.isPaused ? 'Resume tracking' : 'Pause tracking'}
        >
          {payment.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Amount */}
        <div>
          <div className="text-xs text-gray-500 uppercase">Amount</div>
          <div className="font-bold text-lg">{formatCurrency(payment.expectedAmount)}</div>
          {payment.amountVariance > 0 && (
            <div className="text-xs text-gray-500">
              ± {formatCurrency(payment.amountVariance)}
            </div>
          )}
        </div>

        {/* Pattern */}
        <div>
          <div className="text-xs text-gray-500 uppercase">Frequency</div>
          <span
            className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${getPatternColor(
              payment.pattern
            )}`}
          >
            {formatPattern(payment.pattern)}
          </span>
        </div>

        {/* Next Due */}
        <div>
          <div className="text-xs text-gray-500 uppercase">Next Due</div>
          <div className={`font-medium ${isOverdue ? 'text-red-600' : isUpcoming ? 'text-orange-600' : ''}`}>
            {formatDate(payment.nextExpected)}
          </div>
          <div
            className={`text-xs ${
              isOverdue ? 'text-red-500' : isUpcoming ? 'text-orange-500' : 'text-gray-500'
            }`}
          >
            {getDaysUntilText(payment.nextExpected)}
          </div>
        </div>

        {/* History */}
        <div>
          <div className="text-xs text-gray-500 uppercase">Occurrences</div>
          <div className="font-medium">{payment.occurrenceCount} times</div>
          <div className="text-xs text-gray-500">
            Last: {formatDate(payment.lastOccurrence)}
          </div>
        </div>
      </div>

      {/* Status badges */}
      <div className="mt-4 flex items-center gap-2">
        {payment.isActive && !payment.isPaused && (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
            <CheckCircle className="h-3 w-3" />
            Active
          </span>
        )}
        {payment.isPaused && (
          <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
            <Pause className="h-3 w-3" />
            Paused
          </span>
        )}
        {isUpcoming && !payment.isPaused && (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
            <Bell className="h-3 w-3" />
            Upcoming
          </span>
        )}
        {isOverdue && !payment.isPaused && (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
            <AlertTriangle className="h-3 w-3" />
            Overdue
          </span>
        )}
      </div>
    </div>
  );
}

function UpcomingPayments({ payments }: { payments: RecurringPayment[] }) {
  const upcoming = payments
    .filter((p) => !p.isPaused && p.nextExpected)
    .sort((a, b) => new Date(a.nextExpected).getTime() - new Date(b.nextExpected).getTime())
    .slice(0, 5);

  if (upcoming.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-blue-500" />
        Upcoming Payments
      </h2>
      <div className="space-y-3">
        {upcoming.map((payment) => {
          const daysUntil = getDaysUntil(payment.nextExpected);
          return (
            <div
              key={payment.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    daysUntil !== null && daysUntil <= 3
                      ? 'bg-orange-500'
                      : 'bg-blue-500'
                  }`}
                />
                <div>
                  <div className="font-medium">{payment.merchantStandardised}</div>
                  <div className="text-sm text-gray-500">
                    {formatDate(payment.nextExpected)} - {getDaysUntilText(payment.nextExpected)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatCurrency(payment.expectedAmount)}</div>
                <div className="text-xs text-gray-500">{formatPattern(payment.pattern)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriceAlerts({ payments }: { payments: RecurringPayment[] }) {
  const alerts = payments.filter((p) => p.priceIncreaseAlert);

  if (alerts.length === 0) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-orange-800">
        <TrendingUp className="h-5 w-5" />
        Price Increase Alerts ({alerts.length})
      </h2>
      <div className="space-y-2">
        {alerts.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between p-3 bg-white rounded-lg"
          >
            <div>
              <div className="font-medium">{payment.merchantStandardised}</div>
              <div className="text-sm text-gray-500">
                {payment.occurrenceCount} payments tracked
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-orange-600">
                {formatCurrency(payment.expectedAmount)}
              </div>
              <div className="text-xs text-orange-600">
                Price has increased
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function RecurringPaymentsCenter() {
  const { token } = useAuth();
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [summary, setSummary] = useState<RecurringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [showActive, setShowActive] = useState(true);
  const [showPaused, setShowPaused] = useState(false);
  const [patternFilter, setPatternFilter] = useState('');

  const fetchPayments = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (showActive && !showPaused) params.append('active', 'true');
      if (!showActive && showPaused) params.append('active', 'false');

      const response = await fetch(`/api/unified-transactions/recurring?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();

      if (response.ok && json.success) {
        setPayments(json.data);
        setSummary(json.summary);
      } else {
        setError(json.error || 'Failed to load recurring payments');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [token, showActive, showPaused]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  async function handleDetectRecurring() {
    if (!token) return;

    try {
      setDetecting(true);
      const response = await fetch('/api/unified-transactions/recurring', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();

      if (response.ok && json.success) {
        alert(`Detection complete! Found ${json.data.newDetected} new recurring payments.`);
        fetchPayments();
      } else {
        alert(json.error || 'Detection failed');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setDetecting(false);
    }
  }

  async function handleTogglePause(id: string, isPaused: boolean) {
    // Note: Would need a PATCH endpoint for this
    // For now, update local state only
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isPaused } : p))
    );
  }

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    if (patternFilter && p.pattern !== patternFilter) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold">Recurring Payments</h1>
            <p className="text-gray-500 text-sm">
              Track and manage your subscriptions and regular payments
            </p>
          </div>
          <button
            onClick={handleDetectRecurring}
            disabled={detecting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {detecting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Detect Recurring
          </button>
        </div>

        {/* Summary Cards */}
        {summary && <SummaryCards summary={summary} />}

        {/* Price Alerts */}
        <PriceAlerts payments={payments} />

        {/* Upcoming Payments */}
        <UpcomingPayments payments={payments} />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showActive}
                  onChange={(e) => setShowActive(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPaused}
                  onChange={(e) => setShowPaused(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Paused</span>
              </label>
            </div>
            <div className="border-l pl-4">
              <select
                value={patternFilter}
                onChange={(e) => setPatternFilter(e.target.value)}
                className="border rounded-lg px-3 py-1 text-sm"
              >
                <option value="">All Frequencies</option>
                <option value="WEEKLY">Weekly</option>
                <option value="FORTNIGHTLY">Fortnightly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUALLY">Annually</option>
              </select>
            </div>
          </div>
        </div>

        {/* Payment List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Loading recurring payments...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-400" />
            <p className="text-red-600 mt-2">{error}</p>
            <button
              onClick={fetchPayments}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mt-4">
              No Recurring Payments Found
            </h3>
            <p className="text-gray-500 mt-2">
              Click &quot;Detect Recurring&quot; to scan your transactions for recurring patterns.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredPayments.map((payment) => (
              <RecurringPaymentCard
                key={payment.id}
                payment={payment}
                onTogglePause={handleTogglePause}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

/**
 * RECURRING PAYMENTS CENTER
 * Phase 13 + Phase 29 - Transactional Intelligence & Expense Linking
 *
 * Features:
 * - All recurring payments list with expense linking status
 * - Match suggestions for linking to existing expenses
 * - Create expense from recurring payment
 * - Next occurrence prediction
 * - Monthly cost summaries
 * - Price change alerts
 * - Untracked payments section
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md, PHASE_29_RECURRING_EXPENSE_LINKING.md
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import {
  MatchConfirmationDialog,
  CreateExpenseFromRecurring,
} from '@/components/recurring';
import type {
  RecurringPayment,
  LinkedExpense,
  MatchResult,
  RecurringSummary,
} from '@/types/recurring';
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
  CheckCircle,
  Bell,
  CreditCard,
  Link as LinkIcon,
  Link2Off,
  Plus,
  MoreVertical,
  Search,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Types imported from @/types/recurring

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

function getMatchStatusBadge(payment: RecurringPayment) {
  switch (payment.matchStatus) {
    case 'LINKED':
    case 'CREATED':
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Tracked
        </Badge>
      );
    case 'SUGGESTED':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <Search className="h-3 w-3" />
          Match Found
        </Badge>
      );
    case 'DISMISSED':
      return (
        <Badge variant="outline" className="text-gray-500 flex items-center gap-1">
          <Link2Off className="h-3 w-3" />
          Dismissed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-gray-500 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Not Tracked
        </Badge>
      );
  }
}

// =============================================================================
// SUB COMPONENTS
// =============================================================================

function SummaryCards({
  summary,
  untrackedCount,
}: {
  summary: RecurringSummary;
  untrackedCount: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Total Recurring</div>
        <div className="text-2xl font-bold">{summary.total}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Active</div>
        <div className="text-2xl font-bold text-green-600">{summary.active}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Tracked in Expenses</div>
        <div className="text-2xl font-bold text-blue-600">
          {summary.total - untrackedCount}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Not Tracked</div>
        <div className={`text-2xl font-bold ${untrackedCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
          {untrackedCount}
        </div>
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
  onViewMatch,
  onCreateExpense,
  onUnlink,
  onViewExpense,
}: {
  payment: RecurringPayment;
  onTogglePause: (id: string, isPaused: boolean) => void;
  onViewMatch: (payment: RecurringPayment) => void;
  onCreateExpense: (payment: RecurringPayment) => void;
  onUnlink: (payment: RecurringPayment) => void;
  onViewExpense: (expenseId: string) => void;
}) {
  const daysUntil = getDaysUntil(payment.nextExpected);
  const isUpcoming = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
  const isOverdue = daysUntil !== null && daysUntil < 0;
  const isLinked = payment.matchStatus === 'LINKED' || payment.matchStatus === 'CREATED';

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 ${
        payment.isPaused ? 'opacity-60' : ''
      } ${payment.priceIncreaseAlert ? 'ring-2 ring-orange-400' : ''} ${
        isLinked ? 'border-l-4 border-green-500' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-lg">{payment.merchantStandardised}</h3>
            {payment.priceIncreaseAlert && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">
                <TrendingUp className="h-3 w-3" />
                Price Increase
              </span>
            )}
            {getMatchStatusBadge(payment)}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <Building className="h-4 w-4" />
            <span>{payment.account.name}</span>
          </div>
          {isLinked && payment.linkedExpense && (
            <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
              <LinkIcon className="h-4 w-4" />
              <span>Linked to: {payment.linkedExpense.name}</span>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isLinked ? (
              <>
                <DropdownMenuItem onClick={() => onViewExpense(payment.linkedExpenseId!)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Expense
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUnlink(payment)}>
                  <Link2Off className="h-4 w-4 mr-2" />
                  Unlink Expense
                </DropdownMenuItem>
              </>
            ) : (
              <>
                {payment.matchStatus === 'SUGGESTED' && (
                  <DropdownMenuItem onClick={() => onViewMatch(payment)}>
                    <Search className="h-4 w-4 mr-2" />
                    Review Match
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onCreateExpense(payment)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create as Expense
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onTogglePause(payment.id, !payment.isPaused)}
            >
              {payment.isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Resume Tracking
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Tracking
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-gray-500 uppercase">Amount</div>
          <div className="font-bold text-lg">{formatCurrency(payment.expectedAmount)}</div>
          {payment.amountVariance > 0 && (
            <div className="text-xs text-gray-500">
              +/- {formatCurrency(payment.amountVariance)}
            </div>
          )}
        </div>

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

        <div>
          <div className="text-xs text-gray-500 uppercase">Occurrences</div>
          <div className="font-medium">{payment.occurrenceCount} times</div>
          <div className="text-xs text-gray-500">
            Last: {formatDate(payment.lastOccurrence)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
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

function UntrackedPaymentsSection({
  payments,
  onReviewMatch,
  onCreateExpense,
}: {
  payments: RecurringPayment[];
  onReviewMatch: (payment: RecurringPayment) => void;
  onCreateExpense: (payment: RecurringPayment) => void;
}) {
  const untracked = payments.filter(
    (p) => p.matchStatus === 'UNMATCHED' || p.matchStatus === 'SUGGESTED'
  );

  if (untracked.length === 0) return null;

  const monthlyTotal = untracked.reduce((sum, p) => {
    switch (p.pattern) {
      case 'WEEKLY':
        return sum + p.expectedAmount * 4.33;
      case 'FORTNIGHTLY':
        return sum + p.expectedAmount * 2.17;
      case 'MONTHLY':
        return sum + p.expectedAmount;
      case 'QUARTERLY':
        return sum + p.expectedAmount / 3;
      case 'ANNUALLY':
        return sum + p.expectedAmount / 12;
      default:
        return sum + p.expectedAmount;
    }
  }, 0);

  const suggested = untracked.filter((p) => p.matchStatus === 'SUGGESTED');

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            Untracked Recurring Payments ({untracked.length})
          </h2>
          <p className="text-sm text-orange-700 mt-1">
            These detected payments are not tracked in your expenses. Add them for accurate budget calculations.
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-orange-600">Untracked Monthly</div>
          <div className="text-xl font-bold text-orange-800">{formatCurrency(monthlyTotal)}</div>
        </div>
      </div>

      {suggested.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2 text-yellow-800 font-medium">
            <Search className="h-4 w-4" />
            {suggested.length} potential {suggested.length === 1 ? 'match' : 'matches'} found
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            We found existing expenses that might match these payments. Review and confirm to link them.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {untracked.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between p-3 bg-white rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div>
                <div className="font-medium">{payment.merchantStandardised}</div>
                <div className="text-sm text-gray-500">
                  {formatCurrency(payment.expectedAmount)} {formatPattern(payment.pattern).toLowerCase()}
                </div>
              </div>
              {payment.matchStatus === 'SUGGESTED' && (
                <Badge className="bg-yellow-100 text-yellow-800">
                  Match Found
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {payment.matchStatus === 'SUGGESTED' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReviewMatch(payment)}
                >
                  <Search className="h-4 w-4 mr-1" />
                  Review
                </Button>
              ) : null}
              <Button
                size="sm"
                onClick={() => onCreateExpense(payment)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add to Expenses
              </Button>
            </div>
          </div>
        ))}
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
          const isLinked = payment.matchStatus === 'LINKED' || payment.matchStatus === 'CREATED';
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
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{payment.merchantStandardised}</span>
                    {isLinked && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
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
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [summary, setSummary] = useState<RecurringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<RecurringPayment | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);

  // Filters
  const [showActive, setShowActive] = useState(true);
  const [showPaused, setShowPaused] = useState(false);
  const [patternFilter, setPatternFilter] = useState('');
  const [trackingFilter, setTrackingFilter] = useState('');

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
        setError(typeof json.error === 'string' ? json.error : json.error?.message || 'Failed to load recurring payments');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [token, showActive, showPaused]);

  const fetchMatchSuggestions = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/recurring-payments/match', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();

      if (response.ok && json.success) {
        setMatchResults(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch match suggestions:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchPayments();
    fetchMatchSuggestions();
  }, [fetchPayments, fetchMatchSuggestions]);

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
        fetchMatchSuggestions();
      } else {
        alert(json.error || 'Detection failed');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setDetecting(false);
    }
  }

  async function handleRunMatching() {
    if (!token) return;

    try {
      setMatching(true);
      const response = await fetch('/api/recurring-payments/match', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();

      if (response.ok && json.success) {
        alert(`Matching complete! Found ${json.data.suggestionsFound} potential matches.`);
        fetchPayments();
        fetchMatchSuggestions();
      } else {
        alert(json.error || 'Matching failed');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setMatching(false);
    }
  }

  async function handleTogglePause(id: string, isPaused: boolean) {
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isPaused } : p))
    );
  }

  async function handleConfirmMatch(paymentId: string, expenseId: string) {
    if (!token) return;

    const response = await fetch(`/api/recurring-payments/${paymentId}/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ expenseId }),
    });

    if (response.ok) {
      fetchPayments();
      fetchMatchSuggestions();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to link');
    }
  }

  async function handleDismissMatch(paymentId: string) {
    if (!token) return;

    const response = await fetch(`/api/recurring-payments/${paymentId}/link`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      fetchPayments();
      fetchMatchSuggestions();
    }
  }

  async function handleUnlink(payment: RecurringPayment) {
    if (!token) return;

    if (!confirm('Are you sure you want to unlink this recurring payment from the expense?')) {
      return;
    }

    const response = await fetch(`/api/recurring-payments/${payment.id}/link`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      fetchPayments();
      fetchMatchSuggestions();
    }
  }

  function handleViewMatch(payment: RecurringPayment) {
    const match = matchResults.find((m) => m.recurringPaymentId === payment.id);
    if (match) {
      setSelectedPayment(payment);
      setSelectedMatch(match);
      setMatchDialogOpen(true);
    }
  }

  function handleCreateExpense(payment: RecurringPayment) {
    setSelectedPayment(payment);
    setCreateDialogOpen(true);
  }

  function handleViewExpense(expenseId: string) {
    window.location.href = `/dashboard/expenses?highlight=${expenseId}`;
  }

  // Calculate untracked count
  const untrackedCount = payments.filter(
    (p) => p.matchStatus === 'UNMATCHED' || p.matchStatus === 'SUGGESTED'
  ).length;

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    if (patternFilter && p.pattern !== patternFilter) return false;
    if (trackingFilter === 'tracked' && p.matchStatus !== 'LINKED' && p.matchStatus !== 'CREATED') return false;
    if (trackingFilter === 'untracked' && (p.matchStatus === 'LINKED' || p.matchStatus === 'CREATED')) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Recurring Payments</h1>
            <p className="text-gray-500 text-sm">
              Track and manage your subscriptions and regular payments
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRunMatching}
              disabled={matching}
            >
              {matching ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Find Matches
            </Button>
            <Button
              onClick={handleDetectRecurring}
              disabled={detecting}
            >
              {detecting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Detect Recurring
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && <SummaryCards summary={summary} untrackedCount={untrackedCount} />}

        {/* Untracked Payments Section */}
        <UntrackedPaymentsSection
          payments={payments}
          onReviewMatch={handleViewMatch}
          onCreateExpense={handleCreateExpense}
        />

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
            <div className="border-l pl-4">
              <select
                value={trackingFilter}
                onChange={(e) => setTrackingFilter(e.target.value)}
                className="border rounded-lg px-3 py-1 text-sm"
              >
                <option value="">All Status</option>
                <option value="tracked">Tracked in Expenses</option>
                <option value="untracked">Not Tracked</option>
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
            <Button
              onClick={fetchPayments}
              className="mt-4"
            >
              Retry
            </Button>
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
                onViewMatch={handleViewMatch}
                onCreateExpense={handleCreateExpense}
                onUnlink={handleUnlink}
                onViewExpense={handleViewExpense}
              />
            ))}
          </div>
        )}

        {/* Match Confirmation Dialog */}
        {selectedPayment && selectedMatch && (
          <MatchConfirmationDialog
            open={matchDialogOpen}
            onOpenChange={setMatchDialogOpen}
            recurringPayment={selectedPayment}
            suggestedExpense={selectedMatch.suggestedExpense}
            confidence={selectedMatch.confidence}
            amountMatch={selectedMatch.amountMatch}
            frequencyMatch={selectedMatch.frequencyMatch}
            amountDifference={selectedMatch.amountDifference}
            matchReason={selectedMatch.matchReason}
            onConfirm={handleConfirmMatch}
            onDismiss={handleDismissMatch}
            onCreateNew={handleCreateExpense}
          />
        )}

        {/* Create Expense Dialog */}
        <CreateExpenseFromRecurring
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          recurringPayment={selectedPayment}
          token={token || ''}
          onSuccess={() => {
            fetchPayments();
            fetchMatchSuggestions();
          }}
        />
      </div>
    </DashboardLayout>
  );
}

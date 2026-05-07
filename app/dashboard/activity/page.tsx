'use client';

/**
 * MY ACCOUNTS → ACTIVITY
 * Phase 36 v2: full legacy /transactions functionality, Apple-style visuals.
 *
 * Functionality preserved verbatim from app/(dashboard)/transactions/page.tsx:
 *   - Server-side pagination (25/page) via /api/unified-transactions
 *   - Server-side filters: search, account, category, date range, recurring,
 *     anomalies, uncategorised, direction, excludeTransfers
 *   - 4 click-to-filter summary tiles (Spend / Income / Net / Count) — the
 *     learned interaction is preserved exactly: clicking a tile toggles the
 *     active tile-filter back to the default ("uncategorised")
 *   - "Uncategorised first" default — pushes users into the categorisation loop
 *   - Click row → TransactionLinkDialog (the categorise/link-to-Income/Expense/Loan workflow)
 *   - Import wizard (CSV / QIF / OFX)
 *   - "Navigate to next uncategorised" workflow inside the dialog (uses ref to
 *     avoid stale-closure on the just-refreshed list)
 *
 * Visual changes only:
 *   - Hero copy: "Activity" + warm subtitle
 *   - Apple-style 2xl rounded cards, soft accent colors, tabular-nums
 *   - Filter chip strip (Recurring / Anomalies / Advanced)
 *   - Slide-down advanced filters panel (account, category, date range)
 *   - Day-grouped transaction list with subtle rise-stagger animation
 *   - Confidence badge ONLY shown when score < 0.9 (less visual noise)
 *
 * Relationships: every transaction's incomeId / expenseId / loanId / propertyId
 * / accountId is unchanged on the wire — this page only re-skins the UI.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Search,
  Filter,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Repeat,
  Upload,
  Link2,
  X,
  Sparkles,
} from 'lucide-react';
import { ImportWizard } from '@/components/bank/ImportWizard';
import { TransactionLinkDialog } from '@/components/transactions/TransactionLinkDialog';
import { MonthlyReviewPill } from '@/components/bookkeeping/MonthlyReviewPill';
import { BulkActionToolbar } from '@/components/bookkeeping/BulkActionToolbar';
import { CompletionCelebration } from '@/components/bookkeeping/CompletionCelebration';
import { CategoryPickerSheet } from '@/components/bookkeeping/CategoryPickerSheet';
import { ConsumerMoneyFlowSankey } from '@/components/bookkeeping/ConsumerMoneyFlowSankey';
import { useSwipeGesture, SWIPE_THRESHOLD_PX } from '@/hooks/useSwipeGesture';
import { CashQuickAddButton } from '@/components/bookkeeping/CashQuickAddButton';
import { formatCurrency } from '@/lib/utils/formatters';

// ---------------------------------------------------------------------------
// Types — mirror the API response shape from /api/unified-transactions
// ---------------------------------------------------------------------------

interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  direction: 'IN' | 'OUT';
  merchantRaw: string | null;
  merchantStandardised: string | null;
  description: string;
  categoryLevel1: string | null;
  categoryLevel2: string | null;
  tags: string[];
  confidenceScore: number | null;
  isRecurring: boolean;
  isTransfer: boolean;
  anomalyFlags: string[];
  incomeId?: string | null;
  expenseId?: string | null;
  account: {
    id: string;
    name: string;
    institution: string;
  };
}

interface AnalyticsSummary {
  totalSpend: number;
  totalIncome: number;
  netCashflow: number;
  transactionCount: number;
  topCategories: { category: string; amount: number; count: number }[];
}

interface ImportAccount {
  id: string;
  name: string;
  type: string;
}

type TileFilter = 'uncategorized' | 'spend' | 'income' | 'all' | null;

// ---------------------------------------------------------------------------
// Constants — preserved verbatim from legacy page
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: Array<{ level1: string }> = [
  { level1: 'HOUSING' },
  { level1: 'TRANSPORT' },
  { level1: 'FOOD' },
  { level1: 'UTILITIES' },
  { level1: 'HEALTH' },
  { level1: 'ENTERTAINMENT' },
  { level1: 'SHOPPING' },
  { level1: 'FINANCIAL' },
  { level1: 'PERSONAL' },
  { level1: 'INCOME' },
  { level1: 'TRANSFER' },
  { level1: 'UNCATEGORISED' },
];

// Soft Apple-leaning category colours (was: garish 100/800 pairs)
function getCategoryTone(category: string | null): string {
  const map: Record<string, string> = {
    HOUSING: 'bg-blue-50 text-blue-700 border-blue-100',
    TRANSPORT: 'bg-violet-50 text-violet-700 border-violet-100',
    FOOD: 'bg-orange-50 text-orange-700 border-orange-100',
    UTILITIES: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    HEALTH: 'bg-rose-50 text-rose-700 border-rose-100',
    ENTERTAINMENT: 'bg-pink-50 text-pink-700 border-pink-100',
    SHOPPING: 'bg-amber-50 text-amber-700 border-amber-100',
    FINANCIAL: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    PERSONAL: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    INCOME: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    TRANSFER: 'bg-slate-50 text-slate-600 border-slate-100',
    UNCATEGORISED: 'bg-slate-50 text-slate-500 border-slate-100',
  };
  return map[category || 'UNCATEGORISED'] || map.UNCATEGORISED;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByDay(txns: Transaction[]): Array<{ label: string; key: string; items: Transaction[]; net: number }> {
  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    const key = t.date.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const sortedKeys = Array.from(groups.keys()).sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  return sortedKeys.map((key) => {
    const items = groups.get(key)!;
    const net = items.reduce((s, t) => s + (t.direction === 'IN' ? t.amount : -t.amount), 0);
    let label: string;
    if (key === today) label = 'Today';
    else if (key === yesterday) label = 'Yesterday';
    else {
      const d = new Date(key);
      label = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    return { label, key, items, net };
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ActivityPage() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const transactionsRef = useRef<Transaction[]>([]);
  transactionsRef.current = transactions;

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import wizard state
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [accounts, setAccounts] = useState<ImportAccount[]>([]);

  // Filters — preserved 1:1 from legacy
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Default = "uncategorized" — pushes users into the cleanup loop
  const [tileFilter, setTileFilter] = useState<TileFilter>('uncategorized');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Link dialog
  const [linkingTransaction, setLinkingTransaction] = useState<Transaction | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Phase 42 PR2 — bulk multi-select. Set-of-ids; tracks every row the
  // user has ticked across pages (preserved when navigating). Cleared
  // after a successful bulk-categorise call.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Phase 42 PR6 — bumped to fire the completion celebration. The
  // celebration component itself gates against once-per-day max via
  // a server-side check. Bump = a key change that re-runs the
  // child's useEffect.
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);

  // Phase 42 PR6.5 — swipe-to-categorise. Sheet state lives at the
  // page level so a single sheet renders for whichever row was
  // swiped. Mobile-first; desktop users still get the existing
  // tap → dialog flow (the swipe is a per-pointer-event capture
  // that doesn't disturb the click).
  const [pickerTx, setPickerTx] = useState<Transaction | null>(null);
  const [advancedView, setAdvancedView] = useState(false);

  // Apply "always categorise X as Y" on a double-tap when the row
  // already has a category set. Writes a USER-source MerchantMapping
  // via the standard PATCH path (which lazy-seeds the registry per
  // PR2's SSOT bridge).
  const applyAlwaysRule = useCallback(async (tx: Transaction) => {
    if (!tx.categoryLevel1) return;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      // Re-PATCH the same category — the existing endpoint upserts a
      // `MerchantMapping` row on every category write (Phase 13
      // learning surface). User-confidence override = 1.0 means this
      // becomes the always-rule for the merchant.
      await fetch(`/api/unified-transactions/${tx.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          categoryLevel1: tx.categoryLevel1,
          categoryLevel2: tx.categoryLevel2,
        }),
      });
    } catch {
      // Quiet failure — rule-write is best-effort
    }
  }, []);

  // Mark as transfer (right-swipe) — sets isRecurring=false, links
  // nothing, sets categoryLevel1='Transfer'. Single PATCH call;
  // SSOT-aware (registry seeds via the categoriser bridge).
  const markAsTransfer = useCallback(async (tx: Transaction) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      await fetch(`/api/unified-transactions/${tx.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          categoryLevel1: 'Transfer',
          categoryLevel2: 'Internal',
        }),
      });
      fetchTransactions();
      fetchSummary();
    } catch {
      // Quiet failure — UI re-fetches anyway
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ----- Data fetching -----------------------------------------------------

  const fetchTransactions = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ page: page.toString(), limit: '25' });

      if (search) params.append('search', search);
      if (accountFilter) params.append('accountId', accountFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      if (showRecurringOnly) params.append('recurring', 'true');
      if (showAnomaliesOnly) params.append('hasAnomalies', 'true');

      if (tileFilter === 'uncategorized') {
        params.append('uncategorized', 'true');
      } else if (tileFilter === 'spend') {
        params.append('direction', 'OUT');
        params.append('excludeTransfers', 'true');
      } else if (tileFilter === 'income') {
        params.append('direction', 'IN');
        params.append('excludeTransfers', 'true');
      }

      const response = await fetch(`/api/unified-transactions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();

      if (response.ok && json.success) {
        setTransactions(json.data);
        transactionsRef.current = json.data;
        setTotalPages(json.pagination.totalPages);
      } else {
        setError(json.error || 'Failed to load transactions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [token, page, search, accountFilter, categoryFilter, dateRange, showRecurringOnly, showAnomaliesOnly, tileFilter]);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/unified-transactions/analytics?months=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (response.ok && json.success) {
        setSummary(json.data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, [token]);

  const fetchAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (response.ok && json.data) {
        const mapped: ImportAccount[] = (json.data || []).map((acc: { id: string; name: string; type?: string; institution?: string }) => ({
          id: acc.id,
          name: acc.name,
          type: acc.type || acc.institution || 'Bank',
        }));
        setAccounts(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
    fetchAccounts();
  }, [fetchTransactions, fetchSummary, fetchAccounts]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  }

  function clearAdvanced() {
    setCategoryFilter('');
    setDateRange({ start: '', end: '' });
    setShowRecurringOnly(false);
    setShowAnomaliesOnly(false);
    setAccountFilter('');
    setPage(1);
  }

  const advancedActiveCount =
    (categoryFilter ? 1 : 0) +
    (dateRange.start ? 1 : 0) +
    (dateRange.end ? 1 : 0) +
    (showRecurringOnly ? 1 : 0) +
    (showAnomaliesOnly ? 1 : 0) +
    (accountFilter ? 1 : 0);

  const groups = groupByDay(transactions);

  // ----- Render ------------------------------------------------------------

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 anim-fade-in">
        {/* HERO */}
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">My Accounts · Activity</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-1">
              What&apos;s moving
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Search, filter, and categorise your transactions.
            </p>
            {/* Phase 42 PR1 — Monthly Review pill (foundational hook for the
                full Daily Pulse + streak surface that ships in PR6). */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <MonthlyReviewPill />
              {/* Phase 42 PR6.5 — Advanced view toggle. Default-hide
                  confidence + anomaly chrome (calmer first-run); power
                  users opt in via this pill. State persists per session. */}
              <button
                type="button"
                onClick={() => setAdvancedView((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  advancedView
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                aria-pressed={advancedView}
              >
                Advanced view
              </button>
            </div>
          </div>
          <Button
            onClick={() => setShowImportWizard(true)}
            variant="outline"
            className="shrink-0"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Import
          </Button>
        </header>

        {/* Phase 42 PR6.5 — Consumer money-flow Sankey. The "where your
            money goes" aha moment. Reuses Phase 41g <MoneyFlowSankey /> by
            projecting MasterFinancialSnapshot through a synthetic single-
            entity flow. Self-hides when there's not enough data. */}
        <div className="mb-6">
          <ConsumerMoneyFlowSankey />
        </div>

        {/* SUMMARY TILES — clickable to filter */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 anim-rise-stagger">
            <SummaryTile
              label="Spending"
              value={-summary.totalSpend}
              tone="rose"
              icon={ArrowUp}
              active={tileFilter === 'spend'}
              onClick={() => {
                setTileFilter(tileFilter === 'spend' ? 'uncategorized' : 'spend');
                setPage(1);
              }}
            />
            <SummaryTile
              label="Income"
              value={summary.totalIncome}
              tone="emerald"
              icon={ArrowDown}
              active={tileFilter === 'income'}
              onClick={() => {
                setTileFilter(tileFilter === 'income' ? 'uncategorized' : 'income');
                setPage(1);
              }}
            />
            <SummaryTile
              label="Net cashflow"
              value={summary.netCashflow}
              tone={summary.netCashflow >= 0 ? 'emerald' : 'rose'}
              icon={Sparkles}
              emphasis
            />
            <SummaryTile
              label="Transactions"
              value={summary.transactionCount}
              tone="sky"
              icon={Filter}
              isCount
              active={tileFilter === 'all'}
              onClick={() => {
                setTileFilter(tileFilter === 'all' ? 'uncategorized' : 'all');
                setPage(1);
              }}
            />
          </div>
        )}

        {/* "Uncategorised first" pill — calmer than the legacy amber alert */}
        {tileFilter === 'uncategorized' && (
          <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-sm text-amber-900 anim-fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-medium">Showing uncategorised first</span>
            <button
              onClick={() => { setTileFilter('all'); setPage(1); }}
              className="text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              Show all
            </button>
          </div>
        )}

        {/* SEARCH + FILTER CHIPS */}
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant, description, or category"
              className="w-full pl-9 pr-3 py-2 rounded-full border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
          </form>

          <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 sm:pb-0">
            <ChipToggle
              active={showRecurringOnly}
              onClick={() => { setShowRecurringOnly(!showRecurringOnly); setPage(1); }}
              icon={Repeat}
              label="Recurring"
              tone="sky"
            />
            <ChipToggle
              active={showAnomaliesOnly}
              onClick={() => { setShowAnomaliesOnly(!showAnomaliesOnly); setPage(1); }}
              icon={AlertTriangle}
              label="Anomalies"
              tone="amber"
            />
            <ChipToggle
              active={showFilters}
              onClick={() => setShowFilters(!showFilters)}
              icon={Filter}
              label={advancedActiveCount > 0 ? `Advanced · ${advancedActiveCount}` : 'Advanced'}
              tone="slate"
            />
          </div>
        </div>

        {/* ADVANCED FILTERS PANEL */}
        {showFilters && (
          <div className="mb-5 p-4 rounded-2xl border border-border bg-card anim-rise">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <FilterField label="Account">
                <select
                  value={accountFilter}
                  onChange={(e) => { setAccountFilter(e.target.value); setPage(1); }}
                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">All accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Category">
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">All categories</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.level1} value={c.level1}>{c.level1}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Start date">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => { setDateRange((p) => ({ ...p, start: e.target.value })); setPage(1); }}
                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </FilterField>

              <FilterField label="End date">
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => { setDateRange((p) => ({ ...p, end: e.target.value })); setPage(1); }}
                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </FilterField>
            </div>

            {advancedActiveCount > 0 && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearAdvanced}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* CONTENT */}
        {loading ? (
          <LoadingList />
        ) : error ? (
          <ErrorState error={error} onRetry={fetchTransactions} />
        ) : transactions.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="space-y-6 anim-rise">
              {groups.map((g) => (
                <section key={g.key}>
                  <div className="flex items-baseline justify-between px-1 mb-2">
                    <h3 className="text-sm font-semibold text-foreground">{g.label}</h3>
                    <span className={`text-xs tabular-nums ${g.net < 0 ? 'text-rose-600' : g.net > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {g.net >= 0 ? '+' : ''}{formatCurrency(g.net)}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    {g.items.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        selected={selectedIds.has(tx.id)}
                        onToggleSelected={() => toggleSelected(tx.id)}
                        advancedView={advancedView}
                        onClick={() => {
                          setLinkingTransaction(tx);
                          setShowLinkDialog(true);
                        }}
                        onSwipeLeft={() => setPickerTx(tx)}
                        onSwipeRight={() => markAsTransfer(tx)}
                        onLongPress={() => {
                          setLinkingTransaction(tx);
                          setShowLinkDialog(true);
                        }}
                        onDoubleTap={() => applyAlwaysRule(tx)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* PAGINATION */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-full border border-border bg-card disabled:opacity-40 hover-lift"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-xs text-muted-foreground tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-full border border-border bg-card disabled:opacity-40 hover-lift"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Phase 42 PR3 — cash quick-add FAB (3-second sole-trader path) */}
      <CashQuickAddButton
        onCreated={() => {
          fetchTransactions();
          fetchSummary();
        }}
      />

      {/* Phase 42 PR2 — Bulk action toolbar (shows when ≥1 selected) */}
      <BulkActionToolbar
        selectedIds={selectedIds}
        onClear={() => setSelectedIds(new Set())}
        onCategorised={async (count) => {
          setSelectedIds(new Set());
          await fetchTransactions();
          fetchSummary();
          // Phase 42 PR6 — fire the completion celebration. The
          // CompletionCelebration component does the once-per-day-max
          // gate server-side; we just bump the trigger and it
          // decides whether to confetti, toast, or both.
          setCelebrationTrigger((t) => t + 1);
          console.info(`[bulk-categorise] ${count} updated`);
        }}
      />

      {/* Phase 42 PR6 — Completion celebration (toast + confetti).
          Self-gated to once-per-day max via the server. Self-dismissing. */}
      <CompletionCelebration trigger={celebrationTrigger} />

      {/* Phase 42 PR6.5 — Category picker bottom-sheet (opens on
          left-swipe of any row). Mobile-first; backdrop dismisses. */}
      <CategoryPickerSheet
        open={pickerTx !== null}
        transactionId={pickerTx?.id ?? null}
        context={
          pickerTx
            ? {
                merchant:
                  pickerTx.description ||
                  pickerTx.merchantStandardised ||
                  pickerTx.merchantRaw ||
                  null,
                amount: pickerTx.amount,
              }
            : null
        }
        onClose={() => setPickerTx(null)}
        onSuccess={() => {
          setPickerTx(null);
          fetchTransactions();
          fetchSummary();
        }}
      />

      {/* IMPORT WIZARD MODAL */}
      {showImportWizard && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 anim-fade-in"
            onClick={() => setShowImportWizard(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto anim-rise">
              <ImportWizard
                accounts={accounts}
                onComplete={() => {
                  setShowImportWizard(false);
                  fetchTransactions();
                  fetchSummary();
                  fetchAccounts();
                }}
                onClose={() => setShowImportWizard(false)}
                onAccountCreated={(newAccount) => {
                  setAccounts((prev) => [...prev, newAccount]);
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* TRANSACTION LINK DIALOG — categorisation workflow preserved verbatim */}
      <TransactionLinkDialog
        transaction={linkingTransaction}
        open={showLinkDialog}
        onOpenChange={(open) => {
          setShowLinkDialog(open);
          if (!open) setLinkingTransaction(null);
        }}
        onLinked={async () => {
          await fetchTransactions();
          fetchSummary();
        }}
        hasMoreTransactions={transactions.length > 1}
        onNavigateNext={() => {
          const current = transactionsRef.current;
          if (current.length > 0) {
            setLinkingTransaction(current[0]);
          } else {
            setShowLinkDialog(false);
            setLinkingTransaction(null);
          }
        }}
      />
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Summary tile
// ---------------------------------------------------------------------------

function SummaryTile({
  label,
  value,
  tone,
  icon: Icon,
  active,
  emphasis,
  isCount,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'rose' | 'sky' | 'amber';
  icon: typeof ArrowDown;
  active?: boolean;
  emphasis?: boolean;
  isCount?: boolean;
  onClick?: () => void;
}) {
  const toneBg =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
    tone === 'rose' ? 'bg-rose-50 text-rose-600' :
    tone === 'sky' ? 'bg-sky-50 text-sky-600' :
    'bg-amber-50 text-amber-600';

  const ringClass = active
    ? 'ring-2 ring-primary/30 border-primary/30'
    : emphasis
      ? 'ring-1 ring-primary/10'
      : '';

  const Wrapper: 'button' | 'div' = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`text-left rounded-2xl border border-border bg-card p-4 hover-lift transition ${ringClass} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg ${toneBg}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${value < 0 ? 'text-rose-600' : 'text-foreground'}`}>
        {isCount ? value.toLocaleString('en-AU') : formatCurrency(value)}
      </div>
      {active && (
        <div className="text-[11px] text-primary mt-0.5 font-medium">Filtering</div>
      )}
    </Wrapper>
  );
}

// ---------------------------------------------------------------------------
// Filter chip toggle
// ---------------------------------------------------------------------------

function ChipToggle({
  active,
  onClick,
  icon: Icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Filter;
  label: string;
  tone: 'sky' | 'amber' | 'slate';
}) {
  const activeTone =
    tone === 'sky' ? 'bg-sky-600 text-white border-sky-600' :
    tone === 'amber' ? 'bg-amber-600 text-white border-amber-600' :
    'bg-foreground text-background border-foreground';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-all duration-200 ${
        active
          ? `${activeTone} shadow-sm`
          : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction row — clicking opens TransactionLinkDialog
// ---------------------------------------------------------------------------

function TransactionRow({
  tx,
  onClick,
  selected,
  onToggleSelected,
  advancedView = false,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  onDoubleTap,
}: {
  tx: Transaction;
  onClick: () => void;
  selected: boolean;
  onToggleSelected: () => void;
  advancedView?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
}) {
  const isIn = tx.direction === 'IN';
  const isLinked = !!(tx.incomeId || tx.expenseId);
  const isTransfer = tx.isTransfer;
  const hasAnomaly = tx.anomalyFlags.length > 0;
  const label = tx.description || tx.merchantStandardised || tx.merchantRaw || 'Transaction';

  // Confidence: only show when AI is uncertain (< 0.9) AND the user
  // has opted in to Advanced view. Default-hidden per Phase 42 PR6.5
  // spec §6 — calmer first-run; power users opt in.
  const showConfidence =
    advancedView && tx.confidenceScore !== null && tx.confidenceScore < 0.9;
  const confidenceLabel =
    tx.confidenceScore !== null && tx.confidenceScore < 0.7 ? 'Low confidence' : 'Medium confidence';
  const confidenceTone =
    tx.confidenceScore !== null && tx.confidenceScore < 0.7 ? 'text-rose-600' : 'text-amber-600';
  // Anomaly badge: also gated behind Advanced view per the same rule.
  const showAnomalyBadge = advancedView && hasAnomaly;

  // Phase 42 PR6.5 — swipe-to-categorise. Pointer-events-based; no
  // library dep. The hook captures pointer events on the inner button
  // (which already fires onClick for plain taps via the browser's
  // native click-fires-after-pointerup behaviour). When a swipe past
  // SWIPE_THRESHOLD_PX fires, the corresponding handler runs and the
  // row springs back to centre.
  const swipe = useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
    onLongPress,
    onDoubleTap,
  });

  // Visual offset during drag — small parallax so the user sees the
  // gesture register. Capped at 80px past the threshold to avoid
  // throwing the row off-screen on long drags.
  const dragOffset = Math.max(-80, Math.min(80, swipe.state.dragX));
  const showLeftHint = swipe.state.direction === 'left' && Math.abs(swipe.state.dragX) > SWIPE_THRESHOLD_PX / 2;
  const showRightHint = swipe.state.direction === 'right' && Math.abs(swipe.state.dragX) > SWIPE_THRESHOLD_PX / 2;

  // Phase 42 PR2 — Selection checkbox is rendered as a sibling element
  // (not inside the row's main click target) with stopPropagation, so
  // tapping the checkbox doesn't open the link dialog. Visible at all
  // times; emerald accent when ticked. Mobile-friendly tap target.
  return (
    <div
      className={`relative w-full flex items-center border-b border-border last:border-0 group transition-colors overflow-hidden ${
        selected ? 'bg-emerald-50/40' : 'hover:bg-muted/40'
      }`}
    >
      {/* Phase 42 PR6.5 — swipe action hints. Slide in behind the row
          as the user drags; emerald (right = transfer) / sky (left =
          categorise). Hidden when not dragging. */}
      {showLeftHint && (
        <span
          aria-hidden
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-sky-700 pointer-events-none"
        >
          Categorise →
        </span>
      )}
      {showRightHint && (
        <span
          aria-hidden
          className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-700 pointer-events-none"
        >
          ← Transfer
        </span>
      )}

      <label
        className="flex items-center justify-center w-10 sm:w-11 self-stretch shrink-0 cursor-pointer hover:bg-muted/60 transition-colors"
        onClick={(e) => e.stopPropagation()}
        title={selected ? 'Unselect' : 'Select for bulk action'}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/40 cursor-pointer"
          aria-label={`Select ${label}`}
        />
      </label>
      <button
        type="button"
        onClick={onClick}
        {...swipe.bind}
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: swipe.state.isDragging ? 'none' : 'transform 220ms ease-out',
          touchAction: 'pan-y', // allow vertical scroll; we own horizontal
        }}
        className="flex-1 text-left flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 hover-lift bg-card"
      >
      {/* Direction icon */}
      <div
        className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${
          isTransfer ? 'bg-slate-50 text-slate-500' : isIn ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
        }`}
      >
        {isTransfer ? <ArrowLeftRight className="w-4 h-4" /> : isIn ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">{label}</span>
          {isLinked && <Link2 className="w-3 h-3 text-sky-600 shrink-0" aria-label="Linked" />}
          {tx.isRecurring && !isLinked && <Repeat className="w-3 h-3 text-sky-600 shrink-0" aria-label="Recurring" />}
          {showAnomalyBadge && <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" aria-label={tx.anomalyFlags.join(', ')} />}
        </div>
        <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
          <span>{tx.account.name}</span>
          {showConfidence && (
            <>
              <span>·</span>
              <span className={confidenceTone}>{confidenceLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Category pill (desktop only) */}
      <span
        className={`hidden md:inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${getCategoryTone(
          tx.categoryLevel1,
        )}`}
      >
        {tx.categoryLevel1 || 'Uncategorised'}
      </span>

      {/* Amount */}
      <div className="text-right shrink-0">
        <div className={`font-semibold tabular-nums text-sm ${isIn ? 'text-emerald-600' : 'text-foreground'}`}>
          {isIn ? '+' : '-'}{formatCurrency(tx.amount, { currency: tx.currency })}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors shrink-0" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading + error + empty
// ---------------------------------------------------------------------------

function LoadingList() {
  return (
    <div className="space-y-6">
      {[1, 2].map((g) => (
        <div key={g}>
          <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
          <div className="rounded-2xl border border-border bg-card">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                <div className="w-9 h-9 rounded-xl bg-muted animate-pulse" />
                <div className="flex-1">
                  <div className="h-3 w-44 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-2.5 w-28 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-10 text-center anim-rise">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-rose-900">Something went wrong</h3>
      <p className="text-sm text-rose-700 mt-1">{error}</p>
      <Button onClick={onRetry} variant="outline" className="mt-4">
        <RefreshCw className="w-4 h-4 mr-1.5" /> Retry
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 sm:p-14 text-center anim-rise">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 mb-4">
        <Sparkles className="w-7 h-7" />
      </div>
      <h3 className="text-xl font-semibold tracking-tight">No transactions match</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Try clearing a filter, or import transactions from a CSV / OFX / QIF file.
      </p>
    </div>
  );
}

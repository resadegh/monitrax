'use client';

/**
 * MY ACCOUNTS → ACTIVITY
 * Phase 49 (2026-06-11): full redesign to the Phase 39 glass vocabulary +
 * confidence-based bulk confirmation. Stitch-first per CLAUDE.md §18 —
 * design source: project 1859462351962811110, screens
 * 351c6db2f6f34996a93da26f60c47a2b (desktop light) /
 * c86cfc05ff8d4a129bc1c608d7748a55 (desktop dark) /
 * 1f2e9df37c16409c99a448871ff69277 (mobile light) /
 * fa6a2ea95aab4679be793c2cc8144927 (mobile dark);
 * artefacts committed at .stitch/designs/activity-redesign/.
 *
 * Phase 56 (2026-06-30): mobile transaction-row redesign + on-row Confirm
 * (Reza-signed-off). The `md:hidden` row body is the Apple-Wallet-restraint
 * layout (44px gem + unreviewed dot + locked amount column + trailing one-tap
 * ✓ Confirm); desktop body unchanged. Stitch project 4167588157712714472,
 * screens 1e164f529c5f452eb6e925ccba0e6d4e (mobile light) /
 * fa5445ad24d4476f89df0b3ef3658ef7 (mobile dark) — §18.8 9.4/10; artefacts at
 * .stitch/designs/phase56/. See docs/blueprint/PHASE_56_MOBILE_ACTIVITY_REDESIGN.md.
 *
 * Functionality preserved verbatim from the Phase 36 v2 page:
 *   - Server-side pagination (25/page) via /api/unified-transactions
 *   - Server-side filters: search, account, category, date range, recurring,
 *     anomalies, uncategorised, direction, excludeTransfers
 *   - 4 click-to-filter summary tiles (Spend / Income / Net / Count)
 *   - "Uncategorised first" default — pushes users into the categorisation loop
 *   - Tap row (or swipe left, or "+ Add") → category picker sheet; swipe
 *     right → transfer sheet; long-press → full Link/route dialog; double-tap
 *     → always-rule (Phase 56.1: tap categorises, no longer the link dialog)
 *   - Import wizard (CSV / QIF / OFX)
 *
 * Phase 49 additions:
 *   - <ConfidenceReviewCard /> — "Your AI bookkeeper" hero: segmented
 *     confidence bar + one-tap "Confirm all medium" (POST bulk-confirm)
 *   - Per-row confidence dot (always visible when < 0.9) + quiet
 *     "✓ Looks right" chip that confirms a single row in place
 *   - Mobile: KPI tiles become a §18.7.6 Compact Dashboard swipe strip
 *     (snap-mandatory, 1.2-tile peek, page-dot indicator)
 *   - Glass vocabulary throughout: bg-card/70 + backdrop-blur-xl, 22/28px
 *     radii, 3px gradient top-accents, luminous icon gems, layered float
 *     shadows (§18.7.2)
 */

import React, { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
  Check,
  ChevronDown,
  Sparkles,
  Plus,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import { ImportWizard } from '@/components/bank/ImportWizard';
import { TransactionLinkDialog } from '@/components/transactions/TransactionLinkDialog';
import { MonthlyReviewPill } from '@/components/bookkeeping/MonthlyReviewPill';
import { BulkActionToolbar } from '@/components/bookkeeping/BulkActionToolbar';
import { CompletionCelebration } from '@/components/bookkeeping/CompletionCelebration';
import { CategoryPickerSheet } from '@/components/bookkeeping/CategoryPickerSheet';
import { ConsumerMoneyFlowSankey } from '@/components/bookkeeping/ConsumerMoneyFlowSankey';
import { getCanonicalMonthlyCashflow } from '@/lib/calculations/canonicalCashflow';
import { ReviewQueueCards } from '@/components/bookkeeping/ReviewQueueCards';
import { TransferDestinationSheet } from '@/components/bookkeeping/TransferDestinationSheet';
import { useSwipeGesture, SWIPE_THRESHOLD_PX } from '@/hooks/useSwipeGesture';
import { CashQuickAddButton } from '@/components/bookkeeping/CashQuickAddButton';
import { ConfidenceReviewCard } from '@/components/bookkeeping/ConfidenceReviewCard';
import { SubscriptionsReviewCard } from '@/components/bookkeeping/SubscriptionsReviewCard';
import { formatCurrency } from '@/lib/utils/formatters';
import { deriveRowStatus } from '@/lib/bookkeeping/transactionStatus';

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
  /** Phase 49.14 — true once the user has confirmed/corrected the category. */
  userCorrectedCategory?: boolean;
  /** Neobrain (2026-06-27) — learned category for this merchant from the user's
   *  own prior categorisations; present only on still-uncategorised rows. */
  suggestedCategoryLevel1?: string | null;
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

// Phase 49.4 — a PENDING review-queue item (medium/low confidence; not yet a
// real transaction). Shape mirrors GET /api/unified-transactions/review-queue.
interface ReviewQueueItem {
  id: string;
  date: string;
  amount: number;
  direction: 'IN' | 'OUT';
  description: string;
  merchant: string | null;
  aiCategoryLevel1: string | null;
  aiCategoryLevel2: string | null;
  aiConfidence: number;
  band: 'medium' | 'low';
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

function ActivityPageContent() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const transactionsRef = useRef<Transaction[]>([]);
  transactionsRef.current = transactions;
  // Reconciliation cursor (2026-06-27) — the list position of the row being
  // categorised, captured BEFORE onLinked refetches (which removes the row).
  // onNavigateNext reads it to continue from that slot instead of restarting
  // at the top. null = no categorise pending (e.g. a Skip, where the list is
  // unchanged and we advance by id).
  const pendingAdvanceIdxRef = useRef<number | null>(null);

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import wizard state
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [accounts, setAccounts] = useState<ImportAccount[]>([]);

  // Phase 56.8 (Reza 2026-06-30) — the Activity LANDING is now a clean hub
  // (KPI snapshot + the state-aware Review tile + a Transactions tile). The full
  // transaction list lives BEHIND the Transactions tile (view === 'list'), so it
  // no longer crowds the landing. Desktop "Start review" opens the SAME list
  // filtered to uncategorised (the one-list SSOT — no separate inbox). The list
  // and its TransactionRow are UNCHANGED — only their visibility is gated here.
  const [view, setView] = useState<'hub' | 'list'>('hub');

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

  // Phase 56.6 (Reza 2026-06-30) — the `pickerTx` compact-sheet state was
  // removed; tap / left-swipe now opens the full TransactionLinkDialog
  // (`linkingTransaction` + `showLinkDialog`) directly.
  // Phase 42 PR6.5h — destination picker for swipe-right Transfer.
  const [transferTx, setTransferTx] = useState<Transaction | null>(null);
  const [advancedView, setAdvancedView] = useState(false);
  // Phase 42 PR6.5c — Review-mode card-stack opt-in.
  const [reviewMode, setReviewMode] = useState(false);
  // Phase 56.2 (Reza decision "A", 2026-06-30) — on MOBILE, the card-deck is
  // the DEFAULT landing when there's work to do. Auto-open it ONCE per page
  // load when there are unreviewed (uncategorised, non-transfer) items; the
  // list is always one tap away via "Skip to list". `autoReviewOpened` guards
  // against re-opening after the user dismisses (or after a refetch).
  const autoReviewOpened = useRef(false);
  // Phase 49 — bump to re-fetch the AI bookkeeper confidence summary.
  const [confidenceRefresh, setConfidenceRefresh] = useState(0);
  // Phase 49.4 / 49.14 — confidence-band lens. When set, the page shows
  // EVERYTHING in that band as one simple view (Reza directives 2026-06-12:
  // band chips act as filters; "the solution must be simple enough for
  // everyone to understand"): new items still waiting from imports (queue)
  // AND booked transactions, each with a plain confirmed / not-confirmed
  // status. This reconciles the discrepancy where "Review low" showed
  // queue items while low-score booked rows hid in the main list.
  const [confidenceBand, setConfidenceBand] = useState<'high' | 'medium' | 'low' | null>(null);
  const [queueItems, setQueueItems] = useState<ReviewQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueSelected, setQueueSelected] = useState<Set<string>>(() => new Set());
  // Phase 56.3 — the band chips now read the ONE canonical review-queue SSOT
  // (the bulk-confirm GET), so High+Medium+Low === `total` === the
  // Home hero count === the deck (fixes the "78 vs 365" divergence).
  const [bandCounts, setBandCounts] = useState<{
    high: number;
    medium: number;
    low: number;
    total: number;
  }>({ high: 0, medium: 0, low: 0, total: 0 });
  // Phase 56.3 — the full, all-time review set for the card-deck (fetched via
  // the list route's canonical `uncategorized=true` filter — same predicate as
  // the count — so the deck opens reliably with the real queue, not the 25-row
  // display page it was filtering before).
  const [reviewTxns, setReviewTxns] = useState<Transaction[]>([]);
  // Phase 56.2/56.3 — open the card-deck off the CANONICAL review set (all-time),
  // not the paginated display page. The old `transactions.filter` saw only the
  // current 25 rows (usually already categorised) → the deck never opened.
  useEffect(() => {
    if (loading || autoReviewOpened.current) return;
    if (typeof window === 'undefined') return;
    const hasWork = reviewTxns.length > 0 || bandCounts.total > 0;
    if (!hasWork) return;
    // Phase 56.5 (Reza 2026-06-30) — the card-deck is a MOBILE-ONLY interaction
    // ("the card categorisation method should be only for mobile view"). The
    // deck NEVER opens on desktop — not on auto-open, and not via the Home
    // "Fix now" (?review=1) deep-link. Desktop reviews via the on-page surfaces
    // (the AI-bookkeeper card + the list); the dedicated inbox is one click away.
    const explicit = new URLSearchParams(window.location.search).get('review') === '1';
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) {
      // Phase 56.8 — desktop: the Home "Fix now" (?review=1) deep-link opens the
      // SAME transaction list filtered to uncategorised (the one-list review
      // surface), never the deck. Otherwise desktop stays on the clean hub.
      if (explicit) {
        autoReviewOpened.current = true;
        setTileFilter('uncategorized');
        setConfidenceBand(null);
        setPage(1);
        setView('list');
      }
      return;
    }
    // Arrived via Home "Fix now" (?review=1) → open the deck immediately on mobile.
    if (explicit) {
      autoReviewOpened.current = true;
      setReviewMode(true);
      return;
    }
    // Else (decision "A"): auto-open on MOBILE when there's work — but only
    // ONCE PER SESSION (sessionStorage), so navigating back doesn't re-pop —
    // keeps it the default landing without the pop-on-arrival nag that was
    // reverted before (↩️ Reversed Decisions).
    if (sessionStorage.getItem('monitrax.reviewDeck.dismissed') === '1') return;
    autoReviewOpened.current = true;
    setReviewMode(true);
  }, [loading, reviewTxns, bandCounts.total]);
  // Phase 49.5 — queue item whose category is being corrected via the picker.
  const [queueEditItem, setQueueEditItem] = useState<ReviewQueueItem | null>(null);

  // Phase 49.4 — fetch the band counts for the filter chips (cheap summary).
  const fetchBandCounts = useCallback(async () => {
    if (!token) return;
    try {
      // Canonical review-queue summary (count + bands that PARTITION the same
      // unconfirmed set → high+medium+low === count) comes from the bulk-confirm
      // GET's `reviewBands`/`reviewCount` (the ONE SSOT, §12.2.1).
      const [summaryRes, txRes] = await Promise.all([
        fetch('/api/unified-transactions/bulk-confirm', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        // The actual rows for the deck — the canonical `uncategorized=true`
        // filter, all-time, enriched (account + Neobrain suggestion) by the
        // list route. High limit so the deck has the real queue, not a page.
        fetch('/api/unified-transactions?uncategorized=true&excludeTransfers=true&limit=300&page=1', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const summary = await summaryRes.json().catch(() => null);
      if (summaryRes.ok && summary?.success) {
        const b = summary.data.reviewBands ?? {};
        setBandCounts({
          high: b.high ?? 0,
          medium: b.medium ?? 0,
          low: b.low ?? 0,
          total: summary.data.reviewCount ?? 0,
        });
      }
      const txJson = await txRes.json().catch(() => null);
      if (txRes.ok && txJson?.success && Array.isArray(txJson.data)) {
        setReviewTxns(txJson.data as Transaction[]);
      }
    } catch {
      // Quiet — chips just show 0.
    }
  }, [token]);

  // Phase 49.4 — load the queue items for the active band.
  const fetchQueueItems = useCallback(async (band: 'medium' | 'low') => {
    if (!token) return;
    setQueueLoading(true);
    try {
      const res = await fetch(`/api/unified-transactions/review-queue?band=${band}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setQueueItems(json.data.items as ReviewQueueItem[]);
        setQueueSelected(new Set((json.data.items as ReviewQueueItem[]).map((i) => i.id)));
      }
    } catch {
      setQueueItems([]);
    } finally {
      setQueueLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // High has no queue (≥0.9 was auto-accepted at import) — queue items
    // exist only for medium/low.
    if (confidenceBand === 'medium' || confidenceBand === 'low') {
      fetchQueueItems(confidenceBand);
    } else {
      setQueueItems([]);
    }
  }, [confidenceBand, fetchQueueItems]);

  // Phase 49.4 — confirm or skip the selected queue items.
  const actionQueueItems = useCallback(
    async (action: 'confirm' | 'skip', ids: string[]) => {
      if (!token || ids.length === 0) return;
      try {
        await fetch('/api/unified-transactions/review-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action, reviewItemIds: ids }),
        });
        // Drop the actioned items locally; refresh counts + (on confirm) the list.
        setQueueItems((prev) => prev.filter((i) => !ids.includes(i.id)));
        setQueueSelected((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        setConfidenceRefresh((n) => n + 1);
        fetchBandCounts();
        if (action === 'confirm') {
          fetchTransactions();
          fetchSummary();
        }
        // Phase 49.7 (Reza) — celebrate only when the pile CLEARS, not on
        // every confirmation. The toast was firing per-confirm.
        if (queueItems.length - ids.length <= 0) {
          setCelebrationTrigger((t) => t + 1);
        }
      } catch {
        // Leave items in place; user can retry.
      }
    },
    [token, fetchBandCounts, queueItems.length]
  );

  // Apply "always categorise X as Y" on a double-tap when the row
  // already has a category set. Writes a USER-source MerchantMapping
  // via the standard PATCH path (which lazy-seeds the registry per
  // PR2's SSOT bridge).
  const applyAlwaysRule = useCallback(async (tx: Transaction) => {
    if (!tx.categoryLevel1 || !token) return;
    try {
      // Re-PATCH the same category — the existing endpoint upserts a
      // `MerchantMapping` row on every category write (Phase 13
      // learning surface). User-confidence override = 1.0 means this
      // becomes the always-rule for the merchant.
      await fetch(`/api/unified-transactions/${tx.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
  }, [token]);

  // Phase 42 PR6.5h — `markAsTransfer` removed. Right-swipe now opens
  // <TransferDestinationSheet /> which handles the PATCH itself with
  // a chosen destination account. See `setTransferTx(tx)` below.

  // Phase 49 — per-row "✓ Looks right" confirm for an uncertain
  // UnifiedTransaction already in the list (e.g. a Basiq-synced row written
  // at medium confidence). Re-PATCHes the row's OWN category, which the
  // canonical PATCH path promotes to confidence 1.0 and learns the merchant.
  // (The import's medium/low pile lives in the review queue and is handled
  // by the AI bookkeeper card, not here.)
  const confirmRow = useCallback(
    async (tx: Transaction) => {
      if (!token || !tx.categoryLevel1) return;
      try {
        await fetch(`/api/unified-transactions/${tx.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            categoryLevel1: tx.categoryLevel1,
            categoryLevel2: tx.categoryLevel2,
          }),
        });
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === tx.id ? { ...t, confidenceScore: 1.0, userCorrectedCategory: true } : t
          )
        );
      } catch {
        // Quiet failure — chip stays, user can retry.
      }
    },
    [token]
  );

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
      // Phase 49.14 — confidence-band lens. When a band is active it is the
      // SOLE lens: it must show EVERYTHING in that band (matching the chip
      // count, which counts the whole band). Previously the band was AND-ed
      // with the default `uncategorized` tile filter, so "High" became
      // `confidence=high & uncategorized=true` — an empty intersection, since
      // high-confidence rows are auto-filed (not uncategorised). "Low" only
      // appeared to work because low-confidence rows happen to be uncategorised.
      // Fix (2026-06-22): band takes precedence over the tile filters.
      if (confidenceBand) {
        params.append('confidence', confidenceBand);
      } else if (tileFilter === 'uncategorized') {
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
        // Normalise the error to a string. The canonical API error
        // shape is `{success:false, error:{code, message, timestamp}}`
        // so naïve `setError(json.error)` historically crashed the
        // page with React error #31 (object as React child). Always
        // produce a string here so ErrorState never gets an object.
        const errMsg =
          typeof json.error === 'string'
            ? json.error
            : json.error?.message || json.error?.code || 'Failed to load transactions';
        setError(errMsg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [token, page, search, accountFilter, categoryFilter, dateRange, showRecurringOnly, showAnomaliesOnly, tileFilter, confidenceBand]);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      // Phase 2c (cashflow-SSOT) — the "This month" tiles read the CANONICAL
      // current-calendar-month cashflow (the same `getCanonicalMonthlyCashflow`
      // the /cashflow hero uses), so In/Out/Net match the hero exactly instead
      // of a separate rolling-30-day window. Transaction count is the
      // current-calendar-month count. CLAUDE.md §19.1.
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [snapRes, countRes] = await Promise.all([
        fetch('/api/master-snapshot', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/unified-transactions/analytics?from=${encodeURIComponent(startOfMonth)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const snapJson = await snapRes.json();
      if (!snapRes.ok || !snapJson.success) return;
      const cf = getCanonicalMonthlyCashflow(
        snapJson.data as Parameters<typeof getCanonicalMonthlyCashflow>[0]
      );
      const countJson = await countRes.json().catch(() => null);
      const transactionCount =
        countRes.ok && countJson?.success ? countJson.data.summary.transactionCount : 0;
      setSummary({
        totalSpend: cf.outflow,
        totalIncome: cf.inflow,
        netCashflow: cf.net,
        transactionCount,
        topCategories: [],
      });
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

  // Phase 49.4 — keep the band-filter chip counts current.
  useEffect(() => {
    fetchBandCounts();
  }, [fetchBandCounts, confidenceRefresh]);

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

  // Phase 49 — §18.7.6 KPI swipe strip page-dot tracking (mobile only).
  const kpiStripRef = useRef<HTMLDivElement | null>(null);
  const [kpiDot, setKpiDot] = useState(0);
  const handleKpiScroll = useCallback(() => {
    const el = kpiStripRef.current;
    if (!el || !el.firstElementChild) return;
    const tileWidth = (el.firstElementChild as HTMLElement).offsetWidth + 12; // gap-3
    setKpiDot(Math.min(3, Math.max(0, Math.round(el.scrollLeft / tileWidth))));
  }, []);

  // Phase 49.7 — honour the Home "Next actions" deep links
  // (?filter=recurring | ?filter=anomalies). The pending-actions tile linked
  // here since Phase 42 but the param was never read — the click silently
  // landed on the default view (Reza report 2026-06-11).
  const searchParams = useSearchParams();
  const appliedFilterParam = useRef(false);
  useEffect(() => {
    if (appliedFilterParam.current) return;
    const f = searchParams?.get('filter');
    if (f === 'recurring') {
      setShowRecurringOnly(true);
      setTileFilter('all');
      setView('list'); // Phase 56.8 — deep-linked filters open the list, not the hub.
      appliedFilterParam.current = true;
    } else if (f === 'anomalies') {
      setShowAnomaliesOnly(true);
      setTileFilter('all');
      setView('list'); // Phase 56.8 — deep-linked filters open the list, not the hub.
      appliedFilterParam.current = true;
    }
  }, [searchParams]);

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
              {/* Phase 42 PR6.5c — Quick review pill. Enters the
                  full-screen card-stack review mode. Self-hides when
                  there's nothing to review.
                  Phase 56.5 (Reza 2026-06-30) — MOBILE-ONLY (`md:hidden`): the
                  card-deck is a mobile interaction; desktop reviews via the
                  AI-bookkeeper card / list / inbox, never the deck. */}
              {transactions.some((t) => !t.categoryLevel1) && (
                <button
                  type="button"
                  onClick={() => setReviewMode(true)}
                  className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
                >
                  Quick review →
                </button>
              )}
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
        {view === 'hub' && (
          <div className="mb-6">
            <ConsumerMoneyFlowSankey />
          </div>
        )}

        {/* SUMMARY TILES — clickable to filter. Phase 49: §18.7.6 Compact
            Dashboard mobile mechanics — horizontal snap strip with a
            1.2-tile peek + page-dot indicator below sm; 4-col grid at sm+.
            Phase 56.8 — hub only; clicking a tile opens the list filtered. */}
        {view === 'hub' && summary && (
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              This month
            </p>
            <div
              ref={kpiStripRef}
              onScroll={handleKpiScroll}
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 anim-rise-stagger"
            >
              <SummaryTile
                label="Spending"
                value={-summary.totalSpend}
                tone="rose"
                icon={ArrowUp}
                active={tileFilter === 'spend'}
                onClick={() => {
                  setTileFilter(tileFilter === 'spend' ? 'uncategorized' : 'spend');
                  setPage(1);
                  setView('list');
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
                  setView('list');
                }}
              />
              <SummaryTile
                label="Net cashflow"
                value={summary.netCashflow}
                tone={summary.netCashflow >= 0 ? 'brand' : 'rose'}
                icon={Sparkles}
                emphasis
              />
              <SummaryTile
                label="Transactions"
                value={summary.transactionCount}
                tone="violet"
                icon={Filter}
                isCount
                active={tileFilter === 'all'}
                onClick={() => {
                  setTileFilter(tileFilter === 'all' ? 'uncategorized' : 'all');
                  setPage(1);
                  setView('list');
                }}
              />
            </div>
            {/* Page-dot indicator (mobile strip only) */}
            <div className="mt-2 flex justify-center gap-1.5 sm:hidden" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === kpiDot ? 'w-4 bg-sky-500' : 'w-1.5 bg-foreground/15'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Phase 49 — "Your AI bookkeeper" confidence review card. Phase 49.15
            (Reza 2026-06-18): the review cards sit ABOVE search + filters, and
            search + filters sit directly above the transaction list — so the
            page reads top-to-bottom as "here's what the AI did → here's how to
            find a transaction → here are the transactions." Self-hides when tidy. */}
        {view === 'hub' && (
          <ConfidenceReviewCard
            refreshKey={confidenceRefresh}
            onConfirmed={async () => {
              // Phase 49.7 — no celebration toast here; the card shows its own
              // inline receipt and the toast is reserved for clearing the pile.
              await fetchTransactions();
              fetchSummary();
              fetchBandCounts();
            }}
            // Phase 56.8 — "Start review": mobile opens the card-deck (mobile-only
            // per §56.5); desktop opens the SAME transaction list filtered to
            // uncategorised (the one-list SSOT, Reza 2026-06-30 — no separate
            // review inbox). Familiar surface, one design, one source.
            onStartReview={() => {
              if (
                typeof window !== 'undefined' &&
                window.matchMedia('(max-width: 767px)').matches
              ) {
                setReviewMode(true);
              } else {
                setTileFilter('uncategorized');
                setConfidenceBand(null);
                setPage(1);
                setView('list');
              }
            }}
            onImport={() => setShowImportWizard(true)}
          />
        )}

        {/* Phase 49.11 — "Possible subscriptions" review card. The dedicated
            surface behind the Home pending-actions count (UNMATCHED
            RecurringPayment patterns); the ?filter=recurring deep link lands
            the user right here. Self-hides when there's nothing to confirm. */}
        {view === 'hub' && (
          <SubscriptionsReviewCard
            refreshKey={confidenceRefresh}
            onActioned={() => {
              fetchSummary();
            }}
          />
        )}

        {/* Phase 56.8 (Reza 2026-06-30) — the Transactions tile. The full
            ledger lives BEHIND this so the hub stays clean; click → the list
            view (all transactions). The list + its rows are unchanged. */}
        {view === 'hub' && (
          <button
            type="button"
            onClick={() => {
              setTileFilter('all');
              setConfidenceBand(null);
              setPage(1);
              setView('list');
            }}
            className="group mb-6 flex w-full items-center justify-between gap-4 rounded-[28px] border border-foreground/10 bg-card/70 px-5 py-5 text-left backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)] transition hover:-translate-y-0.5 sm:px-6"
          >
            <div className="flex min-w-0 items-center gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-lg shadow-slate-500/20">
                <Wallet className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Your ledger
                </p>
                <p className="mt-1 text-lg font-semibold tracking-tight">Browse all transactions</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Search, filter and edit your full history
                  {summary ? ` — ${summary.transactionCount.toLocaleString('en-AU')} this month` : ''}.
                </p>
              </div>
            </div>
            <span className="hidden shrink-0 items-center gap-1.5 rounded-[14px] border border-foreground/15 bg-background/50 px-4 py-2 text-sm font-medium text-foreground backdrop-blur transition group-hover:bg-muted sm:inline-flex">
              Open transactions
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        )}

        {view === 'list' && (
          <>
            {/* Phase 56.8 — back to the clean hub */}
            <button
              type="button"
              onClick={() => setView('hub')}
              className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" /> Activity
            </button>

        {/* Phase 55 — honest, calm sort cue: this is a SORT (needs-you first),
            not a filter. Neutral sky tone, not an amber alert. */}
        {tileFilter === 'uncategorized' && (
          <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sm text-sky-800 dark:text-sky-300 anim-fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-medium">Sorted — the items that need you, first</span>
            <button
              onClick={() => { setTileFilter('all'); setPage(1); }}
              className="underline underline-offset-2 hover:opacity-80"
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
              // Reset to page 1 on every keystroke — every other filter
              // (account/category/date, lines ~896-932) already does this. The
              // search box was the ONLY one that didn't, so typing a query while
              // on page > 1 (e.g. a many-page account view) refetched at the stale
              // page and the narrowed results didn't fill it → "No transactions
              // match" even when matches exist (Reza report 2026-06-29).
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search merchant, description, or category"
              className="w-full pl-9 pr-3 py-2 rounded-full border border-foreground/10 bg-card/70 backdrop-blur-xl text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/40 transition"
            />
          </form>

          <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 sm:pb-0">
            {/* Phase 49.14 (Reza) — the three confidence bands act as plain
                list filters. Counts include EVERYTHING in the band: new
                items from imports + booked transactions, so the chip number
                matches what the user actually sees when they click it. */}
            {/* Phase 52.5c-fix (Reza 2026-06-22) — the three confidence bands
                always render (even at 0) so the lens is predictable; previously
                a band hid at 0, which read as "Medium is missing" rather than
                "you have no medium-confidence transactions". */}
            <ConfidenceChip
              active={confidenceBand === 'high'}
              onClick={() => { setConfidenceBand(confidenceBand === 'high' ? null : 'high'); setPage(1); }}
              dot="bg-emerald-400"
              label={`High · ${bandCounts.high.toLocaleString('en-AU')}`}
            />
            <ConfidenceChip
              active={confidenceBand === 'medium'}
              onClick={() => { setConfidenceBand(confidenceBand === 'medium' ? null : 'medium'); setPage(1); }}
              dot="bg-amber-400"
              label={`Medium · ${bandCounts.medium.toLocaleString('en-AU')}`}
            />
            <ConfidenceChip
              active={confidenceBand === 'low'}
              onClick={() => { setConfidenceBand(confidenceBand === 'low' ? null : 'low'); setPage(1); }}
              dot="bg-rose-400"
              label={`Low · ${bandCounts.low.toLocaleString('en-AU')}`}
            />
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
        <div id="activity-list-top" />

        {/* ADVANCED FILTERS PANEL */}
        {showFilters && (
          <div className="mb-5 p-4 rounded-[22px] border border-foreground/10 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] anim-rise">
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
        {/* Phase 49.14 — when a band lens is active, show BOTH halves of the
            band in one simple view: new items from imports (confirm to add)
            followed by the band-filtered booked list with a plain
            confirmed / not-confirmed status per row. Stitch screen
            05d687e487894fd988a904280f47184a (.stitch/designs/phase49.14/). */}
        {confidenceBand && (confidenceBand === 'high' ? false : queueLoading || queueItems.length > 0) && (
          <QueueReviewList
            band={confidenceBand as 'medium' | 'low'}
            items={queueItems}
            loading={queueLoading}
            selected={queueSelected}
            onToggle={(id) =>
              setQueueSelected((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onSelectAll={(all) => setQueueSelected(all ? new Set(queueItems.map((i) => i.id)) : new Set())}
            onConfirm={(ids) => actionQueueItems('confirm', ids)}
            onSkip={(ids) => actionQueueItems('skip', ids)}
            onEditCategory={(item) => setQueueEditItem(item)}
            onClose={() => setConfidenceBand(null)}
          />
        )}
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
                  <div className="rounded-[22px] border border-foreground/10 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)] overflow-hidden">
                    {g.items.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        selected={selectedIds.has(tx.id)}
                        onToggleSelected={() => toggleSelected(tx.id)}
                        advancedView={advancedView}
                        onConfirm={() => confirmRow(tx)}
                        // Phase 56.6 (Reza 2026-06-30) — tap / left-swipe a
                        // transaction → the FULL "Link Transaction" dialog (the
                        // complete categorisation method: vendor card, same-vendor
                        // batch, Suggested / All / Create / Split, pattern
                        // detection). The compact CategoryPickerSheet was removed
                        // per Reza: "the compact categorisation modal … should be
                        // completely removed, I want the previous complete method."
                        onClick={() => {
                          setLinkingTransaction(tx);
                          setShowLinkDialog(true);
                        }}
                        onSwipeLeft={() => {
                          setLinkingTransaction(tx);
                          setShowLinkDialog(true);
                        }}
                        onSwipeRight={() => setTransferTx(tx)}
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

            {/* Phase 49 — swipe affordance hint (mobile only, per the Stitch
                mobile design): the gestures existed since Phase 42 PR6.5 but
                were undiscoverable. One quiet line fixes that. */}
            <p className="mt-3 text-center text-[11px] text-muted-foreground/70 sm:hidden">
              ← swipe to categorise · swipe to mark transfer →
            </p>
          </>
        )}
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

      {/* Phase 56.6 (Reza 2026-06-30) — the compact CategoryPickerSheet for
          tapping a transaction was REMOVED. Tap / left-swipe now opens the full
          TransactionLinkDialog directly (wired below). Transfers stay on the
          right-swipe → TransferDestinationSheet. (The band-review staging-item
          edit below still uses the sheet on review-queue items — a different
          data path that the Phase 56 review-IA consolidation reworks next.) */}

      {/* Phase 49.5 — same picker sheet, but for a review-queue item being
          corrected: the override files the item with the chosen category
          via POST review-queue action 'edit' (USER_CORRECTION learning). */}
      <CategoryPickerSheet
        open={queueEditItem !== null}
        transactionId={null}
        context={
          queueEditItem
            ? {
                merchant: queueEditItem.description || queueEditItem.merchant || null,
                amount: queueEditItem.amount,
              }
            : null
        }
        onPickOverride={async (categoryLevel1) => {
          if (!queueEditItem || !token) return;
          const res = await fetch('/api/unified-transactions/review-queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              action: 'edit',
              reviewItemIds: [queueEditItem.id],
              values: { categoryLevel1 },
            }),
          });
          if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error?.message ?? 'Failed to file with the new category');
          }
        }}
        onMarkTransfer={async () => {
          // Phase 49.9 — file the queue item as an own-account transfer.
          if (!queueEditItem || !token) return;
          const res = await fetch('/api/unified-transactions/review-queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'transfer', reviewItemIds: [queueEditItem.id] }),
          });
          if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error?.message ?? 'Failed to mark as transfer');
          }
          const editedId = queueEditItem.id;
          setQueueEditItem(null);
          setQueueItems((prev) => prev.filter((i) => i.id !== editedId));
          setQueueSelected((prev) => {
            const next = new Set(prev);
            next.delete(editedId);
            return next;
          });
          setConfidenceRefresh((n) => n + 1);
          fetchBandCounts();
          fetchTransactions();
          fetchSummary();
        }}
        onClose={() => setQueueEditItem(null)}
        onSuccess={() => {
          const editedId = queueEditItem?.id;
          setQueueEditItem(null);
          if (editedId) {
            setQueueItems((prev) => prev.filter((i) => i.id !== editedId));
            setQueueSelected((prev) => {
              const next = new Set(prev);
              next.delete(editedId);
              return next;
            });
          }
          setConfidenceRefresh((n) => n + 1);
          fetchBandCounts();
          fetchTransactions();
          fetchSummary();
          // Phase 49.7 — celebrate only when this edit cleared the pile.
          if (queueItems.length <= 1) setCelebrationTrigger((t) => t + 1);
        }}
      />

      {/* Phase 42 PR6.5h — Transfer destination picker. Opens on
          right-swipe of any row. Lists user's bank + investment
          accounts so the user can record where the money went. */}
      <TransferDestinationSheet
        open={transferTx !== null}
        transactionId={transferTx?.id ?? null}
        excludeAccountId={transferTx?.account.id ?? null}
        context={
          transferTx
            ? {
                merchant:
                  transferTx.description ||
                  transferTx.merchantStandardised ||
                  transferTx.merchantRaw ||
                  null,
                amount: transferTx.amount,
              }
            : null
        }
        onClose={() => setTransferTx(null)}
        onSuccess={() => {
          setTransferTx(null);
          fetchTransactions();
          fetchSummary();
        }}
      />

      {/* Phase 42 PR6.5c — Review Queue card-stack. Full-screen
          opt-in review mode for uncategorised transactions already in the
          list; each successful PATCH advances + we refresh on close. */}
      <ReviewQueueCards
        open={reviewMode}
        // Phase 56.3 — the FULL canonical review set (all-time, enriched), not
        // the paginated display page. Fixes "deck won't open / too thin".
        transactions={reviewTxns}
        onPatchSuccess={() => {
          // Bump celebration trigger when the queue clears completely.
          setCelebrationTrigger((t) => t + 1);
        }}
        onClose={() => {
          setReviewMode(false);
          // Phase 56.3 — remember the dismissal for this tab session so the
          // deck doesn't auto-re-pop on the next Activity visit (anti-nag).
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('monitrax.reviewDeck.dismissed', '1');
          }
          setConfidenceRefresh((n) => n + 1);
          fetchTransactions();
          fetchBandCounts();
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
          // Capture the categorised row's position BEFORE the refetch removes
          // it, so onNavigateNext can continue from that slot (Reza 2026-06-27:
          // "the list goes from the beginning again rather than continue").
          const cur = transactionsRef.current;
          pendingAdvanceIdxRef.current = cur.findIndex(
            (t) => t.id === linkingTransaction?.id
          );
          await fetchTransactions();
          fetchSummary();
        }}
        hasMoreTransactions={transactions.length > 1}
        onNavigateNext={() => {
          const current = transactionsRef.current;
          if (current.length === 0) {
            setShowLinkDialog(false);
            setLinkingTransaction(null);
            return;
          }

          // Disambiguate by whether the current row is STILL in the list:
          //  - present  → this was a SKIP (list unchanged) → advance to idx+1.
          //  - gone     → this was a CATEGORISE (refetch removed it) → continue
          //               from the slot it occupied (its successor shifted in).
          // Either way, wrap to the top at the end so SKIPPED rows get a second
          // pass (Reza 2026-06-27: "if the list finish then goes back from start
          // … for transactions that I have skipped").
          const idx = current.findIndex((t) => t.id === linkingTransaction?.id);
          const slot = idx >= 0 ? idx + 1 : pendingAdvanceIdxRef.current ?? 0;
          pendingAdvanceIdxRef.current = null;
          const next = slot < current.length ? current[slot] : current[0];
          setLinkingTransaction(next);
        }}
      />
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Summary tile
// ---------------------------------------------------------------------------

/**
 * Phase 49 — §18.7.2 polished tile sub-pattern: glass body, 22px radius,
 * 3px sub-palette gradient top-accent, 1px inner-top highlight, luminous
 * gradient icon gem, tabular-nums value. 'brand' tone renders the value in
 * the sky→indigo gradient text-fill (Net cashflow positive state).
 * On mobile the tile is a §18.7.6 swipe-strip member (snap-start + 78vw).
 */
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
  tone: 'emerald' | 'rose' | 'sky' | 'amber' | 'violet' | 'brand';
  icon: typeof ArrowDown;
  active?: boolean;
  emphasis?: boolean;
  isCount?: boolean;
  onClick?: () => void;
}) {
  const tones: Record<string, { strip: string; gem: string; gemShadow: string }> = {
    emerald: { strip: 'from-emerald-400 to-emerald-600', gem: 'from-emerald-400 to-emerald-600', gemShadow: 'shadow-emerald-500/25' },
    rose: { strip: 'from-rose-400 to-rose-600', gem: 'from-rose-400 to-rose-600', gemShadow: 'shadow-rose-500/25' },
    sky: { strip: 'from-sky-400 to-sky-600', gem: 'from-sky-400 to-sky-600', gemShadow: 'shadow-sky-500/25' },
    amber: { strip: 'from-amber-400 to-amber-600', gem: 'from-amber-400 to-amber-600', gemShadow: 'shadow-amber-500/25' },
    violet: { strip: 'from-violet-400 to-violet-600', gem: 'from-violet-400 to-violet-600', gemShadow: 'shadow-violet-500/25' },
    brand: { strip: 'from-sky-400 to-indigo-500', gem: 'from-sky-400 to-indigo-500', gemShadow: 'shadow-indigo-500/25' },
  };
  const t = tones[tone];

  const ringClass = active
    ? 'ring-2 ring-sky-500/30'
    : emphasis
      ? 'ring-1 ring-indigo-500/10'
      : '';

  const Wrapper: 'button' | 'div' = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`relative snap-start shrink-0 w-[78vw] max-w-[280px] sm:w-auto sm:max-w-none overflow-hidden text-left rounded-[22px] border border-foreground/10 bg-card/70 backdrop-blur-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)] transition hover:-translate-y-0.5 ${ringClass} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${t.strip}`} aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-[3px] h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" aria-hidden />
      <div className="relative flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-[10px] bg-gradient-to-br ${t.gem} text-white shadow-lg ${t.gemShadow}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div
        className={`relative mt-2 text-2xl font-semibold tabular-nums tracking-tight ${
          tone === 'brand'
            ? 'bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-transparent'
            : value < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-foreground'
        }`}
      >
        {isCount ? value.toLocaleString('en-AU') : formatCurrency(value)}
      </div>
      {active && (
        <div className="relative text-[11px] text-sky-600 dark:text-sky-300 mt-0.5 font-medium">Filtering</div>
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

// ---------------------------------------------------------------------------
// Phase 49.4 — confidence-band review surface
// ---------------------------------------------------------------------------

function ConfidenceChip({
  active,
  onClick,
  dot,
  label,
}: {
  active: boolean;
  onClick: () => void;
  dot: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-all duration-200 ${
        active
          ? 'bg-foreground text-background border-foreground shadow-sm'
          : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />
      {label}
    </button>
  );
}

// Phase 49.4–49.10 — item-level confidence review surface (QueueReviewList +
// QueueReviewRow below). Stitch design source (CLAUDE.md §18.4, backfilled per
// §18.2.1): project 1859462351962811110, screen 08bce51673d04e7b98fb385538ac865d
// (desktop light). Artefact: .stitch/designs/activity-redesign/review-surface-desktop-light.{html,png}.
const BAND_LABEL: Record<'medium' | 'low', { title: string; blurb: string; dot: string; tone: string }> = {
  // Phase 49.14 — plain-English headers (Reza: "simple enough for everyone
  // to understand"). These items came from imports and are NOT in the
  // user's books until confirmed; the booked list renders below this card.
  medium: {
    title: 'New — confirm to add',
    blurb: 'From your imports, not in your books yet. The AI is fairly sure — confirm what looks right, fix what doesn’t.',
    dot: 'bg-amber-400',
    tone: 'text-amber-600 dark:text-amber-400',
  },
  low: {
    title: 'New — confirm to add',
    blurb: 'From your imports, not in your books yet. The AI is unsure here — worth a closer look before you confirm.',
    dot: 'bg-rose-400',
    tone: 'text-rose-600 dark:text-rose-400',
  },
};

function QueueReviewList({
  band,
  items,
  loading,
  selected,
  onToggle,
  onSelectAll,
  onConfirm,
  onSkip,
  onEditCategory,
  onClose,
}: {
  band: 'medium' | 'low';
  items: ReviewQueueItem[];
  loading: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (all: boolean) => void;
  onConfirm: (ids: string[]) => void;
  onSkip: (ids: string[]) => void;
  onEditCategory: (item: ReviewQueueItem) => void;
  onClose: () => void;
}) {
  const meta = BAND_LABEL[band];
  const selectedIds = items.filter((i) => selected.has(i.id)).map((i) => i.id);
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  return (
    <div className="anim-rise">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-foreground/10 bg-card/70 backdrop-blur-xl px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} aria-hidden />
          <div>
            <p className="text-sm font-semibold">{meta.title} · {items.length.toLocaleString('en-AU')}</p>
            <p className="text-xs text-muted-foreground">{meta.blurb}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Back to all
        </button>
      </div>

      {loading ? (
        <LoadingList />
      ) : items.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-border bg-card/40 p-10 text-center anim-rise">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 mb-3">
            <Check className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight">All caught up</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Nothing left in the {band}-confidence pile. Nice work.
          </p>
        </div>
      ) : (
        <>
          {/* Select-all + bulk bar */}
          <div className="mb-2 flex items-center justify-between px-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/40"
              />
              {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSkip(selectedIds)}
                disabled={selectedIds.length === 0}
                className="inline-flex items-center gap-1.5 rounded-[12px] border border-foreground/10 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Skip
              </button>
              <button
                onClick={() => onConfirm(selectedIds)}
                disabled={selectedIds.length === 0}
                className="inline-flex items-center gap-1.5 rounded-[12px] bg-gradient-to-r from-sky-500 to-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-40 transition"
              >
                <Check className="w-3.5 h-3.5" /> Confirm {selectedIds.length > 0 ? selectedIds.length : ''}
              </button>
            </div>
          </div>

          <div className="rounded-[22px] border border-foreground/10 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)] overflow-hidden">
            {items.map((item) => (
              <QueueReviewRow
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onToggle={() => onToggle(item.id)}
                onConfirm={() => onConfirm([item.id])}
                onSkip={() => onSkip([item.id])}
                onEditCategory={() => onEditCategory(item)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QueueReviewRow({
  item,
  selected,
  onToggle,
  onConfirm,
  onSkip,
  onEditCategory,
}: {
  item: ReviewQueueItem;
  selected: boolean;
  onToggle: () => void;
  onConfirm: () => void;
  onSkip: () => void;
  /** Phase 49.5 — open the category picker to correct the AI's category. */
  onEditCategory: () => void;
}) {
  const isIn = item.direction === 'IN';
  const label = item.description || item.merchant || 'Transaction';
  const confidencePct = Math.round(item.aiConfidence * 100);
  // Phase 49.8 (Reza) — in the REVIEW surface the category pill is
  // colour-coded by CONFIDENCE BAND (amber = medium, rose = low), not by
  // category: here the question is "how sure is the AI", and the pill is
  // the confirm target. (Normal transaction lists keep category colours.)
  const bandPillTone =
    item.band === 'low'
      ? 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300'
      : 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300';
  const bandTextTone = item.band === 'low' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400';

  // Phase 49.7 (Reza 2026-06-11) — the amount sits IMMEDIATELY LEFT of the
  // category cluster: one clean action line "-$33 · [Food & Dining ▾] ✓ ✗"
  // instead of the ragged two-level right edge. Desktop renders it inline
  // with the description; mobile keeps the 49.5.1 two-line reflow with this
  // row as line 2 (description keeps the full first line).
  const actionRow = (
    <div className="flex items-center gap-2.5">
      <span className={`font-semibold tabular-nums text-sm ${isIn ? 'text-emerald-600' : 'text-foreground'}`}>
        {isIn ? '+' : '-'}{formatCurrency(item.amount)}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={onEditCategory}
          title="Change category"
          aria-label={`Change category (currently ${item.aiCategoryLevel1 ?? 'uncategorised'})`}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition hover:ring-2 hover:ring-sky-500/30 ${bandPillTone}`}
        >
          {item.aiCategoryLevel1 ?? 'Pick category'}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        <button
          onClick={onConfirm}
          title="Confirm — file with this category"
          aria-label="Confirm category"
          className="inline-flex items-center justify-center w-8 h-8 sm:w-7 sm:h-7 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={onSkip}
          title="Skip — don't import this one"
          aria-label="Skip"
          className="inline-flex items-center justify-center w-8 h-8 sm:w-7 sm:h-7 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`px-3 sm:px-4 py-3 border-b border-border last:border-0 ${
        selected ? 'bg-emerald-50/40 dark:bg-emerald-500/[0.06]' : 'hover:bg-muted/40'
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/40 cursor-pointer"
          aria-label={`Select ${label}`}
        />
        <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${isIn ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isIn ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{label}</div>
          <div className="text-xs truncate mt-0.5">
            <span className={`tabular-nums ${bandTextTone}`}>{confidencePct}% sure</span>
          </div>
        </div>
        {/* Desktop: amount + category cluster on one line */}
        <div className="hidden sm:block shrink-0">{actionRow}</div>
      </div>
      {/* Mobile second line: amount + category cluster, right-aligned */}
      <div className="mt-2 flex justify-end sm:hidden">{actionRow}</div>
    </div>
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
// Transaction row — tap (or swipe-left, or "+ Add") opens the category picker;
// long-press opens the full Link/route dialog (Phase 56.1).
// ---------------------------------------------------------------------------

function TransactionRow({
  tx,
  onClick,
  selected,
  onToggleSelected,
  advancedView = false,
  onConfirm,
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
  /** Phase 49 — "✓ Looks right": confirm the AI's category for this row. */
  onConfirm?: () => void;
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

  // Phase 49.12 (Reza, live test 2026-06-11) — the category pill ITSELF
  // takes the confidence colour when the AI was uncertain: amber 0.7-0.9,
  // rose < 0.7. Confident rows (≥0.9 / user-confirmed 1.0) keep the calm
  // category tone — tinting 1,000+ confident rows would be chromatic noise
  // and would collide with emerald = money-positive (§18.7.2). The pill
  // colour replaces the Phase 49 confidence dot (redundant once tinted).
  // Phase 49.14 fix: the old `> 0` guard excluded score-0 rows (the AI
  // fallback writes confidence 0) — exactly the rows that most need the
  // rose tint. Reza caught these masquerading as confident category tones.
  const uncertain =
    tx.confidenceScore !== null && tx.confidenceScore < 0.9 && tx.userCorrectedCategory !== true;
  const lowBand = tx.confidenceScore !== null && tx.confidenceScore < 0.7;
  const showConfidence = advancedView && uncertain;
  // Phase 55 — the ONE derived status for this row: a single label (the
  // strongest signal — transfer/link wins over raw category) + at most one
  // action. Read from the SSOT so the row + header can't disagree (§12.2).
  const rowStatus = deriveRowStatus({
    categoryLevel1: tx.categoryLevel1,
    isTransfer: tx.isTransfer,
    incomeId: tx.incomeId,
    expenseId: tx.expenseId,
    userCorrectedCategory: tx.userCorrectedCategory,
  });
  const runAction = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (rowStatus.actionLabel === 'Confirm' && onConfirm) onConfirm();
    else onClick();
  };
  // Gem colour (mobile + desktop share this). Income → emerald (the one
  // positive highlight, §18.7.2). Spending → a NEUTRAL slate, NOT red/rose:
  // §18.7.2 reserves red for true loss/attention, and a wall of red debit rows
  // reads as constant alarm (behaviour-psychology — calm, not anxious). The
  // ↑/↓ arrow + the "−" sign already signal direction, so the gem stays calm.
  // Transfer → a LIGHTER slate so it's distinct from spend (the ⇄ icon is the
  // primary differentiator). Reza decision 2026-06-30 (indigo → slate): the
  // 4-lens review recommended a calm neutral over either indigo or red.
  const gemGradient = isTransfer
    ? 'bg-gradient-to-br from-slate-300 to-slate-500'
    : isIn
      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
      : 'bg-gradient-to-br from-slate-400 to-slate-600';
  const dotTone = rowStatus.done ? 'bg-emerald-500' : rowStatus.state === 'suggested' ? 'bg-sky-400' : 'bg-slate-300';
  let timeStr = '';
  try {
    timeStr = new Date(tx.date).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  } catch {
    timeStr = '';
  }
  // Phase 56.8b — short date for the desktop row's second line (real tx.date, §19).
  let dateShort = '';
  try {
    dateShort = new Date(tx.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  } catch {
    dateShort = '';
  }
  const confidenceLabel = lowBand ? 'Low confidence' : 'Medium confidence';
  const confidenceTone = lowBand ? 'text-rose-600' : 'text-amber-600';
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

  // Phase 42 PR6.5g — Gmail/Yahoo Mail-style swipe motion.
  // Drag range up to 280px so the action reveal feels substantive
  // (was 80px — too small to feel like anything happened). Past
  // 280px we apply rubber-band resistance so the row can't be flung
  // off-screen unexpectedly.
  const rawDx = swipe.state.dragX;
  const ABS_REVEAL = 280;
  const PRIMED = 120; // "ready to commit" visual threshold
  let dragOffset: number;
  if (rawDx >= 0) {
    dragOffset = rawDx > ABS_REVEAL ? ABS_REVEAL + (rawDx - ABS_REVEAL) * 0.15 : rawDx;
  } else {
    dragOffset = rawDx < -ABS_REVEAL ? -ABS_REVEAL + (rawDx + ABS_REVEAL) * 0.15 : rawDx;
  }
  // Reveal progress 0..1, used to drive opacity/scale of the action label.
  const revealProgress = Math.min(1, Math.abs(rawDx) / PRIMED);
  // True once the user has crossed the commit threshold — drives the
  // "primed" visual: brighter background + larger icon.
  const isPrimed = Math.abs(rawDx) >= PRIMED;
  const showLeftHint = swipe.state.direction === 'left' && Math.abs(rawDx) > SWIPE_THRESHOLD_PX / 4;
  const showRightHint = swipe.state.direction === 'right' && Math.abs(rawDx) > SWIPE_THRESHOLD_PX / 4;

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
      {/* Phase 42 PR6.5g — Gmail / Yahoo Mail-style action reveal.
          The action layer fills the entire row UNDER the content. Only
          the side matching the current swipe direction is rendered;
          opacity + label scale animate based on revealProgress (0..1).
          When primed (past commit threshold) the bg saturates + icon
          enlarges — visual cue the gesture is committed on release.
          Per CLAUDE.md §0 designer lens: the row content is the
          subject; the action layer is the chrome that earns its place
          only when the user is actively gesturing. */}
      {showLeftHint && (
        // Swiping LEFT (dragX negative) → row moves left → reveal RIGHT side
        // → action: "Categorise" (emerald)
        <div
          aria-hidden
          className={`absolute inset-y-0 right-0 flex items-center justify-end pr-5 sm:pr-7 pointer-events-none transition-colors duration-150 ${
            isPrimed ? 'bg-emerald-500' : 'bg-emerald-400/85'
          }`}
          style={{ width: `${Math.abs(dragOffset)}px`, minWidth: 56 }}
        >
          <div
            className="flex items-center gap-2 text-white"
            style={{
              opacity: revealProgress,
              transform: `scale(${0.85 + revealProgress * 0.15})`,
              transition: 'transform 80ms ease-out',
            }}
          >
            <span className="text-sm font-semibold tracking-tight">Categorise</span>
            <Sparkles className={`shrink-0 ${isPrimed ? 'w-5 h-5' : 'w-4 h-4'} transition-all duration-150`} />
          </div>
        </div>
      )}
      {showRightHint && (
        // Swiping RIGHT (dragX positive) → row moves right → reveal LEFT side
        // → action: "Transfer" (sky/blue)
        <div
          aria-hidden
          className={`absolute inset-y-0 left-0 flex items-center justify-start pl-5 sm:pl-7 pointer-events-none transition-colors duration-150 ${
            isPrimed ? 'bg-sky-500' : 'bg-sky-400/85'
          }`}
          style={{ width: `${Math.abs(dragOffset)}px`, minWidth: 56 }}
        >
          <div
            className="flex items-center gap-2 text-white"
            style={{
              opacity: revealProgress,
              transform: `scale(${0.85 + revealProgress * 0.15})`,
              transition: 'transform 80ms ease-out',
            }}
          >
            <ArrowLeftRight className={`shrink-0 ${isPrimed ? 'w-5 h-5' : 'w-4 h-4'} transition-all duration-150`} />
            <span className="text-sm font-semibold tracking-tight">Transfer</span>
          </div>
        </div>
      )}

      {/* Phase 56 — bulk-select checkbox is desktop-only (hidden md:flex). On
          mobile it was the biggest contributor to the cramped row and isn't in
          the redesign; bulk-select stays a desktop/tablet power action. A
          long-press selection mode is the mobile-native fast-follow. */}
      <label
        className="hidden md:flex items-center justify-center w-11 self-stretch shrink-0 cursor-pointer hover:bg-muted/60 transition-colors"
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
          // Phase 42 PR6.5g — Apple-style spring-back on release.
          // Custom cubic-bezier mimics a light-mass spring: slight
          // overshoot then settle. Feels more "alive" than ease-out.
          transition: swipe.state.isDragging
            ? 'none'
            : 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          touchAction: 'pan-y', // allow vertical scroll; we own horizontal
        }}
        className="flex-1 text-left px-3 sm:px-4 md:px-5 py-3 sm:py-3.5 md:py-4 hover-lift bg-card"
      >
      {/* ===================================================================
          MOBILE BODY (< md) — Phase 56 redesign. Apple-Wallet restraint:
          44px gradient gem + unreviewed dot, one clean name line, one quiet
          "category · time" line, a LOCKED right-aligned amount column, and a
          trailing 44px one-tap action lane (✓ Confirm when the AI proposed a
          category; + Add when it's uncategorised). Fixes the cramped reflow
          (issue 2) and the missing on-row Confirm (issue 3). Stitch screens
          1e164f52…/fa5445ad… (project 4167588157712714472, §18.8 9.4/10).
          =================================================================== */}
      <div className="md:hidden flex items-center gap-3">
        {/* 44px gem + unreviewed dot (sky + white ring → reads on any gem) */}
        <div className="relative shrink-0">
          <div className={`flex items-center justify-center w-11 h-11 rounded-[14px] text-white shadow-sm ring-1 ring-black/5 ${gemGradient}`}>
            {isTransfer ? <ArrowLeftRight className="w-5 h-5" /> : isIn ? <ArrowDown className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
          </div>
          {!rowStatus.done && (
            <span aria-hidden className="absolute -top-0.5 -right-0.5 w-[11px] h-[11px] rounded-full bg-sky-300 ring-2 ring-card" />
          )}
        </div>
        {/* name + one quiet category · time line */}
        <div className="flex-1 min-w-0">
          {/* Phase 56.8c (Reza 2026-06-30) — min-w-0 on the name row so a long
              merchant name TRUNCATES instead of shoving the amount off the
              card's right edge (the amount was being clipped on mobile). */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-[15px] truncate text-foreground">{label}</span>
            {isLinked && <Link2 className="w-3 h-3 text-sky-600 shrink-0" aria-label="Linked" />}
            {tx.isRecurring && !isLinked && <Repeat className="w-3 h-3 text-sky-600 shrink-0" aria-label="Recurring" />}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotTone}`} aria-hidden />
            <span className="truncate">{rowStatus.label}</span>
            {timeStr && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums shrink-0">{timeStr}</span>
              </>
            )}
          </div>
        </div>
        {/* locked amount column — same right edge on every row */}
        <div className={`text-right tabular-nums font-semibold text-[15px] shrink-0 ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
          {isIn ? '+' : '-'}{formatCurrency(tx.amount, { currency: tx.currency })}
        </div>
        {/* trailing 44px action lane — reserved on every row so amounts stay
            column-aligned (done rows leave it empty). One-tap, opens nothing. */}
        <div className="w-11 shrink-0 flex items-center justify-center">
          {rowStatus.state === 'suggested' ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onConfirm ? onConfirm() : onClick(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onConfirm ? onConfirm() : onClick(); } }}
              aria-label={`Confirm ${rowStatus.label}`}
              title="Confirm the AI's category"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full border-[1.5px] border-sky-400/40 bg-sky-500/10 text-sky-600 dark:text-sky-300 active:scale-95 transition-transform"
            >
              <Check className="w-5 h-5" />
            </span>
          ) : rowStatus.state === 'needs-category' ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClick(); } }}
              aria-label="Add a category"
              title="Add a category"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-foreground/15 bg-muted/50 text-muted-foreground active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" />
            </span>
          ) : null}
        </div>
      </div>

      {/* ===================================================================
          DESKTOP BODY (md+) — unchanged from Phase 55. Bulk-select checkbox,
          inline confidence chrome, the one derived status + at-most-one
          action cluster, amount, chevron.
          =================================================================== */}
      <div className="hidden md:flex items-center gap-4 w-full">
      {/* Direction gem — Phase 56.8b cleaner refresh: a luminous 40px gradient
          gem (My-Wealth glass vocabulary, §18.7.2) replaces the flat tinted
          square; an unreviewed sky dot mirrors the mobile row. Visual only. */}
      <div className="relative shrink-0">
        <div className={`flex items-center justify-center w-10 h-10 rounded-[12px] text-white shadow-sm ring-1 ring-black/5 ${gemGradient}`}>
          {isTransfer ? <ArrowLeftRight className="w-[18px] h-[18px]" /> : isIn ? <ArrowDown className="w-[18px] h-[18px]" /> : <ArrowUp className="w-[18px] h-[18px]" />}
        </div>
        {!rowStatus.done && (
          <span aria-hidden className="absolute -top-0.5 -right-0.5 w-[10px] h-[10px] rounded-full bg-sky-400 ring-2 ring-card" />
        )}
      </div>

      {/* Main info — two clean lines: merchant, then "Account · Date" */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-medium text-[15px] truncate text-foreground">{label}</span>
          {isLinked && <Link2 className="w-3 h-3 text-sky-600 shrink-0" aria-label="Linked" />}
          {tx.isRecurring && !isLinked && <Repeat className="w-3 h-3 text-sky-600 shrink-0" aria-label="Recurring" />}
          {showAnomalyBadge && <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" aria-label={tx.anomalyFlags.join(', ')} />}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground truncate flex items-center gap-1.5">
          <span className="truncate">{tx.account.name}</span>
          {dateShort && (
            <>
              <span aria-hidden>·</span>
              <span className="shrink-0 tabular-nums">{dateShort}</span>
            </>
          )}
          {showConfidence && (
            <>
              <span aria-hidden>·</span>
              <span className={`shrink-0 ${confidenceTone}`}>{confidenceLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Phase 55 — ONE derived status per row (desktop): the strongest-signal
          label + AT MOST one action. Replaces the old "Looks right" chip + raw
          category pill + "Confirmed / Not confirmed yet" trio that contradicted
          each other (CLAUDE.md §12.2; design `PHASE_55_…`). */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
            rowStatus.state === 'needs-category'
              ? 'border-foreground/15 bg-muted/50 text-muted-foreground'
              : rowStatus.done
                ? 'border-foreground/10 bg-foreground/[0.04] text-muted-foreground'
                : getCategoryTone(rowStatus.label)
          }`}
        >
          {rowStatus.done && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
          {rowStatus.label}
        </span>
        {/* Neobrain suggestion (2026-06-27) — when this row needs a category
            and Neobrain has learned one for this merchant, show it as a
            one-tap "Suggested" pill (sky/indigo §18.7.2) instead of the
            generic "Add" action. Tapping opens the dialog pre-filled with the
            suggestion (the link GET already returns the same learned category),
            so the user confirms in one click — and the confirm auto-applies to
            any further uncategorised same-merchant rows. */}
        {rowStatus.state === 'needs-category' && tx.suggestedCategoryLevel1 ? (
          <span
            role="button"
            tabIndex={0}
            onClick={runAction}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') runAction(e);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 transition-colors shrink-0"
            aria-label={`Neobrain suggests ${tx.suggestedCategoryLevel1} — tap to apply`}
            title={`Neobrain suggests "${tx.suggestedCategoryLevel1}" from your past choices`}
          >
            <Sparkles className="w-3 h-3 opacity-80" />
            {tx.suggestedCategoryLevel1}
          </span>
        ) : rowStatus.actionLabel ? (
          <span
            role="button"
            tabIndex={0}
            onClick={runAction}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') runAction(e);
            }}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-500 shadow-[0_2px_8px_rgba(14,165,233,0.25)] hover:opacity-90 transition-opacity shrink-0"
            aria-label={`${rowStatus.actionLabel} — ${rowStatus.label}`}
            title={rowStatus.actionLabel === 'Confirm' ? "Confirm the AI's category" : 'Add a category'}
          >
            {rowStatus.actionLabel}
          </span>
        ) : null}
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <div className={`font-semibold tabular-nums text-[15px] ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
          {isIn ? '+' : '-'}{formatCurrency(tx.amount, { currency: tx.currency })}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors shrink-0" />
      </div>
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

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  // Defence in depth — `error` is *typed* as string but a stray
  // object slips through often enough (API error shape, network
  // exception with .toJSON, etc.) to crash the page with React
  // error #31. Coerce to a string here even if the prop is wrong.
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object'
        ? ((error as { message?: string }).message ??
          (error as { code?: string }).code ??
          'Something went wrong')
        : 'Something went wrong';
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-10 text-center anim-rise">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-rose-900">Something went wrong</h3>
      <p className="text-sm text-rose-700 mt-1">{message}</p>
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

// Wrap in Suspense for useSearchParams (Next.js 15 requirement) — mirrors
// /dashboard/balances/page.tsx.
export default function ActivityPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </DashboardLayout>
      }
    >
      <ActivityPageContent />
    </Suspense>
  );
}

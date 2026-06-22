'use client';

/**
 * Phase 52.5c — "Review categories" dedicated full-page triage inbox.
 *
 * The calm full-screen surface for clearing a categorisation backlog (the
 * inline Activity `ConfidenceReviewCard` is the entry point that deep-links
 * here). Reuses the existing, now-KB-wired endpoints — NO new endpoints:
 *   - GET  /api/unified-transactions/bulk-confirm        → confidence summary (header)
 *   - GET  /api/unified-transactions/review-queue?band=  → medium/low pending items
 *   - POST /api/unified-transactions/review-queue        → { action:'confirm'|'skip', reviewItemIds }
 * Every confirm flows through `confirmReviewItem` → `recordKbContribution`, so
 * confirming here teaches the shared categorisation KB (Phase 52.5c).
 *
 * Stitch-first (CLAUDE.md §18.2.1) — design source project 1859462351962811110:
 *   fdf91885 (desktop light, 9.2) / c31ae9ca (desktop dark, 9.4) /
 *   c203a7d7 (mobile light, 9.3) / 0fc7905b (mobile dark, 9.3) — all > 9 per the
 *   §18.8 gate. Artefacts: .stitch/designs/phase52/review-categories-inbox-v2*.{html,png}.
 *
 * Glass vocabulary per §18.7.2 — bg-card/70 + backdrop-blur-xl, 1px hairline,
 * 22px radii, sky→indigo brand gradient, emerald confirm, amber "needs a look".
 * Light/dark resolve via the editorial tokens (no hardcoded mode colours).
 * Behaviour-psychology: finishable "N% categorised — M to review" header,
 * celebratory "All caught up" empty state, never shame.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Sparkles, X, CircleAlert, CheckCircle2, Tag } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency } from '@/lib/utils/formatters';
import { TransactionLinkDialog } from '@/components/transactions/TransactionLinkDialog';

interface ReviewItem {
  id: string;
  date: string;
  amount: number;
  direction: 'IN' | 'OUT';
  description: string;
  merchant: string | null;
  aiCategoryLevel1: string | null;
  aiCategoryLevel2: string | null;
  aiConfidence: number | null;
  band: 'medium' | 'low';
}

interface ConfidenceSummary {
  high: number;
  highUnconfirmed: number;
  medium: number;
  low: number;
}

/**
 * Phase 52.5c-fix — booked transactions that still need a category. These are
 * real UnifiedTransactions (NOT staged review-queue items), so the queue-based
 * confirm/skip doesn't apply — each is categorised via the TransactionLinkDialog.
 * Without this the inbox showed "All caught up" while hundreds of uncategorised
 * booked rows sat in the list (the `txLow`/`txMedium` gap noted in
 * lib/bank/bulkConfirm.ts getConfidenceSummary). Shape matches the dialog's
 * `Transaction` prop. The `uncategorized=true` filter is the SSOT "needs review"
 * set (unlinked + userCorrectedCategory != true) — same definition behind the
 * Activity "Uncategorised" badge + Home pending-actions count.
 */
interface BookedTx {
  id: string;
  date: string;
  description: string;
  merchantStandardised?: string | null;
  amount: number;
  direction: 'IN' | 'OUT';
  categoryLevel1?: string | null;
  isRecurring?: boolean;
}

function formatDate(d: string): string {
  if (!d) return '';
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function categoryLabel(item: ReviewItem): string {
  if (!item.aiCategoryLevel1) return 'Uncategorised';
  return item.aiCategoryLevel2
    ? `${item.aiCategoryLevel1} › ${item.aiCategoryLevel2}`
    : item.aiCategoryLevel1;
}

export function ReviewCategoriesInbox() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<ConfidenceSummary | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Phase 52.5c-fix — booked uncategorised transactions (the txLow/txMedium gap).
  const [bookedItems, setBookedItems] = useState<BookedTx[]>([]);
  const [bookedTotal, setBookedTotal] = useState(0);
  const [linkTarget, setLinkTarget] = useState<BookedTx | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [sumRes, medRes, lowRes, bookedRes] = await Promise.all([
        fetch('/api/unified-transactions/bulk-confirm', { headers }),
        fetch('/api/unified-transactions/review-queue?band=medium', { headers }),
        fetch('/api/unified-transactions/review-queue?band=low', { headers }),
        // Phase 52.5c-fix — booked uncategorised transactions (the gap that made
        // the inbox say "All caught up" while the list held hundreds of them).
        fetch('/api/unified-transactions?uncategorized=true&limit=50', { headers }),
      ]);
      const [sumJson, medJson, lowJson, bookedJson] = await Promise.all([
        sumRes.json(),
        medRes.json(),
        lowRes.json(),
        bookedRes.json(),
      ]);
      if (sumRes.ok && sumJson.success) setSummary(sumJson.data);
      const med: ReviewItem[] = medRes.ok && medJson.success ? medJson.data.items : [];
      const low: ReviewItem[] = lowRes.ok && lowJson.success ? lowJson.data.items : [];
      const all = [...med, ...low];
      setItems(all);
      // Pre-select the medium (high-confidence) band — the bulk-confirm sweet spot.
      setSelected(new Set(med.map((i) => i.id)));
      if (bookedRes.ok && bookedJson.success) {
        setBookedItems(Array.isArray(bookedJson.data) ? bookedJson.data : []);
        setBookedTotal(bookedJson.pagination?.total ?? (Array.isArray(bookedJson.data) ? bookedJson.data.length : 0));
      } else {
        setBookedItems([]);
        setBookedTotal(0);
      }
    } catch {
      // Quiet — empty state covers the no-data path.
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const act = useCallback(
    async (action: 'confirm' | 'skip', ids: string[]) => {
      if (!token || ids.length === 0 || busy) return;
      setBusy(true);
      try {
        const res = await fetch('/api/unified-transactions/review-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action, reviewItemIds: ids }),
        });
        if (res.ok) await fetchAll();
      } finally {
        setBusy(false);
      }
    },
    [token, busy, fetchAll]
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = items.length > 0 && selected.size === items.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));

  // Header progress — share of this month's pile already settled. Phase
  // 52.5c-fix: the "to review" pile now includes booked uncategorised rows,
  // so the progress reflects the real backlog (not just the staging queue).
  const toReviewCount = items.length + bookedTotal;
  const { reviewed, total, pct } = useMemo(() => {
    const high = summary?.high ?? 0;
    const t = high + toReviewCount;
    return {
      reviewed: high,
      total: t,
      pct: t > 0 ? Math.round((high / t) * 100) : 100,
    };
  }, [summary, toReviewCount]);

  // ---- empty (caught up) state -------------------------------------------------
  if (!loading && items.length === 0 && bookedItems.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12 ring-1 ring-emerald-500/25">
          <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">All caught up</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Your financial story is up to date. Nice work keeping it clean.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Header — finishable progress */}
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          My Accounts
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Review categories</h1>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            <span className="bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text font-semibold text-transparent">
              {pct}% categorised
            </span>{' '}
            — {toReviewCount.toLocaleString('en-AU')} to review
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
            aria-label={`${reviewed} of ${total} categorised`}
          />
        </div>
      </header>

      {/* Staged AI predictions (queue items) — bulk confirm applies only here.
          Phase 52.5c-fix: heading + bar render only when there are staged items,
          so an empty "Select all" never shows when only booked rows remain. */}
      {items.length > 0 && (
        <>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Suggested by your AI bookkeeper
          </h2>
          <div className="mb-3 flex items-center justify-between rounded-[14px] border border-foreground/10 bg-card/70 px-4 py-3 backdrop-blur-xl">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-foreground/30 text-emerald-600 accent-emerald-600"
              />
              <span className="text-muted-foreground">
                {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
              </span>
            </label>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => act('confirm', Array.from(selected))}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirm {selected.size > 0 ? selected.size : ''}
            </button>
          </div>
        </>
      )}

      {/* Rows */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => {
            const isLow = item.band === 'low';
            const conf = item.aiConfidence != null ? Math.round(item.aiConfidence * 100) : null;
            return (
              <li
                key={item.id}
                className={`relative overflow-hidden rounded-[18px] border bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] transition ${
                  isLow ? 'border-amber-400/40' : 'border-foreground/10'
                }`}
              >
                {/* low-band "needs a look" left accent strip */}
                {isLow && <span className="absolute inset-y-0 left-0 w-[3px] bg-amber-400" />}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                    className="h-4 w-4 shrink-0 rounded border-foreground/30 text-emerald-600 accent-emerald-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {item.merchant || item.description || 'Transaction'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          isLow
                            ? 'bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-300'
                            : 'bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300'
                        }`}
                      >
                        {categoryLabel(item)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                            <CircleAlert className="h-3 w-3" /> Needs a look
                          </span>
                        ) : conf != null ? (
                          `${conf}% match`
                        ) : (
                          formatDate(item.date)
                        )}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {item.direction === 'IN' ? '+' : '-'}
                    {formatCurrency(Math.abs(item.amount))}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Confirm"
                      disabled={busy}
                      onClick={() => act('confirm', [item.id])}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-emerald-600 transition hover:bg-emerald-500/10 disabled:opacity-40 dark:text-emerald-400"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Skip"
                      disabled={busy}
                      onClick={() => act('skip', [item.id])}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 disabled:opacity-40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Phase 52.5c-fix — booked transactions that still need a category.
          Real UnifiedTransactions (not staged), so each is categorised via the
          TransactionLinkDialog (same v3 surface as the Activity list). This is
          the population the inbox previously ignored — the reason it showed
          "All caught up" while hundreds sat uncategorised. */}
      {!loading && bookedItems.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Needs a category{' '}
            <span className="text-muted-foreground/70">
              ({bookedTotal.toLocaleString('en-AU')})
            </span>
          </h2>
          <ul className="space-y-2.5">
            {bookedItems.map((tx) => (
              <li
                key={tx.id}
                className="relative overflow-hidden rounded-[18px] border border-foreground/10 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] transition"
              >
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {tx.merchantStandardised || tx.description || 'Transaction'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-foreground/10">
                        Uncategorised
                      </span>
                      <span className="text-[11px] text-muted-foreground">{formatDate(tx.date)}</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {tx.direction === 'IN' ? '+' : '-'}
                    {formatCurrency(Math.abs(tx.amount))}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkTarget(tx);
                      setLinkOpen(true);
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    Categorise
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {bookedTotal > bookedItems.length && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
              Showing the first {bookedItems.length} of {bookedTotal.toLocaleString('en-AU')}.
              Categorise these and refresh to see the rest.
            </p>
          )}
        </section>
      )}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground/70">
        <Sparkles className="h-3 w-3" />
        Confirming teaches your AI bookkeeper — similar transactions get filed automatically next time.
      </p>

      {/* v3 Link/categorise dialog for booked rows (Phase 51 redesign surface). */}
      <TransactionLinkDialog
        transaction={linkTarget}
        open={linkOpen}
        onOpenChange={(o) => {
          setLinkOpen(o);
          if (!o) setLinkTarget(null);
        }}
        onLinked={async () => {
          await fetchAll();
        }}
      />
    </div>
  );
}

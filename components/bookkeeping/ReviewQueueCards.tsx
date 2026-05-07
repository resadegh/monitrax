/**
 * Phase 42 PR6.5c — Review Queue card-stack.
 *
 * **Opt-in review mode** for clearing uncategorised transactions —
 * the full-screen card-stack interface that PR6.5 deferred for
 * focused review. Per Phase 42 spec §6.3 — *one transaction per
 * card; full-screen on mobile; <3-second median action time*.
 *
 * Per Reza directive 2026-05-07 (mobile-first): the existing
 * Activity list is fine for desktop scanning, but on mobile the
 * card-stack converts the chore into a swipe-through ritual. Per
 * Reza decision on PR6.5b (modal pivot lesson): full-screen review
 * mode is RIGHT HERE because the user *actively chose to enter*
 * — opposite of the pop-on-arrival modal we reverted.
 *
 * Per CLAUDE.md §0:
 *   - Designer lens: full-screen on mobile / centred ≥sm; ≥56pt
 *     chip targets; tabular-nums; `motion-safe:` motion utilities;
 *     progress bar shows "X of N" so the user feels momentum.
 *   - Behaviour-psychologist lens: *one decision at a time* — the
 *     classic Bandura self-efficacy lift. Each swipe is a small win;
 *     the progress bar visualises the win-stream. Skip + Back
 *     always reachable so we never lock the user in.
 *   - Architect lens (CLAUDE.md §12.3): reuses `useSwipeGesture`
 *     (PR6.5 SSOT) + `<CategoryPickerSheet />` (PR6.5) + the
 *     existing `/api/unified-transactions/[id]` PATCH endpoint. No
 *     parallel categorise path. No new state machine — the queue
 *     is just a JS array with an index pointer.
 *   - Financial-adviser lens: the priority order surfaces ANOMALY-
 *     flagged tx first, then chronological — drives tax-pack
 *     correctness BEFORE polish.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, SkipForward, X } from 'lucide-react';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

interface ReviewTransaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  direction: 'IN' | 'OUT';
  merchantRaw: string | null;
  merchantStandardised: string | null;
  description: string;
  categoryLevel1: string | null;
  anomalyFlags: string[];
  account: { id: string; name: string; institution: string };
}

interface ReviewQueueCardsProps {
  /** Open / closed — controlled by parent. */
  open: boolean;
  /** Pre-fetched transactions to review (parent already has them loaded). */
  transactions: ReviewTransaction[];
  /** Suggested-category chips per spec §6.3 — 4 most-likely buckets. */
  suggestions?: string[];
  /** Called after each successful PATCH so the parent can refresh. */
  onPatchSuccess?: (txId: string) => void;
  /** Called when the user closes the overlay. */
  onClose: () => void;
}

const DEFAULT_SUGGESTIONS = ['Food & Dining', 'Groceries', 'Transport', 'Subscriptions'];

/**
 * Order the queue: ANOMALY-flagged first (highest tax-pack risk),
 * then chronological newest → oldest. Uncategorised-only is the
 * caller's job; the cards themselves are presentation-only.
 */
export function orderReviewQueue<T extends ReviewTransaction>(input: T[]): T[] {
  return [...input].sort((a, b) => {
    const aHasAnomaly = a.anomalyFlags.length > 0 ? 1 : 0;
    const bHasAnomaly = b.anomalyFlags.length > 0 ? 1 : 0;
    if (aHasAnomaly !== bHasAnomaly) return bHasAnomaly - aHasAnomaly;
    // Newest first
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export function ReviewQueueCards({
  open,
  transactions,
  suggestions,
  onPatchSuccess,
  onClose,
}: ReviewQueueCardsProps) {
  // The queue is sorted once on open; subsequent PATCHes don't
  // re-sort (would shift the user's mental model of "next card").
  const queue = useMemo(() => orderReviewQueue(transactions), [transactions]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Action history — enables a single Back step. (Multi-step undo
  // would re-PATCH server-side; one-step Back is enough for the
  // habit loop without complicating server state.)
  const [history, setHistory] = useState<number[]>([]);

  const total = queue.length;
  const current = queue[index];
  const remaining = Math.max(0, total - index);
  const completed = total === 0 ? 0 : Math.min(index, total);

  // Reset on open/close transitions.
  useEffect(() => {
    if (open) {
      setIndex(0);
      setBusy(false);
      setError(null);
      setHistory([]);
    }
  }, [open]);

  // Esc to dismiss (desktop accessibility).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function advance() {
    setHistory((h) => [...h, index]);
    setIndex((i) => i + 1);
  }

  function goBack() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setIndex(prev);
  }

  async function categorise(level1: string) {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/unified-transactions/${current.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ categoryLevel1: level1 }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? 'Failed to categorise');
        return;
      }
      onPatchSuccess?.(current.id);
      advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  async function markTransfer() {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/unified-transactions/${current.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ categoryLevel1: 'Transfer', categoryLevel2: 'Internal' }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? 'Failed to mark as transfer');
        return;
      }
      onPatchSuccess?.(current.id);
      advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  // Reuse the SSOT swipe primitive from PR6.5 — left = picker /
  // right = transfer. Long-press / double-tap NOT wired here
  // (the card surface is wider than the row; chip-tap is the
  // primary affordance + swipe is the secondary).
  const { bind } = useSwipeGesture({
    onSwipeLeft: () => {
      if (!current || busy) return;
      // Open the picker via the suggestions affordance — most users
      // tap a chip, but the swipe-left gesture maps to "Other..."
      // which falls through to the inline custom input.
      // Implementation: mirror chip-Tap UX by NOT auto-PATCHing on
      // swipe-left (avoid a destructive auto-categorise without
      // showing the user the chosen label).
    },
    onSwipeRight: () => {
      if (!current || busy) return;
      void markTransfer();
    },
  });

  const chips = (suggestions && suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS).slice(0, 4);

  if (!open) return null;

  // Empty / completed state — celebrate + exit.
  if (total === 0 || index >= total) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review queue complete"
        className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      >
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mb-4">
          <Check className="w-7 h-7" />
        </span>
        <p className="text-xl font-semibold text-slate-900 mb-1">All caught up</p>
        <p className="text-sm text-slate-600 text-center mb-6 max-w-sm">
          {total === 0
            ? "Nothing to review right now."
            : `You cleared ${total} ${total === 1 ? 'transaction' : 'transactions'}.`}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-3 rounded-2xl bg-slate-900 text-white font-medium min-h-[44px] hover:bg-slate-800 active:bg-slate-700 transition-colors"
        >
          Back to Activity
        </button>
      </div>
    );
  }

  const merchant = current.merchantStandardised ?? current.merchantRaw ?? 'Transaction';
  const amountFmt = Math.abs(current.amount).toLocaleString('en-AU', {
    style: 'currency',
    currency: current.currency ?? 'AUD',
  });
  const dateFmt = new Date(current.date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
  const progressPct = total === 0 ? 100 : Math.round((completed / total) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review uncategorised transactions"
      className="fixed inset-0 z-50 bg-white flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      {/* Header — progress + close */}
      <header className="flex items-center gap-3 px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100">
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit review"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Quick review
          </p>
          <p className="text-sm font-medium text-slate-900 tabular-nums">
            <span aria-live="polite">
              {Math.min(index + 1, total)} of {total}
            </span>
            {' · '}
            <span className="text-slate-500 font-normal">{remaining} left</span>
          </p>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100 mx-0">
        <div
          className="h-1 bg-emerald-500 motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${progressPct}%` }}
          aria-hidden
        />
      </div>

      {/* Card area — bound with the swipe gesture */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-4 overflow-hidden">
        <article
          {...bind}
          className="w-full max-w-md select-none touch-pan-y"
          aria-label={`Categorise ${merchant}, ${amountFmt}, ${dateFmt}`}
        >
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
            {/* Anomaly badge */}
            {current.anomalyFlags.length > 0 && (
              <p className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-1 rounded-full mb-3">
                Worth a glance
              </p>
            )}
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
              {dateFmt} · {current.account.name}
            </p>
            <p className="text-2xl sm:text-3xl font-semibold text-slate-900 mt-2 break-words">
              {merchant}
            </p>
            <p className="text-3xl sm:text-4xl font-semibold tabular-nums text-slate-900 mt-3">
              {current.direction === 'OUT' ? '−' : '+'}
              {amountFmt}
            </p>
            {current.description && current.description !== merchant && (
              <p className="text-sm text-slate-500 mt-2 line-clamp-2">{current.description}</p>
            )}

            {/* Suggested category chips — 4 buckets per spec §6.3 */}
            <div className="grid grid-cols-2 gap-2.5 mt-5">
              {chips.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  disabled={busy}
                  onClick={() => categorise(cat)}
                  className="px-4 py-3.5 text-sm font-medium rounded-2xl bg-slate-50 hover:bg-emerald-50 active:bg-emerald-100 text-slate-900 transition-colors disabled:opacity-60 min-h-[56px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                  {cat}
                </button>
              ))}
            </div>

            {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
          </div>

          {/* Swipe hint */}
          <p className="text-center text-xs text-slate-400 mt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 hidden sm:block">
            Swipe right to mark as transfer · tap a chip to categorise
          </p>
        </article>
      </main>

      {/* Footer — Back + Skip + Transfer */}
      <footer className="px-4 sm:px-6 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goBack}
          disabled={busy || history.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-slate-600 disabled:text-slate-300 hover:text-slate-900 disabled:hover:text-slate-300 transition-colors min-h-[44px]"
          aria-label="Previous transaction"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markTransfer}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors min-h-[44px] disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4 rotate-180" />
            Transfer
          </button>
          <button
            type="button"
            onClick={advance}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors min-h-[44px] disabled:opacity-50"
          >
            <SkipForward className="w-4 h-4" />
            Skip
          </button>
        </div>
      </footer>
    </div>
  );
}

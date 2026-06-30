/**
 * Phase 42 PR6.5c — Review Queue card-stack.
 * Phase 56.2 (2026-06-30) — REDESIGNED to the signed "card-deck" (Reza
 * decision "A"): a finite, finishable triage deck you flip through like a
 * notebook. One transaction fills a large glass card; the tops of the next
 * cards peek behind it (the physical-stack "notebook" feel). Swipe right =
 * Confirm the AI's suggestion, swipe left = Recategorise (opens the picker);
 * explicit buttons do the same (swipe alone is undiscoverable). "X of N" +
 * a progress bar make it a finishable ritual; "all caught up" celebrates the
 * end. On mobile it is the DEFAULT landing when there's work to do (the parent
 * auto-opens it); the scannable list is always one tap away via "Skip to list".
 *
 * Stitch design (project 4167588157712714472, §18.8 9.4/10):
 *   light 0c621478890b437587d68b0a146158da · dark e0d2f869f1dc4e98a73002d66be650a7
 *   artefacts at .stitch/designs/phase56/review-deck-{light,dark}.{html,png}.
 *
 * Per CLAUDE.md §0 / architect-mode:
 *   - Designer lens: My-Wealth-Glass vocabulary — warm-ivory/navy ground,
 *     `bg-card/80 backdrop-blur-xl` cards, sky→indigo brand, emerald only for
 *     money-in + the Confirm action, tabular-nums, 1.5px Lucide icons.
 *   - Behaviour-psychologist lens: one decision per card (Bandura self-
 *     efficacy); the progress bar visualises the win-stream; finite + a
 *     celebration end-state; Skip + Back always reachable (never locked in).
 *   - Architect lens (§12.1/§12.3): REUSES `<CategoryPickerSheet />` (the
 *     Phase-56 Suggested hero) + the existing `/api/unified-transactions/[id]`
 *     PATCH — no parallel categorise path, no new endpoint. The queue is a JS
 *     array + an index pointer; framer-motion only animates the drag.
 *   - Financial-adviser lens: ANOMALY-flagged tx surface first (tax-pack risk
 *     before polish); no invented confidence % (§19) — we show the suggestion,
 *     never a fabricated score.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from 'framer-motion';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Check,
  ChevronLeft,
  Pencil,
  Sparkles,
  X,
} from 'lucide-react';
import { CategoryPickerSheet } from '@/components/bookkeeping/CategoryPickerSheet';
import { useAuth } from '@/lib/context/AuthContext';

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
  /** Phase 56.2 — Neobrain learned suggestion; powers one-tap Confirm. */
  suggestedCategoryLevel1?: string | null;
  isTransfer?: boolean;
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

/** Drag distance (px) past which a release commits the gesture. */
const COMMIT_THRESHOLD = 120;

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

function gemGradient(tx: ReviewTransaction): string {
  if (tx.isTransfer) return 'bg-gradient-to-br from-slate-400 to-slate-600';
  if (tx.direction === 'IN') return 'bg-gradient-to-br from-emerald-400 to-emerald-600';
  return 'bg-gradient-to-br from-sky-400 to-indigo-500';
}

function fmtAmount(tx: ReviewTransaction): string {
  return Math.abs(tx.amount).toLocaleString('en-AU', {
    style: 'currency',
    currency: tx.currency ?? 'AUD',
  });
}

export function ReviewQueueCards({
  open,
  transactions,
  suggestions,
  onPatchSuccess,
  onClose,
}: ReviewQueueCardsProps) {
  const { token } = useAuth();
  // The queue is sorted once on open; subsequent PATCHes advance by index
  // (we do NOT re-sort mid-session — that would shift "next card"). The parent
  // refreshes on close.
  const queue = useMemo(() => orderReviewQueue(transactions), [transactions]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Action history — enables a single Back step.
  const [history, setHistory] = useState<number[]>([]);

  // framer-motion drag for the front card.
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-7, 7]);
  const rightHintOpacity = useTransform(x, [0, COMMIT_THRESHOLD], [0, 1]);
  const leftHintOpacity = useTransform(x, [-COMMIT_THRESHOLD, 0], [1, 0]);

  const total = queue.length;
  const current = queue[index];
  const remaining = Math.max(0, total - index);
  const completed = total === 0 ? 0 : Math.min(index, total);

  // Reset on open transitions.
  useEffect(() => {
    if (open) {
      setIndex(0);
      setBusy(false);
      setError(null);
      setHistory([]);
      setPickerOpen(false);
    }
  }, [open]);

  // Snap the drag back to centre whenever the active card changes.
  useEffect(() => {
    x.set(0);
  }, [index, x]);

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
    if (!current || busy || !token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/unified-transactions/${current.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
    if (!current || busy || !token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/unified-transactions/${current.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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

  /** The AI's best guess for this card, if any (drives one-tap Confirm). */
  const suggestion = current?.suggestedCategoryLevel1 || current?.categoryLevel1 || null;

  function handleConfirm() {
    if (!current || busy) return;
    if (suggestion) void categorise(suggestion);
    // No suggestion to confirm → fall through to the picker so the user can
    // choose. (Never fabricate a category.)
    else setPickerOpen(true);
  }

  function handleRecategorise() {
    if (!current || busy) return;
    setPickerOpen(true);
  }

  function onDragEnd(_e: unknown, info: PanInfo) {
    if (busy) {
      animate(x, 0, { type: 'spring', stiffness: 320, damping: 28 });
      return;
    }
    const offset = info.offset.x;
    if (offset > COMMIT_THRESHOLD) {
      handleConfirm();
    } else if (offset < -COMMIT_THRESHOLD) {
      handleRecategorise();
    }
    animate(x, 0, { type: 'spring', stiffness: 320, damping: 28 });
  }

  if (!open) return null;

  // Empty / completed state — celebrate + exit (glass).
  if (total === 0 || index >= total) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review queue complete"
        className="fixed inset-0 z-50 bg-editorial-ivory flex flex-col items-center justify-center p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      >
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-4">
          <Check className="w-7 h-7" />
        </span>
        <p className="text-xl font-semibold text-foreground mb-1">All caught up</p>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
          {total === 0
            ? 'Nothing to review right now.'
            : `You cleared ${total} ${total === 1 ? 'transaction' : 'transactions'}.`}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-3 rounded-2xl bg-foreground text-background font-medium min-h-[44px] hover:opacity-90 active:opacity-80 transition-opacity"
        >
          Back to Activity
        </button>
      </div>
    );
  }

  if (!current) return null;

  const merchant = current.merchantStandardised ?? current.merchantRaw ?? current.description ?? 'Transaction';
  const dateFmt = new Date(current.date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const isIn = current.direction === 'IN';
  const progressPct = total === 0 ? 100 : Math.round((completed / total) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review uncategorised transactions"
      className="fixed inset-0 z-50 bg-editorial-ivory flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Header — close + progress + skip-to-list */}
      <header className="flex items-center gap-3 px-4 sm:px-6 pt-3 pb-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit review"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full text-muted-foreground hover:bg-muted active:bg-muted/80 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-semibold text-foreground">Review</p>
          <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {Math.min(index + 1, total)} of {total}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-sky-600 dark:text-sky-400 hover:opacity-80 transition-opacity shrink-0 min-h-[44px] px-1"
        >
          Skip to list
        </button>
      </header>

      {/* Progress bar (sky→indigo) */}
      <div className="h-1 bg-foreground/10 mx-4 sm:mx-6 rounded-full overflow-hidden">
        <div
          className="h-1 bg-gradient-to-r from-sky-500 to-indigo-500 motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${progressPct}%` }}
          aria-hidden
        />
      </div>

      {/* Card deck */}
      <main className="flex-1 flex items-center justify-center px-5 py-4 overflow-hidden">
        <div className="relative w-full max-w-md">
          {/* Peeking cards behind (the physical "stack") */}
          {index + 2 < total && (
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 mx-auto h-full rounded-[28px] border border-foreground/10 bg-card/40 backdrop-blur-xl"
              style={{ transform: 'translateY(-26px) scaleX(0.86)', opacity: 0.4 }}
            />
          )}
          {index + 1 < total && (
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 mx-auto h-full rounded-[28px] border border-foreground/10 bg-card/60 backdrop-blur-xl"
              style={{ transform: 'translateY(-13px) scaleX(0.93)', opacity: 0.65 }}
            />
          )}

          {/* Edge swipe hints (revealed by drag direction) */}
          <motion.div
            aria-hidden
            style={{ opacity: leftHintOpacity }}
            className="absolute left-0 top-1/2 -translate-y-1/2 -ml-1 flex items-center gap-1 rounded-r-2xl bg-slate-500 text-white pl-2 pr-3 py-2 text-xs font-semibold"
          >
            <Pencil className="w-3.5 h-3.5" /> Recategorise
          </motion.div>
          <motion.div
            aria-hidden
            style={{ opacity: rightHintOpacity }}
            className="absolute right-0 top-1/2 -translate-y-1/2 -mr-1 flex items-center gap-1 rounded-l-2xl bg-emerald-500 text-white pr-2 pl-3 py-2 text-xs font-semibold"
          >
            <Check className="w-3.5 h-3.5" /> Confirm
          </motion.div>

          {/* Front card — draggable */}
          <motion.article
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            style={{ x, rotate }}
            onDragEnd={onDragEnd}
            className="relative z-10 select-none touch-pan-y rounded-[28px] border border-foreground/10 bg-card/80 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.05),0_18px_50px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.05)] px-6 py-7"
            aria-label={`Categorise ${merchant}, ${fmtAmount(current)}, ${dateFmt}`}
          >
            {/* inner-top highlight */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[40%] rounded-t-[28px] bg-gradient-to-b from-white/40 dark:from-white/[0.06] to-transparent"
            />

            {/* gem + date */}
            <div className="relative flex items-start justify-between">
              <div className={`flex items-center justify-center w-14 h-14 rounded-[18px] text-white shadow-sm ring-1 ring-black/5 ${gemGradient(current)}`}>
                {current.isTransfer ? (
                  <ArrowLeftRight className="w-6 h-6" />
                ) : isIn ? (
                  <ArrowDown className="w-6 h-6" />
                ) : (
                  <ArrowUp className="w-6 h-6" />
                )}
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mt-1">
                {dateFmt}
              </span>
            </div>

            {/* anomaly flag */}
            {current.anomalyFlags.length > 0 && (
              <p className="relative inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full mt-3">
                Worth a glance
              </p>
            )}

            {/* merchant + amount */}
            <p className="relative text-[22px] leading-tight font-semibold text-foreground mt-4 truncate">
              {merchant}
            </p>
            <p
              className={`relative text-[40px] leading-none font-semibold tabular-nums mt-2 ${
                isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
              }`}
            >
              {isIn ? '+' : '−'}
              {fmtAmount(current)}
            </p>
            <p className="relative text-sm text-muted-foreground mt-1.5 truncate">
              {current.account.name}
            </p>

            {/* AI suggestion block */}
            {suggestion && (
              <div className="relative mt-5 rounded-2xl border border-sky-400/40 bg-sky-500/[0.08] px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" /> Suggested
                </p>
                <p className="flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                  <span className="text-base font-semibold text-foreground truncate">{suggestion}</span>
                </p>
              </div>
            )}

            {error && <p className="relative mt-3 text-xs text-rose-600">{error}</p>}
          </motion.article>
        </div>
      </main>

      {/* Action buttons — Recategorise · Confirm, then Skip / Back */}
      <footer className="px-6 pt-2 pb-5">
        <div className="flex items-center justify-center gap-10">
          <button
            type="button"
            onClick={handleRecategorise}
            disabled={busy}
            aria-label="Recategorise"
            title="Pick a different category"
            className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-foreground/15 bg-card text-foreground hover:bg-muted active:scale-95 transition-all disabled:opacity-50"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            aria-label={suggestion ? `Confirm ${suggestion}` : 'Add a category'}
            title={suggestion ? "Confirm the AI's category" : 'Add a category'}
            className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-full bg-emerald-600 dark:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 dark:hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-60"
          >
            <Check className="w-8 h-8" />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={goBack}
            disabled={busy || history.length === 0}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground disabled:opacity-40 hover:text-foreground transition-colors min-h-[44px]"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button
            type="button"
            onClick={advance}
            disabled={busy}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px] disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </footer>

      {/* Recategorise → the Phase-56 picker (Suggested hero). Reuses the
          canonical PATCH; on success we advance the deck (no double-PATCH). */}
      <CategoryPickerSheet
        open={pickerOpen}
        transactionId={current?.id ?? null}
        context={current ? { merchant, amount: current.amount } : null}
        suggestions={
          current?.suggestedCategoryLevel1 ? [current.suggestedCategoryLevel1] : suggestions
        }
        onClose={() => setPickerOpen(false)}
        onSuccess={() => {
          setPickerOpen(false);
          if (current) onPatchSuccess?.(current.id);
          advance();
        }}
        onMarkTransfer={() => {
          setPickerOpen(false);
          void markTransfer();
        }}
      />
    </div>
  );
}

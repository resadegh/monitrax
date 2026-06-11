/**
 * Phase 42 PR6.5 — Category picker bottom-sheet.
 *
 * Mobile-first bottom-sheet that opens after a left-swipe on a
 * transaction row. Shows the 4 most-likely category chips + a
 * free-form custom input. Per spec §6.3:
 *
 *   "Drag left > 40px → spending bottom-sheet picker slides up
 *    (4 most-likely categories)"
 *
 * Composes the existing `/api/unified-transactions/[id]` PATCH
 * endpoint — no parallel categorise path. Per CLAUDE.md §12.3.
 *
 * Per CLAUDE.md §0 designer lens — Apple-glass tile, 28px-radius
 * sheet, restrained motion (220ms ease-out spring-up), tabular-nums
 * on amounts, ≥44pt tap targets per Apple HIG.
 *
 * Per CLAUDE.md §0 behaviour-psychologist lens — every chip tap is
 * a single satisfying micro-action. The sheet auto-dismisses on
 * success with a toast-free flow (the row in the parent visually
 * "ticks" — that's the celebration).
 */

'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight, Loader2, X } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface CategoryPickerSheetProps {
  /** Open / closed state — controlled by parent. */
  open: boolean;
  /** Transaction id to categorise (PATCH target). */
  transactionId: string | null;
  /** Display label (merchant + amount) shown in the sheet header. */
  context: {
    merchant?: string | null;
    amount?: number;
  } | null;
  /** Suggested categories — caller may pass merchant-mapping-aware list. */
  suggestions?: string[];
  /** Called after the PATCH (or onPickOverride) succeeds. */
  onSuccess: (categoryLevel1: string) => void;
  onClose: () => void;
  /**
   * Phase 49.5 — when provided, the sheet does NOT PATCH a transaction;
   * it calls this instead (e.g. review-queue items, which aren't
   * transactions yet). Throw to surface an error in the sheet.
   */
  onPickOverride?: (categoryLevel1: string) => Promise<void>;
  /**
   * Phase 49.9 — "Mark as transfer" affordance (e.g. own-account
   * transfers like "R Sadeghtransfer"). Caller decides what that means:
   * review-queue items file as isTransfer; normal transactions route to
   * the TransferDestinationSheet.
   */
  onMarkTransfer?: () => void | Promise<void>;
}

const DEFAULT_SUGGESTIONS = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Subscriptions',
];

export function CategoryPickerSheet({
  open,
  transactionId,
  context,
  suggestions,
  onSuccess,
  onClose,
  onPickOverride,
  onMarkTransfer,
}: CategoryPickerSheetProps) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Phase 49.9 (Reza) — replace the free-text "Other category" with a
  // dropdown of the user's EXISTING categories (GET /api/categories).
  const [allCategories, setAllCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !token || allCategories.length > 0) return;
    let active = true;
    fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!active || !json) return;
        const list: { name?: string }[] = json.data?.categories ?? json.data ?? [];
        const names = Array.from(
          new Set(list.map((cat) => cat?.name).filter((n): n is string => typeof n === 'string' && n.length > 0))
        ).sort((a, b) => a.localeCompare(b));
        setAllCategories(names);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, token, allCategories.length]);

  // Reset transient state on close.
  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  // Close on Escape (desktop accessibility).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const chips = (suggestions && suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS).slice(0, 6);

  async function categorise(level1: string) {
    if (busy || !token) return;
    // Phase 49.5 — override path (review-queue items: not transactions yet).
    if (onPickOverride) {
      setBusy(true);
      setError(null);
      try {
        await onPickOverride(level1);
        onSuccess(level1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to categorise');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!transactionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/unified-transactions/${transactionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ categoryLevel1: level1 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to categorise');
        return;
      }
      onSuccess(level1);
      // Parent closes the sheet after `onSuccess`; we reset our local state via the open-effect.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const merchant = context?.merchant ?? 'Transaction';
  const amount = context?.amount;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close picker"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 animate-in fade-in duration-200"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Categorise ${merchant}`}
        className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-border rounded-t-3xl shadow-2xl px-4 sm:px-6 pt-3 pb-6 sm:pb-8 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-220"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-1 pb-2">
          <span className="block w-10 h-1 rounded-full bg-slate-300" aria-hidden />
        </div>

        {/* Header */}
        <header className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Categorise
            </p>
            <p className="text-base font-semibold text-foreground truncate mt-0.5">{merchant}</p>
            {amount !== undefined && (
              <p className="text-sm text-muted-foreground tabular-nums mt-0.5">
                {Math.abs(amount).toLocaleString('en-AU', {
                  style: 'currency',
                  currency: 'AUD',
                })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-11 h-11 rounded-full text-muted-foreground hover:bg-muted active:bg-muted/80 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Phase 49.9 — Mark as transfer (own-account movement, not
            income/expense). Rendered first when available: transfers are
            the most common "none of these categories fit" case. */}
        {onMarkTransfer && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onMarkTransfer();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to mark as transfer');
                setBusy(false);
                return;
              }
              setBusy(false);
            }}
            className="mb-4 flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium rounded-2xl border border-sky-500/30 bg-sky-500/[0.08] text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 transition-colors disabled:opacity-60 min-h-[52px]"
          >
            <ArrowLeftRight className="w-4 h-4" />
            It&apos;s a transfer between my accounts
          </button>
        )}

        {/* Suggestion chips — large mobile-first tap targets */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {chips.map((cat) => (
            <button
              key={cat}
              type="button"
              disabled={busy}
              onClick={() => categorise(cat)}
              className="px-4 py-3.5 text-sm font-medium rounded-2xl bg-muted hover:bg-muted/70 active:bg-muted/60 text-foreground transition-colors disabled:opacity-60 min-h-[52px] text-left"
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Phase 49.9 (Reza) — dropdown of the user's EXISTING categories
            (replaces the free-text "Other category" input). */}
        <div className="flex items-center gap-2">
          <select
            value=""
            disabled={busy || allCategories.length === 0}
            onChange={(e) => {
              if (e.target.value) categorise(e.target.value);
            }}
            className="flex-1 px-4 py-3 text-sm rounded-2xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40 min-h-[44px] disabled:opacity-60"
            aria-label="All categories"
          >
            <option value="" disabled>
              {allCategories.length === 0 ? 'Loading categories…' : 'All categories…'}
            </option>
            {allCategories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {busy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
        </div>

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      </div>
    </>
  );
}

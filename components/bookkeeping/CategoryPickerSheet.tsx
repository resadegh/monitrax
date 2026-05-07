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
import { Loader2, X } from 'lucide-react';

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
  /** Called after the PATCH succeeds. */
  onSuccess: (categoryLevel1: string) => void;
  onClose: () => void;
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
}: CategoryPickerSheetProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState('');

  // Reset transient state on close.
  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
      setCustom('');
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
    if (!transactionId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/unified-transactions/${transactionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

        {/* Custom — free-form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim().length > 0) categorise(custom.trim());
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Other category..."
            disabled={busy}
            className="flex-1 px-4 py-3 text-sm rounded-2xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40 min-h-[44px]"
          />
          <button
            type="submit"
            disabled={busy || custom.trim().length === 0}
            className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
            aria-label="Apply"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="text-base font-medium">Set</span>
            )}
          </button>
        </form>

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      </div>
    </>
  );
}

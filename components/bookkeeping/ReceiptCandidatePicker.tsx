/**
 * Phase 42 PR3.5 — Receipt candidate picker modal.
 *
 * Consumes the `PICK_FROM` verdict returned by
 * `/api/documents/analyze/confirm` (verdict shape comes from
 * `lib/bookkeeping/receiptMatcher.ts`). Shown when the matcher
 * found 2-5 plausible transactions (composite score 0.7–0.95) and
 * needs the user to disambiguate.
 *
 * UX (4-lens):
 *   - Architect — single endpoint (`POST /api/bookkeeping/receipts/pick-match`)
 *     for the link mutation; same SSOT helper as AUTO_LINK.
 *   - Financial adviser — surfaces date / amount / merchant / account
 *     per candidate so the user can verify against memory; no
 *     advice-shaped wording.
 *   - Behaviour psychologist — "Skip — none of these match" is a
 *     first-class option (creates a new RECEIPT-sourced row instead
 *     of forcing a link); composite score rendered as a coloured
 *     dot, not a percentage (numbers invite reverse-engineering).
 *   - Designer — Apple-quiet: rounded card, slate ink, emerald accent
 *     for top candidate, hover-lift on rows; ESC + click-outside to
 *     close; restraint on density.
 *
 * Per CLAUDE.md §13.3 — no balances or CDR data flow through the
 * picker beyond the transaction shape the user is already entitled
 * to see (their own UnifiedTransaction rows).
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Receipt, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { useAuth } from '@/lib/context/AuthContext';

/**
 * Subset of `ReceiptMatchResult` from `lib/bookkeeping/receiptMatcher.ts`
 * that the picker actually renders. Keeping it shaped narrowly lets
 * the route handler trim the JSON it sends back (smaller payload).
 */
export interface ReceiptPickerCandidate {
  transaction: {
    id: string;
    date: string;
    amount: number;
    description: string | null;
    merchantStandardised: string | null;
    accountId: string;
  };
  score: {
    composite: number; // 0–1
    dateScore: number;
    amountScore: number;
    vendorScore: number;
  };
}

interface ReceiptCandidatePickerProps {
  /** Pop-up visibility — parent owns the state. */
  open: boolean;
  /** Document being matched (the receipt). */
  documentId: string;
  /** Expense that was just created from the receipt. */
  expenseId: string;
  /** Candidates returned in the PICK_FROM verdict (already sorted by composite desc). */
  candidates: ReceiptPickerCandidate[];
  /** Closes without picking. Caller handles the "no match" branch. */
  onClose: () => void;
  /** Optional: called after a successful link so the parent can refresh. */
  onLinked?: (transactionId: string) => void;
}

export function ReceiptCandidatePicker({
  open,
  documentId,
  expenseId,
  candidates,
  onClose,
  onLinked,
}: ReceiptCandidatePickerProps) {
  const { token } = useAuth();
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handlePick = async (transactionId: string) => {
    setError(null);
    setPicking(transactionId);
    try {
      // Hotfix 2026-05-18: MUST pass Authorization header. Without it,
      // the endpoint returns 401, which `SessionExpiryHandler` treats
      // as "session is gone" and logs the user out.
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/bookkeeping/receipts/pick-match', {
        method: 'POST',
        headers,
        body: JSON.stringify({ documentId, expenseId, transactionId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? `Failed to link (${res.status})`);
        return;
      }
      onLinked?.(transactionId);
      onClose();
    } catch (err) {
      console.error('[ReceiptCandidatePicker] pick failed:', err);
      setError('Network error. Please try again.');
    } finally {
      setPicking(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl ring-1 ring-slate-200/60 dark:ring-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2">
              <Receipt aria-hidden className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Match this receipt to a transaction
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {candidates.length === 1
                  ? 'We found one possible match — does it look right?'
                  : `We found ${candidates.length} possible matches — pick the one that looks right.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        {/* Candidate list */}
        <div className="max-h-[60vh] overflow-y-auto">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {candidates.map((c, idx) => {
              const isTop = idx === 0;
              const isBusy = picking !== null;
              const isPickingThis = picking === c.transaction.id;
              const label = c.transaction.merchantStandardised || c.transaction.description || 'Unknown vendor';
              const date = formatShortDate(c.transaction.date);
              return (
                <li key={c.transaction.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(c.transaction.id)}
                    disabled={isBusy}
                    className={`group w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                      isBusy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <ConfidenceDot composite={c.score.composite} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {label}
                        </span>
                        {isTop && (
                          <span className="inline-flex items-center px-1.5 py-0 text-[10px] font-medium rounded-full bg-emerald-50 text-emerald-700">
                            Best match
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {date} · {formatCurrency(Math.abs(c.transaction.amount))}
                      </div>
                    </div>
                    {isPickingThis ? (
                      <span className="text-xs text-slate-400">Linking…</span>
                    ) : (
                      <Check
                        aria-hidden
                        className="h-4 w-4 text-slate-300 group-hover:text-emerald-600 transition-colors"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={picking !== null}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Skip — none of these match
          </button>
          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 truncate" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- private helpers ----

function ConfidenceDot({ composite }: { composite: number }) {
  // Three bands matching the matcher thresholds.
  //   ≥0.85 → emerald, 0.75–0.85 → sky, 0.7–0.75 → amber.
  // Threshold floor is 0.7 — anything below would have been NO_MATCH.
  const tone =
    composite >= 0.85
      ? 'bg-emerald-500'
      : composite >= 0.75
        ? 'bg-sky-500'
        : 'bg-amber-500';
  return (
    <span
      className={`shrink-0 h-2.5 w-2.5 rounded-full ${tone}`}
      aria-label={`Confidence ${(composite * 100).toFixed(0)} percent`}
      title={`Confidence ${(composite * 100).toFixed(0)}%`}
    />
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

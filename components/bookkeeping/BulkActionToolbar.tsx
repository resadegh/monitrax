/**
 * Phase 42 PR2 — Bulk action toolbar.
 *
 * Sticky-bottom strip on the Activity page that appears when one or
 * more transactions are selected. Single primary action at v1:
 * "Categorise N selected" — opens an inline category picker drawer
 * that POSTs to `/api/unified-transactions/bulk-categorise` with the
 * selected ids and the chosen category triple.
 *
 * Per Phase 42 spec §2 engagement principle: bulk re-categorise
 * exists so a user can clear "50 transactions to review" in two
 * clicks without sacrificing the audit trail. Per CLAUDE.md §12.3,
 * the toolbar uses the canonical bulk endpoint — it does NOT loop
 * the [id] PATCH route from the client.
 *
 * Mobile: full-width sticky strip, single primary CTA.
 * Desktop: pill-style centered floating toolbar with secondary
 * "Clear selection" link.
 */

'use client';

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';

interface BulkActionToolbarProps {
  selectedIds: Set<string>;
  onClear: () => void;
  /** Called after a successful bulk-categorise so the parent can refresh the list. */
  onCategorised: (updatedCount: number) => void;
  /**
   * Suggested category chips. Wired from the parent via the same
   * canonical taxonomy used elsewhere in the app. Power-user can use
   * the "Other..." inline input to type a free-form level1 — that
   * lazy-seeds the registry on the server.
   */
  suggestedCategories?: string[];
}

const DEFAULT_SUGGESTIONS = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Utilities',
  'Subscriptions',
  'Property',
  'Income',
  'Transfer',
];

export function BulkActionToolbar({
  selectedIds,
  onClear,
  onCategorised,
  suggestedCategories = DEFAULT_SUGGESTIONS,
}: BulkActionToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState('');

  if (selectedIds.size === 0) return null;
  const ids = Array.from(selectedIds);

  async function categorise(level1: string) {
    if (!level1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/unified-transactions/bulk-categorise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          transactionIds: ids,
          categoryLevel1: level1,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Bulk categorise failed');
        return;
      }
      onCategorised(json.data?.updatedCount ?? ids.length);
      setPickerOpen(false);
      setCustomCategory('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 sm:bottom-6 z-40 px-4 pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto">
        <div className="rounded-t-2xl sm:rounded-2xl border border-border bg-background/95 backdrop-blur-sm shadow-2xl overflow-hidden">
          {/* Header strip */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                {selectedIds.size}
              </span>
              <span className="text-sm font-medium">
                {selectedIds.size === 1 ? '1 transaction selected' : `${selectedIds.size} transactions selected`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!pickerOpen && (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
                >
                  Categorise →
                </button>
              )}
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear selection"
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Picker — slides into place when active */}
          {pickerOpen && (
            <div className="px-4 py-3.5 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Apply to all selected
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    disabled={busy}
                    onClick={() => categorise(cat)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-full bg-muted hover:bg-muted/70 transition-colors disabled:opacity-60"
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customCategory.trim().length > 0) categorise(customCategory.trim());
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Other category..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-full border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || customCategory.trim().length === 0}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Apply"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </button>
              </form>
              {error && <p className="text-xs text-rose-600">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

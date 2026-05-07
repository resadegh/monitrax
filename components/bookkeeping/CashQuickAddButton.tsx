/**
 * Phase 42 PR3 — Cash quick-add FAB.
 *
 * Floating action button (bottom-right on desktop, sticky-bottom-bar on
 * mobile) that opens a 3-field modal: amount, what, when. Tapping submit
 * POSTs to `/api/unified-transactions/cash` which idempotently creates
 * the user's CASH account on first use and writes the transaction.
 *
 * Per Phase 42 spec §2 engagement principle — this is the *3-second
 * cash log*. Designed for the sole-trader / market-seller / tradie
 * pulling their phone out at the till. Nothing optional renders by
 * default; advanced fields (date picker, category) live behind a
 * single "More" toggle. Defaults: today, OUT direction, no category.
 *
 * Bonus capability — a "Capture receipt" affordance routes the user
 * straight to the existing DME camera-upload flow (PWA `<input
 * capture>`). One-tap from intent ("I need to log this") to action.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X, Camera, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface CashQuickAddButtonProps {
  /** Called after a successful create so the parent can refresh. */
  onCreated?: () => void;
  /**
   * Optional handler for the "Capture receipt" affordance. If provided,
   * the button opens the camera flow instead of a file picker. Mobile
   * UAs that support the `capture` attribute treat the input the same
   * way; desktops fall back to the file dialog.
   */
  onCaptureReceipt?: (file: File) => void;
}

export function CashQuickAddButton({ onCreated, onCaptureReceipt }: CashQuickAddButtonProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form state — reset on each open
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('OUT');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryLevel1, setCategoryLevel1] = useState('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the amount field on open — every second saved matters
  useEffect(() => {
    if (open && !success && amountInputRef.current) {
      const t = setTimeout(() => amountInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, success]);

  function reset() {
    setAmount('');
    setDescription('');
    setDirection('OUT');
    setDate(new Date().toISOString().slice(0, 10));
    setCategoryLevel1('');
    setShowAdvanced(false);
    setError(null);
    setSuccess(false);
  }

  function handleClose() {
    setOpen(false);
    // Defer reset so the close animation isn't ugly
    setTimeout(reset, 180);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setError('Amount must be a positive number');
      return;
    }
    if (description.trim().length === 0) {
      setError('What was it for?');
      return;
    }
    if (!token) {
      setError('Not authenticated');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/unified-transactions/cash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: num,
          description: description.trim(),
          direction,
          date,
          ...(categoryLevel1.trim() ? { categoryLevel1: categoryLevel1.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Could not save');
        return;
      }
      // Engagement micro-celebration — quick green tick, then auto-close
      setSuccess(true);
      onCreated?.();
      setTimeout(handleClose, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  function handleCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onCaptureReceipt?.(file);
    handleClose();
    e.target.value = ''; // allow re-selection of the same file
  }

  return (
    <>
      {/* FAB — shown when modal is closed */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Quick add cash transaction"
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-30 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-xl hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Modal */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cash-add-title"
            className="fixed inset-x-4 sm:inset-x-auto sm:right-8 bottom-6 sm:bottom-8 z-50 sm:w-96 max-w-md mx-auto rounded-3xl bg-background border border-border shadow-2xl overflow-hidden anim-rise"
          >
            {success ? (
              <div className="px-6 py-10 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mb-3">
                  <Check className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium">Saved.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h2 id="cash-add-title" className="text-sm font-semibold">
                    Quick add
                  </h2>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close"
                    className="p-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Direction toggle */}
                <div className="flex rounded-full bg-muted p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setDirection('OUT')}
                    className={`flex-1 px-3 py-1.5 rounded-full transition-colors ${
                      direction === 'OUT' ? 'bg-rose-50 text-rose-700' : 'text-muted-foreground'
                    }`}
                  >
                    Spent
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('IN')}
                    className={`flex-1 px-3 py-1.5 rounded-full transition-colors ${
                      direction === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'text-muted-foreground'
                    }`}
                  >
                    Received
                  </button>
                </div>

                {/* Amount — big, focused, tabular-nums */}
                <label className="block">
                  <span className="sr-only">Amount</span>
                  <div className="flex items-baseline gap-1 px-1">
                    <span className="text-2xl font-semibold text-muted-foreground">$</span>
                    <input
                      ref={amountInputRef}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 bg-transparent text-3xl font-semibold tabular-nums focus:outline-none placeholder:text-muted-foreground/40"
                      required
                    />
                  </div>
                </label>

                {/* Description */}
                <input
                  type="text"
                  placeholder="What was it for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  required
                />

                {showAdvanced && (
                  <div className="space-y-2">
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Date
                      </span>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full mt-1 px-3 py-1.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Category (optional)
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. Food &amp; Dining"
                        value={categoryLevel1}
                        onChange={(e) => setCategoryLevel1(e.target.value)}
                        className="w-full mt-1 px-3 py-1.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </label>
                  </div>
                )}

                {!showAdvanced && (
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(true)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    + Date · category
                  </button>
                )}

                {error && <p className="text-xs text-rose-600">{error}</p>}

                <div className="flex items-center gap-2 pt-1">
                  {/* PWA camera capture — short-circuits to the receipt
                      upload flow. `capture="environment"` opens the
                      back camera on mobile; desktop falls through to
                      the file dialog. */}
                  <label
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    title="Capture receipt instead"
                  >
                    <Camera className="w-4 h-4" />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraChange}
                      className="sr-only"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity inline-flex items-center justify-center gap-1.5"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </>
  );
}

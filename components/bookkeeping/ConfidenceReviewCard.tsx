'use client';

/**
 * Phase 56.7 — the state-aware "Review" tile (Reza-approved 2026-06-30).
 *
 * The protagonist of the Activity hub. Its COLOUR carries the state so the user
 * reads where they stand in half a second (behaviour-psychology, §0):
 *   • AMBER  "action needed"  — when there are transactions to review. Warm and
 *            motivating ("101 transactions to categorise"), never a red alarm.
 *   • EMERALD "all caught up"  — when the pile is clear. Calm, celebratory, a
 *            quiet reward for being done; offers the optional next thing (import).
 *
 * SSOT (§12.2.1 / §56.3): reads the ONE canonical review count — `reviewCount`
 * from /api/unified-transactions/bulk-confirm (= the unconfirmed, all-time pile
 * the Home tile, the chips and the inbox all read). This kills the old
 * confidence-summary framing ("365 sorted / 253 low") that diverged from 101.
 *
 * Progress is REAL (§19 — never fabricated): pct categorised =
 *   (categorisableTotal − reviewCount) / categorisableTotal.
 *
 * Glass vocabulary §18.7.2 — rounded-[28px] hero, bg-card/70 + backdrop-blur-xl,
 * 3px gradient top-accent, layered float shadow, 1px inner-top highlight,
 * luminous solid-gradient gem, tabular-nums, 1.5px Lucide icons.
 *
 * Stitch sign-off (§18.8, 9.3/10): project 1859462351962811110, state sheet
 * screen 75395671e5264c83911c4c0d2531a741 (.stitch/designs/phase56/).
 *
 * NOTE (Phase 56.7 scope) — the amber "Statement import due" trigger from the
 * approved design is NOT wired here: its cadence is unconfirmed, and §19 forbids
 * inventing a signal. It lands in the immediate follow-up against real
 * ImportBatch data once Reza picks the cadence. Both states still surface an
 * import affordance (the emerald state's ghost CTA).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Inbox, Loader2, Upload } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface ReviewSnapshot {
  /** The ONE canonical "needs your review" count (unconfirmed, all-time). */
  reviewCount: number;
  /** Non-transfer, non-investment transactions — the % denominator. */
  categorisableTotal: number;
  /** High-confidence auto-filed rows the user hasn't signed off (power action). */
  highUnconfirmed: number;
}

export function ConfidenceReviewCard({
  refreshKey,
  onStartReview,
  onImport,
  onConfirmed,
}: {
  /** Bump to re-fetch (e.g. after an import or a categorise). */
  refreshKey?: number;
  /** Primary CTA — the parent routes it (deck on mobile, inbox on desktop). */
  onStartReview: () => void;
  /** Optional next action in the caught-up state — open the import flow. */
  onImport?: () => void;
  /** After a bulk-confirm so the parent can refresh its list. */
  onConfirmed?: (count: number) => void;
}) {
  const { token } = useAuth();
  const [snap, setSnap] = useState<ReviewSnapshot | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fetchSnapshot = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/unified-transactions/bulk-confirm', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSnap({
          reviewCount: json.data.reviewCount ?? 0,
          categorisableTotal: json.data.categorisableTotal ?? 0,
          highUnconfirmed: json.data.highUnconfirmed ?? 0,
        });
      }
    } catch {
      // Quiet — the tile simply doesn't render without a snapshot.
    }
  }, [token]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot, refreshKey]);

  const confirmHigh = useCallback(async () => {
    if (!token || confirming) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/unified-transactions/bulk-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ band: 'high' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onConfirmed?.(json.data.confirmedCount ?? 0);
        await fetchSnapshot();
      }
    } catch {
      // Leave the tile as-is; the user can retry.
    } finally {
      setConfirming(false);
    }
  }, [token, confirming, onConfirmed, fetchSnapshot]);

  if (!snap) return null;

  const { reviewCount, categorisableTotal, highUnconfirmed } = snap;
  // Real progress — never fabricated (§19). No categorisable tx yet → 100% (clean slate).
  const categorisedPct =
    categorisableTotal > 0
      ? Math.round(((categorisableTotal - reviewCount) / categorisableTotal) * 100)
      : 100;

  // ── EMERALD: all caught up ───────────────────────────────────────────────
  if (reviewCount === 0) {
    return (
      <section className="relative mb-6 overflow-hidden rounded-[28px] border border-emerald-500/15 bg-gradient-to-br from-emerald-50/40 to-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_36px_rgba(15,23,42,0.08)] dark:from-emerald-500/[0.06] dark:to-card/70 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)] anim-rise">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 to-emerald-600" />
        <div className="pointer-events-none absolute inset-x-0 top-[3px] h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                All caught up
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">You&apos;re up to date</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Everything&apos;s reviewed — nothing needs you right now.
              </p>
            </div>
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-emerald-500/10" aria-hidden>
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: '100%' }} />
          </div>
          <div className="mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">100% categorised</div>
          {onImport && (
            <button
              type="button"
              onClick={onImport}
              className="mt-4 inline-flex items-center gap-2 rounded-[14px] border border-foreground/15 bg-background/50 px-4 py-2 text-sm font-medium text-foreground backdrop-blur transition hover:bg-muted"
            >
              <Upload className="h-4 w-4" />
              Import a statement
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>
    );
  }

  // ── AMBER: action needed ─────────────────────────────────────────────────
  return (
    <section className="relative mb-6 overflow-hidden rounded-[28px] border border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_36px_rgba(15,23,42,0.08)] dark:from-amber-500/[0.08] dark:to-card/70 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)] anim-rise">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 to-orange-500" />
      <div className="pointer-events-none absolute inset-x-0 top-[3px] h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4 min-w-0">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25">
              <Inbox className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                Needs your review
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text tabular-nums text-transparent">
                  {reviewCount.toLocaleString('en-AU')}
                </span>{' '}
                {reviewCount === 1 ? 'transaction to categorise' : 'transactions to categorise'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirm or fix each one — it teaches your bookkeeper for next time.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onStartReview}
            className="hidden shrink-0 items-center gap-2 rounded-[14px] bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:opacity-95 active:scale-[0.99] sm:inline-flex"
          >
            Start review
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="font-medium text-amber-700 dark:text-amber-300">{categorisedPct}% categorised</span>
          <span className="tabular-nums text-muted-foreground">{reviewCount.toLocaleString('en-AU')} remaining</span>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-amber-500/10" aria-hidden>
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-500"
            style={{ width: `${Math.max(categorisedPct, 2)}%` }}
          />
        </div>

        {/* Mobile CTA (full-width) + the optional power action */}
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onStartReview}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:opacity-95 active:scale-[0.99] sm:hidden"
          >
            Start review
            <ArrowRight className="h-4 w-4" />
          </button>
          {highUnconfirmed > 0 && (
            <button
              type="button"
              onClick={confirmHigh}
              disabled={confirming}
              className="inline-flex items-center justify-center gap-1.5 rounded-[14px] border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-2 text-sm font-medium text-emerald-700 backdrop-blur transition hover:bg-emerald-500/15 disabled:opacity-60 dark:text-emerald-300"
            >
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm {highUnconfirmed.toLocaleString('en-AU')} auto-filed
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

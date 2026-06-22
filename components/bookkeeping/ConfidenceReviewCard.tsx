'use client';

/**
 * Phase 49 — "Your AI bookkeeper" confidence review card.
 *
 * The protagonist of the redesigned Activity page: shows how the AI sorted
 * the user's transactions by confidence band and offers ONE clear action per
 * band — high is auto-filed (a quiet receipt), medium gets one-tap
 * "Confirm all", low routes into the per-row review flow.
 *
 * Stitch design source (CLAUDE.md §18.4): project 1859462351962811110,
 * screens 351c6db2f6f34996a93da26f60c47a2b (desktop light) /
 * c86cfc05ff8d4a129bc1c608d7748a55 (desktop dark) /
 * 1f2e9df37c16409c99a448871ff69277 (mobile light) /
 * fa6a2ea95aab4679be793c2cc8144927 (mobile dark).
 * Artefacts: .stitch/designs/activity-redesign/.
 *
 * Glass vocabulary per CLAUDE.md §18.7.2 — 28px hero radius, bg-card/70 +
 * backdrop-blur-xl, 3px sky→indigo top-accent, layered float shadow.
 * Behaviour-psychology: celebratory framing ("74% filed automatically"),
 * never shame; the helper line makes the learning payoff explicit.
 *
 * Self-hides when there is nothing to confirm (medium + low = 0) — the card
 * earns its place only while there is a pile to clear.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface ConfidenceSummary {
  high: number;
  /** Phase 49.13 — high rows the user hasn't signed off yet. */
  highUnconfirmed: number;
  medium: number;
  low: number;
}

export function ConfidenceReviewCard({
  refreshKey,
  onConfirmed,
  onReviewBand,
}: {
  /** Bump to re-fetch the summary (e.g. after an import or bulk action). */
  refreshKey?: number;
  /** Called after a successful bulk confirm so the parent can refresh its list. */
  onConfirmed?: (count: number) => void;
  /** Open the item-level review surface for a band (Phase 49.4). */
  onReviewBand?: (band: 'medium' | 'low') => void;
}) {
  const { token } = useAuth();
  const [summary, setSummary] = useState<ConfidenceSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState<number | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/unified-transactions/bulk-confirm', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) setSummary(json.data);
    } catch {
      // Quiet — the card simply doesn't render without a summary.
    }
  }, [token]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshKey]);

  const confirmBand = useCallback(
    async (band: 'high' | 'medium' | 'low') => {
      if (!token || confirming) return;
      setConfirming(true);
      try {
        const res = await fetch('/api/unified-transactions/bulk-confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ band }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setJustConfirmed(json.data.confirmedCount);
          onConfirmed?.(json.data.confirmedCount);
          await fetchSummary();
        }
      } catch {
        // Leave the card as-is; the user can retry.
      } finally {
        setConfirming(false);
      }
    },
    [token, confirming, onConfirmed, fetchSummary]
  );

  if (!summary) return null;

  const { high, highUnconfirmed, medium, low } = summary;
  const total = high + medium + low;
  // Phase 49.13 — unconfirmed HIGH rows are pending work too (auto-filed
  // is not confirmed; they still count toward the Home "to categorise"
  // pile until signed off).
  const pending = medium + low + highUnconfirmed;

  // Nothing sorted yet, or everything already confirmed → stay out of the way.
  if (total === 0 || (pending === 0 && justConfirmed === null)) return null;

  const pct = (n: number) => (total > 0 ? Math.max(n > 0 ? 2 : 0, (n / total) * 100) : 0);
  const highShare = total > 0 ? Math.round((high / total) * 100) : 0;

  return (
    <section
      className="relative mb-6 overflow-hidden rounded-[28px] border border-foreground/10 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)] anim-rise"
    >
      {/* 3px sky→indigo top-accent strip (§18.7.2 tile anatomy) */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 to-indigo-500" />
      {/* 1px inner-top curved-glass highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-[3px] h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />

      <div className="relative p-5 sm:p-6">
        {pending > 0 ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
                  Your AI bookkeeper sorted {total.toLocaleString('en-AU')} transactions
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {highShare}% filed automatically — nice and tidy
                </p>
                {/* Phase 52.5c — deep-link into the dedicated full-page triage
                    inbox for clearing the whole pile calmly. */}
                <Link
                  href="/dashboard/activity/review"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 transition hover:gap-1.5 dark:text-sky-300"
                >
                  Open review inbox
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <span className="hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-[14px] bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-lg shadow-indigo-500/20 shrink-0">
                <Sparkles className="w-5 h-5" />
              </span>
            </div>

            {/* Segmented confidence bar */}
            <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-foreground/5" aria-hidden>
              <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${pct(high)}%` }} />
              <div className="bg-amber-400 transition-all duration-500" style={{ width: `${pct(medium)}%` }} />
              <div className="bg-rose-400 transition-all duration-500" style={{ width: `${pct(low)}%` }} />
            </div>

            {/* Band actions — Phase 49.12 (Reza, live test 2026-06-11): all
                THREE bands always render, each in its band colour (matching
                the segmented bar above), so the row can never be misread as
                mislabeled when one band is empty. High = emerald receipt;
                medium = amber with the bulk "Confirm all" (49.10 rule: bulk
                confirm is medium-only); low = rose, review-only. Empty bands
                show a quiet zero chip instead of disappearing. */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2.5">
              {highUnconfirmed > 0 ? (
                // Phase 49.13 — auto-filed ≠ confirmed. One tap signs off the
                // whole high band (the AI was ≥90% sure on every one) and
                // clears them from the Home "to categorise" pile.
                <button
                  type="button"
                  onClick={() => confirmBand('high')}
                  disabled={confirming}
                  className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60 w-full sm:w-auto"
                >
                  {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirm all {highUnconfirmed.toLocaleString('en-AU')} high
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-500/12 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/25">
                  <Check className="w-3.5 h-3.5" />
                  {high.toLocaleString('en-AU')} high — confirmed
                </span>
              )}
              {medium > 0 ? (
                <div className="flex items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={() => confirmBand('medium')}
                    disabled={confirming}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60 sm:flex-none"
                  >
                    {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Confirm all {medium.toLocaleString('en-AU')} medium
                  </button>
                  <button
                    type="button"
                    onClick={() => onReviewBand?.('medium')}
                    className="inline-flex items-center justify-center rounded-[14px] border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 backdrop-blur transition hover:bg-amber-500/15"
                  >
                    Review
                  </button>
                </div>
              ) : (
                <span className="inline-flex items-center self-start rounded-full bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-muted-foreground/70 ring-1 ring-foreground/10">
                  0 medium — nothing waiting
                </span>
              )}
              {low > 0 ? (
                <button
                  type="button"
                  onClick={() => onReviewBand?.('low')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-[14px] border border-rose-500/30 bg-rose-500/[0.08] px-4 py-2 text-sm font-medium text-rose-700 dark:text-rose-300 transition hover:bg-rose-500/15 w-full sm:w-auto"
                >
                  Review {low.toLocaleString('en-AU')} low
                </button>
              ) : (
                <span className="inline-flex items-center self-start rounded-full bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-muted-foreground/70 ring-1 ring-foreground/10">
                  0 low — nothing waiting
                </span>
              )}
            </div>

            <p className="mt-3 text-xs text-muted-foreground/80">
              Confirming teaches your AI — the next import gets smarter. Low-confidence items are
              best reviewed before you confirm them.
            </p>
          </>
        ) : (
          // Post-confirm receipt: a calm one-liner, then the card self-hides on next mount.
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-[12px] bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 shrink-0">
              <Check className="w-4.5 h-4.5" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                {justConfirmed?.toLocaleString('en-AU')} categorisations confirmed
              </p>
              <p className="text-xs text-muted-foreground">
                Your AI just got smarter for the next import.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

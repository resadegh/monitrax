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
import { Check, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface ConfidenceSummary {
  high: number;
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
    async (band: 'medium' | 'low') => {
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

  const { high, medium, low } = summary;
  const total = high + medium + low;
  const pending = medium + low;

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

            {/* Band actions — stacked on mobile (primary full-width on top), inline on desktop */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="order-2 sm:order-1 flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/25">
                  <Check className="w-3.5 h-3.5" />
                  {high.toLocaleString('en-AU')} high — auto-filed
                </span>
              </div>
              {medium > 0 && (
                <div className="order-1 sm:order-2 flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => confirmBand('medium')}
                    disabled={confirming}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60 sm:flex-none"
                  >
                    {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Confirm all {medium.toLocaleString('en-AU')} medium
                  </button>
                  <button
                    type="button"
                    onClick={() => onReviewBand?.('medium')}
                    className="inline-flex items-center justify-center rounded-[14px] border border-foreground/10 bg-background/50 px-3 py-2.5 text-sm font-medium text-muted-foreground backdrop-blur transition hover:text-foreground hover:border-foreground/25"
                    title="Review the medium-confidence transactions before confirming"
                  >
                    Review
                  </button>
                </div>
              )}
              {low > 0 && (
                <button
                  type="button"
                  onClick={() => onReviewBand?.('low')}
                  className="order-3 inline-flex items-center justify-center gap-1.5 rounded-[14px] border border-foreground/10 bg-background/50 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur transition hover:border-foreground/25 w-full sm:w-auto"
                  title="Low-confidence — review each before confirming"
                >
                  Review {low.toLocaleString('en-AU')} low
                </button>
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

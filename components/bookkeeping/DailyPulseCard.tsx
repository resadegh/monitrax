/**
 * Phase 42 PR6 — Daily Pulse card.
 *
 * The **engagement front door** (spec §6.6). Lives on Home
 * (`/dashboard`), top of the page below the TRAIL banner. Single
 * card. Adaptive CTA. Streak badge ≥3-day. One-line anomaly
 * narrative below.
 *
 * Per Reza directive 2026-05-08: the card must INVITE not interrogate.
 * Lead with completion %, NEVER lead with the uncategorised count.
 *
 * Per Reza directive 2026-05-07 (mobile-first): users perform most
 * transaction activities on mobile. CTA tap target is ≥44pt (Apple
 * HIG); flex layout collapses gracefully at narrow widths; no
 * desktop-only hover affordances are load-bearing.
 *
 * Per CLAUDE.md §0 designer lens: Apple-glass tile, 28px radius,
 * tabular-nums on all figures, restrained motion, single primary CTA.
 * Per CLAUDE.md §0 behaviour-psychologist lens: warmth, no shame,
 * celebration when caught up.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { StreakBadge } from './StreakBadge';

interface DailyPulse {
  monthLabel: string;
  monthKey: string;
  totalCount: number;
  reviewedCount: number;
  toReviewCount: number;
  completionPct: number;
  streakLabel: string;
  streakCount: number;
  showStreakBadge: boolean;
  cta: { kind: 'CAUGHT_UP' | 'FEW' | 'MANY'; label: string; href: string };
  anomalyNarrative: string | null;
  celebrationFiredToday: boolean;
}

interface PulseResponse {
  success: boolean;
  data?: DailyPulse;
}

export function DailyPulseCard() {
  const [pulse, setPulse] = useState<DailyPulse | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch('/api/bookkeeping/engagement/pulse', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: 'include',
        });
        const json = (await res.json()) as PulseResponse;
        if (cancelled || !json.success || !json.data) return;
        setPulse(json.data);
        // Hide entirely for users with zero transactions in the
        // current month — surfacing "0 to review" feels presumptuous
        // for a brand-new user. They'll see the card the first time
        // they have something to do.
        if (json.data.totalCount === 0) setHidden(true);
      } catch {
        // Quiet failure — card simply doesn't render
        setHidden(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden || !pulse) return null;

  const isCaughtUp = pulse.cta.kind === 'CAUGHT_UP';

  return (
    <section
      aria-label="Today's pulse"
      className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 sm:p-6 shadow-sm"
    >
      {/* Top row — month label + streak badge */}
      <header className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Today's pulse — {pulse.monthLabel}
        </p>
        {pulse.showStreakBadge && <StreakBadge count={pulse.streakCount} />}
      </header>

      {/* Middle row — completion + CTA. Mobile-first layout: stacks
          vertically below `sm` breakpoint so the CTA gets a full-width
          tap target (Apple HIG ≥44pt). Side-by-side on tablet+. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          {isCaughtUp ? (
            <p className="text-lg sm:text-xl font-semibold text-emerald-700 inline-flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" aria-hidden />
              All caught up for {pulse.monthLabel}
            </p>
          ) : (
            <>
              <p className="text-lg sm:text-xl font-semibold text-slate-900">
                <span className="tabular-nums">{pulse.completionPct}%</span> caught up
              </p>
              <ProgressBar value={pulse.completionPct} />
            </>
          )}
        </div>

        {!isCaughtUp && (
          <Link
            href={pulse.cta.href}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 active:opacity-80 transition-opacity shrink-0 min-h-[44px] sm:min-h-0"
          >
            {pulse.cta.label.replace(' →', '')}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
        )}
      </div>

      {/* Bottom row — anomaly narrative */}
      {pulse.anomalyNarrative && (
        <p className="mt-3 pt-3 border-t border-slate-100 text-xs sm:text-sm text-slate-600 leading-relaxed">
          {pulse.anomalyNarrative}
        </p>
      )}
    </section>
  );
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

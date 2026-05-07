/**
 * Phase 42 PR6 — Completion celebration.
 *
 * Per spec §6.5 — when the user clears the last transaction in the
 * Review queue:
 *
 *   ✓ Hero scales in (large emerald check)
 *   🎉 Single confetti burst (60 particles, 1.2s, ONCE PER DAY MAX
 *      so scarcity preserves the delight)
 *   📋 Toast slides in: "October's a wrap. ✓ Tax pack ready when
 *      you are." with a "View pack →" tap target
 *   🔄 Background: BookkeepingPeriod.status flips to REVIEWED if not
 *      already
 *
 * Per CLAUDE.md §0 designer lens: the confetti is hand-rolled (no
 * new dep). `prefers-reduced-motion` skips the animation entirely.
 *
 * Caller usage:
 *   - Mount the component once on the Activity page (or anywhere
 *     categorisation completes).
 *   - When the toReviewCount hits 0 and the previous render was >0,
 *     call `<CompletionCelebration trigger={fireKey} />` with a
 *     bumped `fireKey` (e.g. Date.now()).
 *   - The component itself calls `POST /streak?action=celebrate` to
 *     gate the once-per-day rule — if the server says "already
 *     fired today" the celebration silently degrades to just the
 *     toast (no confetti).
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { Check, X } from 'lucide-react';

interface CompletionCelebrationProps {
  /** Bump this number to trigger a celebration. */
  trigger: number;
  monthLabel?: string;
}

export function CompletionCelebration({ trigger, monthLabel }: CompletionCelebrationProps) {
  const { token } = useAuth();
  const [active, setActive] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect reduced-motion preference once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Fire on trigger bump.
  useEffect(() => {
    if (trigger === 0) return;
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch('/api/bookkeeping/engagement/streak?action=celebrate', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const json = (await res.json()) as { success: boolean; data?: { fired: boolean } };
        if (cancelled) return;
        // Always show the toast; only fire confetti when the server
        // says it's the first celebration today. Scarcity rule.
        setActive(true);
        if (json.success && json.data?.fired && !reducedMotion) {
          setConfettiActive(true);
          // Auto-clear confetti after the burst.
          setTimeout(() => {
            if (!cancelled) setConfettiActive(false);
          }, 1500);
        }
        // Auto-dismiss the toast after 6 seconds.
        setTimeout(() => {
          if (!cancelled) setActive(false);
        }, 6000);
      } catch {
        // Quiet failure
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [trigger, reducedMotion, token]);

  if (!active) return null;

  return (
    <>
      {confettiActive && <ConfettiBurst />}
      <div
        role="status"
        aria-live="polite"
        className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-3 sm:px-4"
        style={{ animation: reducedMotion ? undefined : 'monitrax-celebration-slide-in 360ms ease-out' }}
      >
        {/* Mobile-first toast — full-width with safe-area-aware padding;
            View-pack link gets its own tap target row on narrow widths
            so the user doesn't have to thread the needle on a 4-column
            line. */}
        <div className="rounded-2xl bg-emerald-50/95 backdrop-blur-sm border border-emerald-200 shadow-2xl px-3 sm:px-4 py-3 flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 text-white shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-900">
              {monthLabel ? `${monthLabel}'s a wrap.` : 'All caught up.'}
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Your tax pack is ready when you are.{' '}
              <Link
                href="/dashboard/reports"
                className="font-medium underline underline-offset-2 hover:text-emerald-900 active:text-emerald-900 inline-block min-h-[24px]"
              >
                View pack →
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActive(false)}
            aria-label="Dismiss"
            className="inline-flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-full text-emerald-700/70 hover:text-emerald-900 hover:bg-emerald-100 active:bg-emerald-200 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <style jsx global>{`
        @keyframes monitrax-celebration-slide-in {
          from {
            opacity: 0;
            transform: translate(-50%, -16px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        @keyframes monitrax-confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(-20px) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translateY(60vh) rotate(540deg);
          }
        }
      `}</style>
    </>
  );
}

/**
 * 60-particle confetti burst. Hand-rolled — no new deps. CSS
 * keyframes drive the fall animation. ~1.2s total duration. Skips
 * entirely on prefers-reduced-motion (handled by the parent).
 */
function ConfettiBurst() {
  // Pre-generate particles once per render.
  const particles = Array.from({ length: 60 }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 250;
    const duration = 800 + Math.random() * 600;
    const colors = ['bg-emerald-400', 'bg-amber-400', 'bg-sky-400', 'bg-rose-400', 'bg-violet-400'];
    const color = colors[i % colors.length];
    const size = 6 + Math.random() * 6;
    return { left, delay, duration, color, size, key: i };
  });
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
    >
      {particles.map((p) => (
        <span
          key={p.key}
          className={`absolute top-0 ${p.color} rounded-sm`}
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animation: `monitrax-confetti-fall ${p.duration}ms ${p.delay}ms ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
}

'use client';

/**
 * FinalRevealStep — Phase 12 Track B (B.8)
 *
 * The aha moment. Reads fresh getMasterFinancialSnapshot via the
 * thin /api/onboarding/estimates/snapshot route and renders four
 * hero metrics with count-up animations staggered for impact.
 *
 * Per §8.4 of the twin-track plan — most important moment, visibly
 * stronger than every prior step:
 *   - Darker ambient background with subtle indigo glow
 *   - Hero net-worth number at 96-120px
 *   - Three secondary metrics below (monthly savings, debt, health grade)
 *   - One insight line ("At your current rate, you could save $X...")
 *   - Staggered entry animation (1600ms total, 200ms per metric)
 *   - "Continue setting up →" CTA routes to /dashboard/setup
 *
 * Also calls POST /api/onboarding/complete to mark the user's
 * onboardingCompleted flag so subsequent visits land on
 * /dashboard/setup directly.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useCountUp } from '@/components/onboarding/linear/hooks/useCountUp';

interface SnapshotData {
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyCashflow: number;
  totalLiabilities: number;
  healthGrade: string;
  healthScore: number;
}

function formatAUD(value: number, maxFractionDigits = 0): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: maxFractionDigits,
  }).format(Math.round(value));
}

export interface FinalRevealStepProps {
  onBack: () => void;
}

export function FinalRevealStep({ onBack }: FinalRevealStepProps) {
  const router = useRouter();
  const { token } = useAuth();
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Fetch the fresh snapshot on mount.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchSnapshot = async () => {
      try {
        const response = await fetch('/api/onboarding/estimates/snapshot', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('failed');
        const json = await response.json();
        if (!cancelled && json?.data) {
          setSnapshot(json.data);
        }
      } catch {
        if (!cancelled) setError('Could not load your financial picture.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchSnapshot();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleContinue = useCallback(async () => {
    setIsCompleting(true);
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Non-blocking — even if the mark-complete fails, route the
      // user to the refinement surface.
    }
    router.push('/dashboard/setup');
  }, [router, token]);

  // Animated count-ups — staggered for impact per §8.4.
  // Target values fall back to 0 until the snapshot loads.
  const targetNetWorth = snapshot?.netWorth ?? 0;
  const targetMonthlySavings = snapshot?.monthlyCashflow ?? 0;
  const targetDebt = snapshot?.totalLiabilities ?? 0;

  const animatedNetWorth = useCountUp(targetNetWorth, {
    durationMs: 1400,
    startOnMount: !!snapshot,
  });
  const animatedSavings = useCountUp(targetMonthlySavings, {
    durationMs: 1000,
    startOnMount: !!snapshot,
  });
  const animatedDebt = useCountUp(targetDebt, {
    durationMs: 1000,
    startOnMount: !!snapshot,
  });

  // Insight line — simple math, no Gemini per §8.8 / Q8.
  const annualSavings = Math.max(0, targetMonthlySavings * 12);
  const insightText =
    annualSavings > 0
      ? `At your current rate, you could save ${formatAUD(annualSavings)} in the next 12 months.`
      : targetMonthlySavings < 0
      ? `Your monthly cashflow is negative — connecting your bank can help us find leaks.`
      : `Connect your bank for a sharper picture of your cashflow.`;

  // Loading state — clean skeleton with the hero shape preserved.
  if (isLoading) {
    return (
      <section className="relative mx-auto flex min-h-[70vh] w-full max-w-[620px] flex-col items-center justify-center px-6 py-20">
        <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
        <div className="mt-6 h-20 w-72 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
        <div className="mt-8 flex gap-3">
          <div className="h-16 w-28 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
          <div className="h-16 w-28 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
          <div className="h-16 w-28 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto flex min-h-[60vh] w-full max-w-[520px] flex-col items-center justify-center gap-6 px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Something went wrong
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400">{error}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/setup')}
            className="rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)]"
          >
            Go to dashboard →
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mx-auto flex min-h-[70vh] w-full max-w-[620px] flex-col items-center justify-center px-6 py-20 text-center">
      {/* Ambient glow — decorative */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-400/20 via-indigo-400/15 to-violet-400/20 blur-3xl dark:from-blue-500/15 dark:via-indigo-500/10 dark:to-violet-500/15"
      />

      {/* Eyebrow */}
      <div className="lw-hero-reveal relative inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-1.5 text-xs font-medium text-indigo-700 shadow-sm backdrop-blur dark:bg-slate-900/60 dark:text-indigo-300">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        Here's your financial picture
      </div>

      {/* Hero net-worth */}
      <div className="lw-hero-reveal lw-hero-reveal-delay-1 relative mt-6">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Net worth
        </div>
        <div className="mt-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-6xl font-semibold tracking-tight text-transparent sm:text-7xl dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400">
          {formatAUD(animatedNetWorth)}
        </div>
      </div>

      {/* Three secondary metrics */}
      <div className="lw-hero-reveal lw-hero-reveal-delay-2 relative mt-10 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-left backdrop-blur dark:border-slate-700/50 dark:bg-slate-900/60">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            Monthly savings
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
            {formatAUD(animatedSavings)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-left backdrop-blur dark:border-slate-700/50 dark:bg-slate-900/60">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-rose-700 dark:text-rose-400">
            <TrendingDown className="h-3 w-3" />
            Total debt
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
            {formatAUD(animatedDebt)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-left backdrop-blur dark:border-slate-700/50 dark:bg-slate-900/60">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-400">
            <Award className="h-3 w-3" />
            Health grade
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {snapshot?.healthGrade ?? '—'}
          </div>
        </div>
      </div>

      {/* Insight line */}
      <div className="lw-hero-reveal lw-hero-reveal-delay-3 relative mt-8 max-w-lg rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-blue-50/60 via-indigo-50/60 to-violet-50/60 px-5 py-4 text-sm text-slate-700 backdrop-blur dark:border-indigo-700/40 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-violet-950/30 dark:text-slate-300">
        💡 {insightText}
      </div>

      {/* Footer */}
      <div className="lw-hero-reveal lw-hero-reveal-delay-3 relative mt-10 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isCompleting}
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-40 motion-reduce:transition-none dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={isCompleting}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_-12px_rgba(99,102,241,0.5)] transition-all hover:-translate-y-[1px] hover:shadow-[0_24px_48px_-14px_rgba(99,102,241,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          Continue setting up
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

export default FinalRevealStep;

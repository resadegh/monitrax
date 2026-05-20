'use client';

/**
 * ReviewStep — Phase 12 PR 3a visual redesign
 *
 * Final summary before submission. Shows the user's net worth, annual
 * income, annual expenses, and monthly cashflow — all computed via the
 * shared `calculateSummary()` helper in wizard/types.ts.
 *
 * PR 3a redesign adds:
 *   - Hero net-worth card with gradient background
 *   - 3-tile metrics row (income / expenses / cashflow)
 *   - "What you've added" section listing counts per entity type
 *   - "What you'll unlock" section explaining what the dashboard can now do
 *   - Confetti on first render (preserved from PR 2)
 *
 * Phase 12 Track F — F-reconcile-handoff:
 *   When the user connected or imported accounts during the wizard
 *   (`AccountInput.source` is BASIQ or IMPORT), a closing card bridges
 *   them to reconciliation. The wizard captures the *budget*; imported
 *   transactions are the *actuals*. The card never surfaces actuals
 *   itself (Reza decision 2026-05-20 — the wizard stays a clean "set
 *   your plan" surface); it just makes "see plan vs reality" a
 *   deliberate next action by naming My Budget → Cashflow. It is NOT a
 *   hyperlink: navigating away here would skip the footer's completion
 *   handler. See docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md §6.4.
 *
 * No data changes. No submission happens here — that's the footer's
 * "Launch dashboard" button, which calls `onComplete` in WizardContainer.
 */

import React, { useEffect, useState } from 'react';
import {
  Rocket,
  Home,
  Landmark,
  TrendingUp,
  Car,
  Check,
  Sparkles,
  Building2,
  PiggyBank,
  ArrowUpCircle,
  ArrowDownCircle,
  Users as UsersIcon,
  Target,
  Activity,
  BarChart3,
  Scale,
} from 'lucide-react';
import { WizardData, calculateSummary } from '../types';
import { WizardStepShell, WizardChip } from '../primitives';
import { formatCurrency } from '@/lib/utils/formatters';
import '@/styles/wizard-animations.css';

// =============================================================================
// CONFETTI
// =============================================================================

function Confetti() {
  const [pieces, setPieces] = useState<
    Array<{ id: number; left: string; delay: string; color: string }>
  >([]);

  useEffect(() => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const newPieces = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.5}s`,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setPieces(newPieces);
  }, []);

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={
            {
              '--confetti-left': p.left,
              '--confetti-delay': p.delay,
              '--confetti-color': p.color,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

interface ReviewStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function ReviewStep({ data }: ReviewStepProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 3500);
    return () => clearTimeout(t);
  }, []);

  const summary = calculateSummary(data);

  // Counts
  const propertyCount = data.properties.length;
  const loanCount = data.properties.filter((p) => p.hasLoan && p.loan).length;
  const accountCount = data.accounts.length;
  const investmentCount = data.investments.length;
  const holdingCount = data.investments.reduce((sum, inv) => sum + inv.holdings.length, 0);
  const assetCount = data.assets.length;
  const incomeCount =
    data.income.length + data.properties.filter((p) => p.income && p.income.amount > 0).length;
  const expenseCount =
    data.expenses.length +
    data.properties.reduce((sum, p) => sum + p.expenses.length, 0) +
    data.assets.reduce((sum, a) => sum + a.expenses.length, 0);

  // F-reconcile-handoff: true when the user connected (Basiq) or
  // file-imported an account during the wizard. Those accounts already
  // carry real transactions, so the reconciliation handoff card applies.
  // MANUAL-only setups get no card (nothing to reconcile against yet).
  const hasImportedAccounts = data.accounts.some(
    (a) => a.source === 'BASIQ' || a.source === 'IMPORT',
  );

  const entityItems: Array<{ icon: React.ReactNode; label: string; count: number }> = [
    { icon: <Home className="h-3.5 w-3.5" />, label: 'Properties', count: propertyCount },
    { icon: <Landmark className="h-3.5 w-3.5" />, label: 'Loans', count: loanCount },
    { icon: <PiggyBank className="h-3.5 w-3.5" />, label: 'Accounts', count: accountCount },
    {
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      label: 'Investment accounts',
      count: investmentCount,
    },
    { icon: <BarChart3 className="h-3.5 w-3.5" />, label: 'Holdings', count: holdingCount },
    { icon: <Car className="h-3.5 w-3.5" />, label: 'Personal assets', count: assetCount },
    { icon: <ArrowUpCircle className="h-3.5 w-3.5" />, label: 'Income sources', count: incomeCount },
    {
      icon: <ArrowDownCircle className="h-3.5 w-3.5" />,
      label: 'Expenses',
      count: expenseCount,
    },
    {
      icon: <UsersIcon className="h-3.5 w-3.5" />,
      label: 'Household members',
      count: data.householdMembers.length,
    },
  ].filter((item) => item.count > 0);

  const unlockItems = [
    { icon: <Activity className="h-4 w-4" />, text: 'Real-time net worth tracking' },
    { icon: <TrendingUp className="h-4 w-4" />, text: 'Cashflow forecasts & surplus analysis' },
    { icon: <Target className="h-4 w-4" />, text: 'AI-powered strategy recommendations' },
    { icon: <Activity className="h-4 w-4" />, text: 'Financial health scoring' },
  ];

  return (
    <>
      {showConfetti && <Confetti />}

      <WizardStepShell
        icon={<Rocket className="h-8 w-8" strokeWidth={1.5} />}
        title={
          <>
            Your{' '}
            <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent dark:from-amber-400 dark:via-orange-400 dark:to-amber-500">
              TRAIL begins
            </span>
          </>
        }
        subtitle="Here's your starting point. Your Guide will help you from here — one step at a time."
      >
        {/* Hero net worth card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-violet-900/20 p-6 text-center">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-blue-500/10 to-violet-500/10 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-gradient-to-br from-violet-500/10 to-pink-500/10 blur-2xl" />
          <div className="relative">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Your net worth
            </div>
            <div
              className={`text-5xl font-semibold tabular-nums ${
                summary.netWorth >= 0
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
              style={{ letterSpacing: '-0.03em' }}
            >
              {formatCurrency(summary.netWorth, { abbreviate: true })}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <WizardChip color="blue" icon={<Sparkles className="h-3 w-3" />}>
                Based on {entityItems.length} data sources
              </WizardChip>
            </div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            icon={<ArrowUpCircle className="h-4 w-4" />}
            label="Annual income"
            value={formatCurrency(summary.annualIncome, { abbreviate: true })}
            accent="emerald"
          />
          <MetricCard
            icon={<ArrowDownCircle className="h-4 w-4" />}
            label="Annual outgoings"
            value={formatCurrency(summary.annualExpenses + summary.annualLoanRepayments, {
              abbreviate: true,
            })}
            accent="rose"
            sublabel={
              summary.annualLoanRepayments > 0
                ? `Incl. ${formatCurrency(summary.annualLoanRepayments, { abbreviate: true })} loan repayments`
                : undefined
            }
          />
          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            label="Monthly cashflow"
            value={`${summary.monthlyCashflow >= 0 ? '+' : ''}${formatCurrency(
              summary.monthlyCashflow,
              { abbreviate: true }
            )}`}
            accent={summary.monthlyCashflow >= 0 ? 'blue' : 'rose'}
          />
        </div>

        {/* What you've added */}
        {entityItems.length > 0 && (
          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/40 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" strokeWidth={3} />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                What you&apos;ve added
              </h4>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {entityItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                >
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {item.icon}
                  </div>
                  <span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {item.count}
                    </span>{' '}
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What you'll unlock */}
        <div className="rounded-2xl border border-blue-200/60 dark:border-blue-800/40 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 dark:from-blue-900/15 dark:to-indigo-900/10 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              What you&apos;ll unlock on the dashboard
            </h4>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {unlockItems.map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-2.5 rounded-lg bg-white/60 dark:bg-slate-900/30 px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
              >
                <span className="text-blue-500 dark:text-blue-400">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* F-reconcile-handoff — only when accounts were connected / imported */}
        {hasImportedAccounts && (
          <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 dark:from-emerald-900/15 dark:to-teal-900/10 p-5">
            <div className="mb-2 flex items-center gap-2">
              <Scale className="h-4 w-4 text-emerald-500" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Your real spending is already flowing in
              </h4>
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              You connected accounts during setup, so your actual transactions are
              landing automatically. The amounts you just entered are your starting{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">budget</span>.
              Once you&apos;re in, head to{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                My Budget&nbsp;→&nbsp;Cashflow
              </span>{' '}
              to see your plan against what&apos;s really happening — and fine-tune
              from there.
            </p>
          </div>
        )}

        <p className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          Click <span className="font-semibold">Start your TRAIL</span> below to meet your Guide — you can
          always add more data later.
        </p>
      </WizardStepShell>
    </>
  );
}

// =============================================================================
// METRIC CARD
// =============================================================================

function MetricCard({
  icon,
  label,
  value,
  sublabel,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  accent: 'blue' | 'emerald' | 'rose';
}) {
  const accentClass = {
    blue: 'text-blue-600 dark:text-blue-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }[accent];
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/50 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span className={accentClass}>{icon}</span>
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${accentClass}`}>{value}</div>
      {sublabel && (
        <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{sublabel}</div>
      )}
    </div>
  );
}

export default ReviewStep;

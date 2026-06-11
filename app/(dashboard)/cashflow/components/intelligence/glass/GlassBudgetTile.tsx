'use client';

/**
 * GlassBudgetTile — Phase 45.8 cashflow redesign.
 *
 * §18.7.2 glass-vocabulary rewrite of BudgetVsActual. Surfaces top-5
 * categories with progress bars so the user can scan over/under-budget at a
 * glance. Empty state celebrates the next achievable action (set up budget)
 * per §0 behaviour-psychology lens.
 *
 * Stitch source: project 1859462351962811110, screen ff0beab3c934409893fe04441120a472
 * (Section 3 — Current Budget Spend).
 */

import Link from 'next/link';
import { Scale, ArrowRight } from 'lucide-react';
import { GlassPanel, GlassIconBadge, GlassEyebrow } from '@/components/dashboard/tiles/GlassPanel';
import { formatCurrency } from '@/lib/utils/formatters';

interface BudgetCategory {
  name: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'UNDER' | 'ON_TRACK' | 'OVER';
}

interface Props {
  categories: BudgetCategory[];
  totalBudgeted: number;
  totalActual: number;
  totalVariance: number;
  overallStatus: 'UNDER' | 'ON_TRACK' | 'OVER';
  periodStart: Date;
  periodEnd: Date;
}

// Status mapping — amber for OVER (caution, never red per §18.7.2), emerald
// for UNDER (positive money signal), sky for ON_TRACK (informational).
const STATUS_COLORS: Record<
  BudgetCategory['status'],
  { text: string; bar: string }
> = {
  UNDER: {
    text: 'text-emerald-700 dark:text-emerald-300',
    bar: 'bg-gradient-to-r from-emerald-400/70 to-emerald-500/70',
  },
  ON_TRACK: {
    text: 'text-sky-700 dark:text-sky-300',
    bar: 'bg-gradient-to-r from-sky-400/70 to-sky-500/70',
  },
  OVER: {
    text: 'text-amber-700 dark:text-amber-300',
    bar: 'bg-gradient-to-r from-amber-400/70 to-amber-500/70',
  },
};

export default function GlassBudgetTile({
  categories,
  totalBudgeted,
  totalActual,
  overallStatus,
}: Props) {
  // Empty state — no budget configured
  if (!categories || categories.length === 0) {
    return (
      <GlassPanel subPalette="emerald" padding="p-6">
        <div className="flex items-center gap-3 mb-5">
          <GlassIconBadge icon={Scale} subPalette="emerald" />
          <div className="flex flex-col">
            <GlassEyebrow subPalette="emerald">Budget</GlassEyebrow>
            <h3 className="text-base font-semibold text-foreground">Set the rails</h3>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          A monthly budget makes leaks visible the moment they start. Set up a guide budget once and it tracks itself.
        </p>
        <Link
          href="/dashboard/budget-analysis"
          className="inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700"
        >
          <Scale className="h-4 w-4" strokeWidth={1.5} />
          <span>Set up budget</span>
        </Link>
      </GlassPanel>
    );
  }

  const utilisationPct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;
  const topCategories = categories.slice(0, 5);

  return (
    <GlassPanel subPalette="emerald" padding="p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <GlassIconBadge icon={Scale} subPalette="emerald" />
          <div className="flex flex-col">
            <GlassEyebrow subPalette="emerald">Budget · This month</GlassEyebrow>
            <h3 className="text-base font-semibold text-foreground">
              {formatCurrency(totalActual)}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}
                of {formatCurrency(totalBudgeted)}
              </span>
            </h3>
          </div>
        </div>
        <Link
          href="/dashboard/budget-analysis"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          Edit
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </Link>
      </div>

      {/* Overall progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
            {utilisationPct.toFixed(0)}% used
          </span>
          <span
            className={`text-xs font-semibold ${STATUS_COLORS[overallStatus].text}`}
          >
            {overallStatus === 'OVER' ? 'Over budget' : overallStatus === 'UNDER' ? 'On track' : 'Steady'}
          </span>
        </div>
        <div className="h-2 rounded-full bg-foreground/5 overflow-hidden">
          <div
            className={`h-full ${STATUS_COLORS[overallStatus].bar} transition-all duration-500`}
            style={{ width: `${Math.min(100, utilisationPct)}%` }}
          />
        </div>
      </div>

      {/* Top categories */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70 mb-3">
          Top categories
        </p>
        <ul className="space-y-3">
          {topCategories.map((cat) => {
            const pct = cat.budgeted > 0 ? Math.min(100, (cat.actual / cat.budgeted) * 100) : 0;
            const colors = STATUS_COLORS[cat.status];
            return (
              <li key={cat.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-foreground/85 truncate">{cat.name}</span>
                  <span className={`text-xs font-medium tabular-nums shrink-0 ${colors.text}`}>
                    {formatCurrency(cat.actual)}
                    <span className="text-muted-foreground"> / {formatCurrency(cat.budgeted)}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                  <div className={`h-full ${colors.bar}`} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </GlassPanel>
  );
}

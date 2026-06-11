'use client';

/**
 * GlassMoneyLeaksTile — Phase 45.8 cashflow redesign.
 *
 * §18.7.2 glass-vocabulary rewrite of MoneyLeakDetector with the v1
 * enhancement Reza approved: classify each leak into a behavioural type
 * (duplicate / subscription creep / forgotten subscription) so the user
 * sees WHY it's flagged, not just WHAT was flagged. The classifier is a
 * pure mapping over the existing leak categories + trend signal — no new
 * data source, no new backend dependency.
 *
 * Empty state celebrates per §0 behaviour-psychology lens — "nothing
 * flagged this month" is a win, not a void.
 *
 * Stitch source: project 1859462351962811110, screen ff0beab3c934409893fe04441120a472
 * (Section 4 — 3 leaks worth closing).
 */

import Link from 'next/link';
import { Droplets, AlertTriangle, Repeat2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { GlassPanel, GlassIconBadge, GlassEyebrow } from '@/components/dashboard/tiles/GlassPanel';
import { formatCurrency } from '@/lib/utils/formatters';

interface MoneyLeak {
  id: string;
  category: string;
  description: string;
  monthlyAmount: number;
  percentOfIncome: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  transactionIds: string[];
  recommendation: string;
}

interface Props {
  totalLeakage: number;
  leaks: MoneyLeak[];
  transactionCount: number;
}

type LeakKind = 'DUPLICATE' | 'SUBSCRIPTION_CREEP' | 'FORGOTTEN_SUB' | 'CATEGORY_LEAK';

/**
 * Classify each leak into a behavioural type. Pure mapping over existing
 * fields — no new data fetch.
 *
 *   - SUBSCRIPTION_CREEP: any subscription-category leak whose trend is
 *     INCREASING (= price hike since last month).
 *   - FORGOTTEN_SUB: subscription-category leak with STABLE or DECREASING
 *     trend (= you've been paying it without using it).
 *   - DUPLICATE: leak description contains "duplicate" or "multiple"
 *     (the underlying detector flags these explicitly).
 *   - CATEGORY_LEAK: everything else (overspending in a category).
 */
function classifyLeak(leak: MoneyLeak): LeakKind {
  const desc = leak.description.toLowerCase();
  const cat = leak.category.toLowerCase();
  if (desc.includes('duplicate') || desc.includes('charged twice') || desc.includes('multiple charges')) {
    return 'DUPLICATE';
  }
  if (cat.includes('subscription') || cat.includes('streaming') || cat.includes('membership')) {
    return leak.trend === 'INCREASING' ? 'SUBSCRIPTION_CREEP' : 'FORGOTTEN_SUB';
  }
  return 'CATEGORY_LEAK';
}

const KIND_META: Record<
  LeakKind,
  { label: string; icon: typeof AlertTriangle; chip: string }
> = {
  DUPLICATE: {
    label: 'Duplicate charge',
    icon: AlertTriangle,
    chip:
      'border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300',
  },
  SUBSCRIPTION_CREEP: {
    label: 'Subscription creep',
    icon: Repeat2,
    chip:
      'border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300',
  },
  FORGOTTEN_SUB: {
    label: 'Forgotten subscription',
    icon: Droplets,
    chip:
      'border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300',
  },
  CATEGORY_LEAK: {
    label: 'Category overspend',
    icon: AlertTriangle,
    chip:
      'border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300',
  },
};

export default function GlassMoneyLeaksTile({ totalLeakage, leaks, transactionCount }: Props) {
  // Empty state — Reza-approved celebratory framing.
  if (leaks.length === 0) {
    return (
      <GlassPanel subPalette="amber" padding="p-6">
        <div className="flex items-center gap-3 mb-5">
          <GlassIconBadge icon={Droplets} subPalette="amber" />
          <div className="flex flex-col">
            <GlassEyebrow subPalette="amber">Money Leaks</GlassEyebrow>
            <h3 className="text-base font-semibold text-foreground">Nothing flagged this month</h3>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/[0.12]">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed">
            {transactionCount} transactions analysed. No duplicates, no subscription creep, no forgotten charges.
          </p>
        </div>
        <p className="text-xs text-muted-foreground italic">
          We re-check every time your transactions update.
        </p>
      </GlassPanel>
    );
  }

  const annualLeakage = totalLeakage * 12;
  const topLeaks = leaks.slice(0, 3).map((leak) => ({ leak, kind: classifyLeak(leak) }));

  return (
    <GlassPanel subPalette="amber" padding="p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <GlassIconBadge icon={Droplets} subPalette="amber" />
          <div className="flex flex-col min-w-0">
            <GlassEyebrow subPalette="amber">Money Leaks · This month</GlassEyebrow>
            <h3 className="text-base font-semibold text-foreground">
              {leaks.length} {leaks.length === 1 ? 'leak' : 'leaks'} worth closing
            </h3>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-300">
            {formatCurrency(totalLeakage)}
          </p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
            /mo
          </p>
        </div>
      </div>

      {/* Annual context — Reza's stated pain: "where is my money going across
          multiple accounts and properties". Annual total makes the impact real. */}
      {annualLeakage >= 500 && (
        <div className="mb-4 rounded-[12px] border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <span className="font-semibold">{formatCurrency(annualLeakage)}</span> a year if nothing changes
          </p>
        </div>
      )}

      {/* Leak list */}
      <ul className="space-y-3">
        {topLeaks.map(({ leak, kind }) => {
          const meta = KIND_META[kind];
          const Icon = meta.icon;
          const transactionUrl = `/dashboard/transactions?category=${encodeURIComponent(leak.category)}`;
          return (
            <li key={leak.id}>
              <Link
                href={transactionUrl}
                className="block rounded-[14px] border border-foreground/5 bg-foreground/[0.02] p-3 transition hover:bg-foreground/[0.04]"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${meta.chip}`}
                    >
                      <Icon className="h-3 w-3" strokeWidth={1.5} />
                      {meta.label}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground/90">
                    {formatCurrency(leak.monthlyAmount)}
                    <span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </span>
                </div>
                <p className="text-sm text-foreground/85 mb-1 truncate">{leak.category}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{leak.recommendation}</p>
              </Link>
            </li>
          );
        })}
      </ul>

      {leaks.length > 3 && (
        <Link
          href="/dashboard/transactions"
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
        >
          See {leaks.length - 3} more
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </Link>
      )}
    </GlassPanel>
  );
}

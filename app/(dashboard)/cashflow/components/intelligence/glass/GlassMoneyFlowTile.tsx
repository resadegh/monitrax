'use client';

/**
 * GlassMoneyFlowTile — Phase 45.8 cashflow redesign.
 *
 * §18.7.2 glass-vocabulary wrapper around the existing waterfall data. Renders
 * the income → expenses → surplus story as a compact, scannable list ordered
 * by absolute value so the user sees the biggest mover first. Replaces the
 * full WaterfallChart on the cashflow page (the chart's narrative shape is
 * preserved; the cosmetic SVG-driven bars are dropped because they don't
 * survive the 50%-width Bento cell).
 *
 * Stitch source: project 1859462351962811110, screen ff0beab3c934409893fe04441120a472
 * (Section 2 — Money Flow Analysis).
 */

import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import { GlassPanel, GlassIconBadge, GlassEyebrow } from '@/components/dashboard/tiles/GlassPanel';
import { formatCurrency } from '@/lib/utils/formatters';

interface WaterfallItem {
  name: string;
  value: number;
  type: 'income' | 'expense' | 'net';
  isSubtotal?: boolean;
  category?: string;
}

interface Props {
  items: WaterfallItem[];
  netIncome: number;
  totalExpenses: number;
  surplus: number;
}

export default function GlassMoneyFlowTile({ items, netIncome, totalExpenses, surplus }: Props) {
  const isSurplus = surplus >= 0;

  // Order: income lines first, then top expense categories by abs value.
  const incomeLines = items.filter((i) => i.type === 'income' && !i.isSubtotal);
  const allExpenseLines = items
    .filter((i) => i.type === 'expense' && !i.isSubtotal)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const topExpenses = allExpenseLines.slice(0, 4);
  // If the top-4 don't sum to total OUT, surface the remainder as
  // "Everything else" so the breakdown reconciles to the headline number.
  const topExpensesSum = topExpenses.reduce((sum, line) => sum + Math.abs(line.value), 0);
  const remainderExpenses = Math.max(0, totalExpenses - topExpensesSum);
  const showRemainder = allExpenseLines.length > 4 && remainderExpenses > 1;
  const expenseLines = showRemainder
    ? [
        ...topExpenses,
        {
          name: 'Everything else',
          value: -remainderExpenses,
          type: 'expense' as const,
        },
      ]
    : topExpenses;

  return (
    <GlassPanel subPalette="sky-indigo" padding="p-6">
      <div className="flex items-center gap-3 mb-5">
        <GlassIconBadge icon={Wallet} subPalette="sky-indigo" />
        <div className="flex flex-col">
          <GlassEyebrow subPalette="sky-indigo">Money Flow · This month</GlassEyebrow>
          <h3 className="text-base font-semibold text-foreground">Where your money went</h3>
        </div>
      </div>

      {/* Income / Out / Surplus row — Phase 45.8.2: each value carries
          whitespace-nowrap so the sign prefix never wraps to its own line
          on tight mobile cells, and the mobile font drops to text-[15px]
          so "−$24,142"-class amounts fit a ~85px-wide cell on a 360px
          viewport. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <div className="rounded-[12px] border border-emerald-500/15 bg-emerald-500/[0.06] p-2.5 sm:p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400 mb-1">In</p>
          <p className="text-[15px] sm:text-lg font-semibold tabular-nums whitespace-nowrap text-emerald-700 dark:text-emerald-300">
            +{formatCurrency(netIncome)}
          </p>
        </div>
        <div className="rounded-[12px] border border-rose-500/15 bg-rose-500/[0.05] p-2.5 sm:p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-rose-600 dark:text-rose-400 mb-1">Out</p>
          <p className="text-[15px] sm:text-lg font-semibold tabular-nums whitespace-nowrap text-rose-600 dark:text-rose-300">
            −{formatCurrency(totalExpenses)}
          </p>
        </div>
        <div
          className={`rounded-[12px] border p-2.5 sm:p-3 ${
            isSurplus
              ? 'border-emerald-500/15 bg-emerald-500/[0.06]'
              : 'border-amber-500/20 bg-amber-500/[0.08]'
          }`}
        >
          <p
            className={`text-[10px] font-medium uppercase tracking-[0.16em] mb-1 truncate ${
              isSurplus
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {isSurplus ? 'Surplus' : 'Shortfall'}
          </p>
          <p
            className={`text-[15px] sm:text-lg font-semibold tabular-nums whitespace-nowrap ${
              isSurplus
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {isSurplus ? '+' : '−'}
            {formatCurrency(Math.abs(surplus))}
          </p>
        </div>
      </div>

      {/* Top movers list */}
      {expenseLines.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70 mb-3">
            Top categories
          </p>
          <ul className="space-y-2">
            {expenseLines.map((line) => {
              const pct = totalExpenses > 0 ? (Math.abs(line.value) / totalExpenses) * 100 : 0;
              return (
                <li key={line.name} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground/85 truncate">{line.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:block w-24 h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400/70 to-indigo-500/70"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium tabular-nums text-foreground/85 w-20 text-right">
                      {formatCurrency(Math.abs(line.value))}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Income context */}
      {incomeLines.length > 0 && (
        <p className="mt-4 pt-4 border-t border-foreground/5 text-xs text-muted-foreground flex items-center gap-1.5">
          {isSurplus ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.5} />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" strokeWidth={1.5} />
          )}
          <span>
            {incomeLines.length} income source{incomeLines.length === 1 ? '' : 's'} fed this month
          </span>
        </p>
      )}
    </GlassPanel>
  );
}

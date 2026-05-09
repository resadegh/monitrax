'use client';

/**
 * SpendingParetoLens — Phase 43.2
 *
 * The Pareto principle from Stark Naked Numbers ("fire your worst 20%
 * of customers"), inverted for personal finance: instead of cutting
 * categories, surface the *vital few* spending categories that drive
 * ~80% of monthly outgoings. The user gets a single highest-leverage
 * focus list — not a spreadsheet of 30 lines.
 *
 * Why this surface exists: the existing `/dashboard/expenses` page is
 * a complete list of every recurring + one-off line. Useful for the
 * data, useless for the *decision* — the user can't tell at a glance
 * which 4 lines, if reviewed quarterly, would move 80% of the needle.
 * This lens does, without naming any single line as "bad".
 *
 * SSOT contract:
 *   - Data comes from `/api/dashboard/spending-pareto`, a thin wrapper
 *     around `getMasterFinancialSnapshot()` that reads
 *     `expenses.monthly.byCategory`. The lens computes nothing — the
 *     route does the Pareto cut.
 *
 * Design contract:
 *   - **Typography-led, no glass tile** — same family as
 *     `HiddenWealthLens` (Phase 43.1). Subtle border + faint
 *     background. Apple/Linear/Stripe restraint.
 *   - **No red anywhere.** Even a category at 50% of spend is rendered
 *     in slate; the Pareto framing is "where to focus", not "where
 *     you've failed" (Kahneman & Tversky loss aversion).
 *   - **Inline mini-bars** beside each row, slate-600 fill on
 *     slate-100 track. Not a chart — a *visual rank*. The bars are
 *     sized by `pct` (this row's share of total), not cumulative.
 *   - **Reduced-motion-safe** mini-bar reveal animation.
 *   - **Self-hides when `vitalFew.length === 0`** (no spending data
 *     yet — the empty state is silence, not a placeholder).
 *
 * Behavioural-psychology framing (registered in 06_UI_UX_FOUNDATION.md):
 *   - "the highest-leverage spending check you can do" — locus of
 *     control framing (Bandura).
 *   - Numbered list (1, 2, 3, 4) — concrete, sequenceable action.
 *   - "12 more categories make up the other 19%" — neutral framing
 *     of the trivial many; never "ignore these" (which would be
 *     prescriptive and could backfire).
 *
 * @see docs/blueprint/PHASE_43_2_SPENDING_PARETO.md
 * @see app/api/dashboard/spending-pareto/route.ts
 */

import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils/formatters';
import { appleEase, useReducedMotionSafe } from '@/components/shell';

export interface ParetoCategoryProp {
  category: string;
  amount: number;
  pct: number;
  cumulativePct: number;
}

export interface SpendingParetoLensProps {
  vitalFew: ParetoCategoryProp[];
  vitalFewTotal: number;
  vitalFewPct: number;
  trivialManyCount: number;
  trivialManyAmount: number;
  trivialManyPct: number;
  totalMonthlySpend: number;
  totalCategoryCount: number;
}

export function SpendingParetoLens({
  vitalFew,
  vitalFewTotal,
  vitalFewPct,
  trivialManyCount,
  trivialManyAmount,
  trivialManyPct,
  totalMonthlySpend,
}: SpendingParetoLensProps) {
  const reduced = useReducedMotionSafe();

  if (vitalFew.length === 0 || totalMonthlySpend <= 0) return null;

  // Largest category drives the mini-bar scale so the visual rank is
  // honest (the #1 line fills 100% of its row's bar; everything else
  // scales proportionally). The widths are based on share-of-total, not
  // share-of-vital-few — keeps the bars comparable to "the whole".
  const maxPct = vitalFew[0]?.pct ?? 1;

  return (
    <section
      aria-label="Where your spending goes"
      className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.015] px-5 py-6 sm:px-7 sm:py-7"
    >
      {/* Eyebrow + subhead — Apple-style understated. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Where 80% of your spending goes
        </h2>
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatCurrency(totalMonthlySpend, { showCents: false })} / month
        </p>
      </div>

      <p className="mt-3 max-w-prose text-sm text-foreground/80">
        <span className="font-semibold tabular-nums">
          {vitalFew.length}
        </span>{' '}
        {vitalFew.length === 1 ? 'category handles' : 'categories handle'}{' '}
        <span className="font-semibold tabular-nums">
          {formatCurrency(vitalFewTotal, { showCents: false })}
        </span>{' '}
        — <span className="tabular-nums">{Math.round(vitalFewPct)}%</span> of
        your monthly spend.
      </p>

      {/* The numbered vital-few list. Inline mini-bar per row gives
          a visual rank without becoming a chart. */}
      <ol className="mt-6 space-y-4">
        {vitalFew.map((c, i) => {
          const barWidthPct = (c.pct / maxPct) * 100;
          return (
            <li key={c.category} className="flex items-center gap-4">
              {/* Rank number — restrained, monospace */}
              <span className="w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>

              {/* Category label + mini-bar (stacked) */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-foreground">
                    {c.category}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(c.amount, { showCents: false })}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                    <motion.div
                      className="h-full rounded-full bg-slate-500/80 dark:bg-slate-400/80"
                      style={{ transformOrigin: 'left' }}
                      initial={
                        reduced
                          ? { width: `${barWidthPct}%`, scaleX: 1 }
                          : { width: `${barWidthPct}%`, scaleX: 0 }
                      }
                      animate={{ scaleX: 1 }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : {
                              duration: 0.6,
                              ease: appleEase,
                              delay: 0.1 + i * 0.06,
                            }
                      }
                      aria-hidden
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {Math.round(c.pct)}%
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Trivial-many footer — neutral framing. Never "ignore these". */}
      {trivialManyCount > 0 && (
        <div className="mt-5 border-t border-foreground/5 pt-4 text-[12px] text-muted-foreground">
          <span className="tabular-nums">{trivialManyCount}</span> more{' '}
          {trivialManyCount === 1 ? 'category makes' : 'categories make'} up the
          other{' '}
          <span className="tabular-nums">{Math.round(trivialManyPct)}%</span>
          <span className="mx-1.5 opacity-50">·</span>
          <span className="tabular-nums">
            {formatCurrency(trivialManyAmount, { showCents: false })}
          </span>
        </div>
      )}

      {/* Closing copy — locus-of-control framing. The user is the
          actor, the lens just points at the leverage. */}
      <p className="mt-4 max-w-prose text-[12px] text-muted-foreground">
        A quarterly check on{' '}
        {vitalFew.length === 1
          ? 'this category'
          : `these ${vitalFew.length} categories`}{' '}
        is the highest-leverage spending review you can do.
      </p>
    </section>
  );
}

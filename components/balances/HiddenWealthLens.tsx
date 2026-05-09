'use client';

/**
 * HiddenWealthLens — Phase 43.1
 *
 * Translates Jason Andrew's *"the balance sheet is where all the cash is
 * hiding"* (Stark Naked Numbers) into a personal-finance accessibility
 * view: splits the user's total assets by **how soon they can spend it**.
 *
 *   • Liquid Today      — cash + offsets (24-hour access)
 *   • Accessible        — shares / ETFs / managed funds (~days)
 *   • Locked Long-Term  — property equity, super, personal assets
 *
 * Why this surface exists (the user with $500k net worth and $2k
 * accessible — the rule, not the exception, for the AU property-investor
 * segment): the existing /dashboard/balances hero shows Net Position,
 * Cash, Credit, Debt — all useful, none of which answer *"how much can
 * I actually spend before payday if my hot-water system dies?"* This
 * lens does, honestly and without alarm.
 *
 * SSOT contract:
 *   - All values come from `/api/dashboard/hidden-wealth`, which is a
 *     thin wrapper around `getMasterFinancialSnapshot()`. The lens
 *     computes nothing — it just renders.
 *
 * Design contract:
 *   - **Typography-led, no glass tile.** The page already has a clean
 *     minimalist hero (Net Position); a glass card here would clash.
 *     Subtle border + faint background only.
 *   - **3-segment proportional bar** under the eyebrow + subhead:
 *     emerald (Liquid — Bandura victory tone) → sky (Accessible —
 *     calm, can-act) → slate (Locked — neutral foundation).
 *     Note: the emerald-reservation rule in PHASE_43_MONEY_STORY.md
 *     §5a is scoped to the Money Story Bar component — emerald CAN
 *     denote a "victory/access" bucket here without conflict, and the
 *     two surfaces never co-render.
 *   - **No red anywhere** (loss aversion — Kahneman & Tversky), even
 *     when the user has an extreme imbalance (e.g. 95% locked).
 *   - **Reduced-motion-safe** segment-fill animation.
 *   - **Self-hides when totalAssets ≤ 0** (a fully-grey bar would
 *     misinform).
 *
 * Apple/Linear/Stripe-grade restraint: the bar IS the chart; the rows
 * ARE the legend. No axis, no swatches.
 *
 * @see docs/blueprint/PHASE_43_1_HIDDEN_WEALTH.md
 * @see app/api/dashboard/hidden-wealth/route.ts
 */

import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils/formatters';
import { appleEase, useReducedMotionSafe } from '@/components/shell';

export interface HiddenWealthLensProps {
  /** Sum of cash + offsets — accessible within 24h. */
  liquidToday: number;
  /** Investments market value — sellable within ~days. */
  accessible: number;
  /** Property equity + super + personal assets — long-term. */
  lockedLongTerm: number;
  /** For the contextual subhead ("$X net worth · $Y in assets"). */
  netWorth: number;
  /** Sum of the three buckets — used for proportions + sanity. */
  totalAssets: number;
  /** Optional drill-down rows under each bucket. */
  breakdown?: {
    cash: number;
    investments: number;
    propertyEquity: number;
    superannuation: number;
    personalAssets: number;
  };
}

interface Bucket {
  key: 'liquid' | 'accessible' | 'locked';
  label: string;
  amount: number;
  pct: number;
  barCls: string;
  dotCls: string;
  micro: string;
}

/**
 * Stark-Naked honesty in copy: each bucket's micro-description names
 * the tradeoff without alarm. The user's perception of "I have $X
 * wealth" is anchored against the reality of "but only $Y is reachable
 * this week" — Andrew's whole point, framed warmly.
 */
function getMicro(key: Bucket['key'], pct: number): string {
  switch (key) {
    case 'liquid':
      if (pct < 5)
        return 'A small share of your wealth is reachable this week.';
      if (pct < 15) return 'Reachable today — a typical buffer.';
      return 'A healthy share of your wealth is reachable today.';
    case 'accessible':
      if (pct === 0) return 'No share-style holdings yet — the next TRAIL stage.';
      return 'Sellable within days. CGT and market timing apply.';
    case 'locked':
      if (pct >= 80)
        return 'Most of your wealth is in long-term form. That is wealth — but not cash.';
      if (pct >= 60) return 'Property, super and assets — real wealth, not cash.';
      return 'Property, super and personal assets.';
  }
}

export function HiddenWealthLens({
  liquidToday,
  accessible,
  lockedLongTerm,
  netWorth,
  totalAssets,
  breakdown,
}: HiddenWealthLensProps) {
  const reduced = useReducedMotionSafe();

  if (totalAssets <= 0) return null;

  // Clamp percentages defensively. Sum should be 100; rounding noise
  // is absorbed into the largest segment so the dotted labels reconcile.
  const liquidPct = (liquidToday / totalAssets) * 100;
  const accessiblePct = (accessible / totalAssets) * 100;
  const lockedPct = Math.max(0, 100 - liquidPct - accessiblePct);

  const buckets: Bucket[] = [
    {
      key: 'liquid',
      label: 'Liquid today',
      amount: liquidToday,
      pct: liquidPct,
      barCls: 'bg-emerald-500/85 dark:bg-emerald-400/80',
      dotCls: 'bg-emerald-500 dark:bg-emerald-400',
      micro: getMicro('liquid', liquidPct),
    },
    {
      key: 'accessible',
      label: 'Accessible',
      amount: accessible,
      pct: accessiblePct,
      barCls: 'bg-sky-500/85 dark:bg-sky-400/80',
      dotCls: 'bg-sky-500 dark:bg-sky-400',
      micro: getMicro('accessible', accessiblePct),
    },
    {
      key: 'locked',
      label: 'Locked long-term',
      amount: lockedLongTerm,
      pct: lockedPct,
      barCls: 'bg-slate-400/80 dark:bg-slate-500/80',
      dotCls: 'bg-slate-400 dark:bg-slate-500',
      micro: getMicro('locked', lockedPct),
    },
  ];

  return (
    <section
      aria-label="Where your wealth is"
      className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.015] px-5 py-6 sm:px-7 sm:py-7"
    >
      {/* Eyebrow + subhead — Apple-style understated. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Where your wealth is
        </h2>
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatCurrency(netWorth, { showCents: false })} net worth
          <span className="mx-1.5 opacity-50">·</span>
          {formatCurrency(totalAssets, { showCents: false })} in assets
        </p>
      </div>

      {/* The proportional bar. Three segments, no red, animated reveal. */}
      <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-foreground/[0.06] ring-1 ring-foreground/[0.04]">
        {buckets.map((b, i) => (
          <motion.div
            key={b.key}
            className={b.barCls}
            style={{ flexBasis: `${b.pct}%`, transformOrigin: 'left' }}
            initial={reduced ? { opacity: 1 } : { opacity: 0, scaleX: 0.4 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.7, ease: appleEase, delay: 0.1 + i * 0.08 }
            }
            aria-label={`${b.label} ${Math.round(b.pct)}%`}
          />
        ))}
      </div>

      {/* Three rows — bucket name, $, %, micro-copy. */}
      <dl className="mt-6 space-y-4">
        {buckets.map((b) => (
          <div
            key={b.key}
            className="flex items-baseline justify-between gap-4"
          >
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span
                aria-hidden
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${b.dotCls}`}
              />
              <div className="min-w-0">
                <dt className="text-sm font-medium text-foreground">
                  {b.label}
                </dt>
                <dd className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {b.micro}
                </dd>
              </div>
            </div>
            <div className="text-right tabular-nums">
              <div className="text-sm font-semibold text-foreground">
                {formatCurrency(b.amount, { showCents: false })}
              </div>
              <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                {Math.round(b.pct)}%
              </div>
            </div>
          </div>
        ))}
      </dl>

      {/* Optional drill-down — only renders if breakdown is provided.
          Same Stark-Naked honesty: name what's inside Locked, since the
          user's biggest "hidden wealth" usually lives there. */}
      {breakdown && lockedLongTerm > 0 && (
        <div className="mt-5 border-t border-foreground/5 pt-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Inside Locked
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-3">
            {[
              { label: 'Property equity', value: breakdown.propertyEquity },
              { label: 'Superannuation', value: breakdown.superannuation },
              { label: 'Personal assets', value: breakdown.personalAssets },
            ]
              .filter((row) => row.value > 0)
              .map((row) => (
                <li
                  key={row.label}
                  className="flex items-baseline justify-between gap-2 tabular-nums"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-foreground/80">
                    {formatCurrency(row.value, { showCents: false })}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}

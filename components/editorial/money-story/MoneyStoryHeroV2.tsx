'use client';

/**
 * MoneyStoryHeroV2 — the Freedom Horizon redesign. Variant B "The Ribbon"
 * locked by Reza 2026-05-27 from Stitch screen
 * 888f0c4fa9944222b5cf44e1ed7fcfd4 (PR #907).
 *
 * Composition (top → bottom):
 *   1. Header row — eyebrow "FREEDOM HORIZON" + TimePeriodPill (1M/3M/6M/1Y/ALL)
 *   2. Hero number — animated count-up to N years, navy/near-white,
 *      48px desktop / 40px mobile, weight 600, tabular-nums + BreathingDot
 *   3. Sub line — "of freedom — your kept margin widened N points"
 *   4. FreedomRibbonChart — emerald ribbon widening over time
 *   5. KPI chips row — Earned / Kept / Margin with delta pills
 *   6. Interaction hint — bottom-right, subtle
 *
 * Coexistence: this component lives alongside the cosmos `MoneyStoryHero`
 * (Phase 43) and the editorial three-row `EditorialMoneyStoryHero`
 * (Phase R3). The dashboard consumer is NOT yet swapped — this PR ships
 * the component + a /dashboard/labs/money-story preview route for Reza
 * to interact with. Consumer migration is a follow-up phase once V2 is
 * approved on real-data wiring.
 *
 * Reduced motion: count-up + ribbon animation suppressed under
 * `prefers-reduced-motion`. Static value + static path render instead.
 */

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BreathingDot } from './BreathingDot';
import { FreedomRibbonChart, type RibbonPoint } from './FreedomRibbonChart';
import { TimePeriodPill, type TimePeriod } from './TimePeriodPill';

export interface MoneyStoryHeroV2Props {
  /** Freedom horizon in years (e.g. 14.4). The hero number. */
  freedomYears: number;
  /** Monthly earned (gross income, AUD). */
  earned: number;
  /** Monthly kept (after spending). earned - spent = kept. */
  kept: number;
  /** Percentage points the kept margin widened vs prior period. */
  marginDeltaPoints: number;
  /** Trend data — one point per period (e.g. 12 months). Used for the
   *  ribbon chart. spent + kept = earned per point. Empty array hides
   *  the ribbon cleanly and shows a quiet empty-state line in its place. */
  trendData: RibbonPoint[];
  /** Initially selected time period. Defaults to '1Y'. */
  defaultPeriod?: TimePeriod;
  /** Optional callback when the user changes the time period. */
  onPeriodChange?: (period: TimePeriod) => void;
  /** Optional drill-down link. When omitted, the tile is not a link. */
  drillHref?: string;
  /** Disable animations (count-up + chart draw). */
  reducedMotion?: boolean;
  className?: string;
}

const CURRENCY_FMT = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

/** Format a years number with one decimal place: 14.43 → "14.4 years". */
function formatYears(n: number): string {
  if (n <= 0) return '0 years';
  if (n < 1) {
    const months = Math.round(n * 12);
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }
  return `${n.toFixed(1)} years`;
}

/**
 * AnimatedYears — count-up the hero number from 0 → final value over
 * 1100ms with ease-out. Falls back to static if reducedMotion=true.
 */
function AnimatedYears({ value, reduced }: { value: number; reduced: boolean }) {
  const motionValue = useMotionValue(reduced ? value : 0);
  const display = useTransform(motionValue, (v) => formatYears(v));

  useEffect(() => {
    if (reduced) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 1.1,
      ease: [0.22, 0.61, 0.36, 1], // calm ease-out
    });
    return controls.stop;
  }, [value, reduced, motionValue]);

  return (
    <motion.span className="tabular-nums-data" aria-live="polite">
      {display}
    </motion.span>
  );
}

/**
 * KpiChip — one of the three bottom-row chips (Earned / Kept / Margin).
 * Tap target = the whole vertical stack. Active state lifts and slightly
 * brightens the value. The component reports `active` upward so the
 * parent can re-anchor the chart's tooltip / focus, if wired.
 */
function KpiChip({
  label,
  value,
  deltaLabel,
  deltaTone,
  active,
  onClick,
}: {
  label: string;
  value: string;
  deltaLabel: string;
  deltaTone: 'positive' | 'negative' | 'neutral';
  active: boolean;
  onClick: () => void;
}) {
  const chipBg =
    deltaTone === 'positive'
      ? 'bg-editorial-emerald-chip text-editorial-emerald'
      : deltaTone === 'negative'
        ? 'bg-editorial-amber/10 text-editorial-amber'
        : 'bg-editorial-slate/15 text-editorial-slate';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group flex min-h-[48px] flex-1 flex-col items-start gap-1.5 rounded-lg px-1 py-1.5 text-left outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-editorial-emerald/40',
        active
          ? 'bg-editorial-warm/60'
          : 'hover:bg-editorial-warm/40 motion-safe:hover:[&_[data-kpi-value]]:translate-y-[-1px]'
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-editorial-slate">
        {label}
      </span>
      <span
        data-kpi-value
        className="text-[18px] font-semibold tabular-nums-data text-editorial-ink transition-transform"
      >
        {value}
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums-data',
          chipBg
        )}
      >
        {deltaLabel}
      </span>
    </button>
  );
}

export function MoneyStoryHeroV2({
  freedomYears,
  earned,
  kept,
  marginDeltaPoints,
  trendData,
  defaultPeriod = '1Y',
  onPeriodChange,
  drillHref,
  reducedMotion = false,
  className,
}: MoneyStoryHeroV2Props) {
  const [period, setPeriod] = useState<TimePeriod>(defaultPeriod);
  const [activeChip, setActiveChip] = useState<'earned' | 'kept' | 'margin' | null>(null);

  const marginPct = earned > 0 ? Math.round((kept / earned) * 100) : 0;
  const deltaSign = marginDeltaPoints >= 0 ? '+' : '';
  const subText =
    marginDeltaPoints === 0
      ? 'of freedom at your current burn'
      : marginDeltaPoints > 0
        ? `of freedom — your kept margin widened ${marginDeltaPoints} ${marginDeltaPoints === 1 ? 'point' : 'points'}`
        : `of freedom — your kept margin tightened ${Math.abs(marginDeltaPoints)} ${Math.abs(marginDeltaPoints) === 1 ? 'point' : 'points'}`;

  const handlePeriodChange = (next: TimePeriod) => {
    setPeriod(next);
    onPeriodChange?.(next);
  };

  // Outer card — link if drillHref provided, otherwise plain section
  const Tag = drillHref ? motion.a : motion.section;
  const tagProps = drillHref
    ? { href: drillHref, 'aria-label': 'Open your money story details' }
    : { 'aria-label': 'Your freedom horizon — money story' };

  return (
    <Tag
      {...tagProps}
      whileHover={reducedMotion ? undefined : { y: -1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={cn(
        'relative block rounded-[20px] border-[1.5px] border-editorial-divider bg-editorial-paper p-6 shadow-editorial-card outline-none transition-shadow md:p-8',
        'hover:shadow-editorial-card-hover focus-visible:ring-2 focus-visible:ring-editorial-emerald/40',
        className
      )}
    >
      {/* Header row — eyebrow + time-period pill */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-editorial-slate">
          Freedom horizon
        </span>
        <TimePeriodPill value={period} onChange={handlePeriodChange} />
      </div>

      {/* Hero number + breathing dot */}
      <div className="mt-5 flex items-end gap-3">
        <h2 className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-editorial-ink md:text-[48px]">
          <AnimatedYears value={freedomYears} reduced={reducedMotion} />
        </h2>
        <BreathingDot className="mb-2" />
      </div>
      <p className="mt-2 text-sm leading-snug text-editorial-slate">
        {subText}
      </p>

      {/* The ribbon chart — empty trend renders a quiet placeholder
          line so users without enough history still see a coherent
          tile (hero + KPIs work; no misleading flat-zero ribbon). */}
      <div className="mt-6">
        {trendData.length >= 2 ? (
          <FreedomRibbonChart
            data={trendData}
            height={140}
            animate={!reducedMotion}
          />
        ) : (
          <div
            className="flex h-[140px] items-center justify-center rounded-lg border border-dashed border-editorial-divider bg-editorial-warm/40 px-4 text-center text-[13px] leading-relaxed text-editorial-slate"
            aria-label="Trend chart unavailable — not enough history yet"
          >
            Your ribbon unlocks after 2 months of recorded activity.
          </div>
        )}
      </div>

      {/* KPI chips — Earned / Kept / Margin */}
      <div className="mt-5 flex items-stretch gap-2 border-t border-editorial-divider/60 pt-4">
        <KpiChip
          label="Earned"
          value={CURRENCY_FMT.format(earned)}
          deltaLabel="+4.2%"
          deltaTone="positive"
          active={activeChip === 'earned'}
          onClick={() => setActiveChip(activeChip === 'earned' ? null : 'earned')}
        />
        <KpiChip
          label="Kept"
          value={CURRENCY_FMT.format(kept)}
          deltaLabel="+11.1%"
          deltaTone="positive"
          active={activeChip === 'kept'}
          onClick={() => setActiveChip(activeChip === 'kept' ? null : 'kept')}
        />
        <KpiChip
          label="Margin"
          value={`${marginPct}%`}
          deltaLabel={`${deltaSign}${marginDeltaPoints}pp`}
          deltaTone={marginDeltaPoints >= 0 ? 'positive' : 'negative'}
          active={activeChip === 'margin'}
          onClick={() => setActiveChip(activeChip === 'margin' ? null : 'margin')}
        />
      </div>

      {/* Interaction hint — bottom-right, subtle */}
      <div className="mt-4 flex justify-end">
        <span className="inline-flex items-center gap-1 text-xs text-editorial-slate">
          Hover the ribbon for any month
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </span>
      </div>
    </Tag>
  );
}

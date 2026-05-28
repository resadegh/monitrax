'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { appleEase } from '@/components/shell/motion';
import { ArrowUpRight, Home as HomeIcon, KeyRound, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

/**
 * PropertiesHero — premium glassmorphic summary card for the
 * /dashboard/properties page. Sits above the property tiles.
 *
 * Visual vocabulary mirrors components/dashboard/TrailStageIndicator.tsx
 * Stage I (Invest): sky/indigo atmosphere, hero typography, animated
 * allocation thread, springy entry. Honours prefers-reduced-motion.
 */


export interface PropertiesHeroSegment {
  type: 'HOME' | 'INVESTMENT' | 'RENTAL';
  label: string;
  count: number;
  value: number;
}

export interface PropertiesHeroProps {
  totalValue: number; // sum of currentValue across owned properties (HOME + INVESTMENT)
  totalEquity: number;
  totalLoans: number;
  averageLvr: number;
  segments: PropertiesHeroSegment[];
  propertyCount: number;
  ownedCount: number;
}

const SEGMENT_STYLES: Record<
  PropertiesHeroSegment['type'],
  { dot: string; bar: string; chip: string; icon: typeof HomeIcon }
> = {
  HOME: {
    dot: 'bg-sky-500',
    bar: 'bg-gradient-to-r from-sky-400 to-sky-600',
    chip: 'text-sky-700 dark:text-sky-300',
    icon: HomeIcon,
  },
  INVESTMENT: {
    dot: 'bg-indigo-500',
    bar: 'bg-gradient-to-r from-indigo-400 to-violet-600',
    chip: 'text-indigo-700 dark:text-indigo-300',
    icon: ArrowUpRight,
  },
  RENTAL: {
    dot: 'bg-cyan-500',
    bar: 'bg-gradient-to-r from-cyan-400 to-sky-500',
    chip: 'text-cyan-700 dark:text-cyan-300',
    icon: KeyRound,
  },
};

export function PropertiesHero({
  totalValue,
  totalEquity,
  totalLoans,
  averageLvr,
  segments,
  propertyCount,
  ownedCount,
}: PropertiesHeroProps) {
  const reduced = useReducedMotion() ?? false;
  const totalForBar = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const equityPct = totalValue > 0 ? Math.max(0, Math.min(100, (totalEquity / totalValue) * 100)) : 0;

  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.6, ease: appleEase }}
      className="relative isolate overflow-hidden rounded-[22px] border border-sky-300/30 dark:border-sky-400/15 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)]"
    >
      {/* Atmospheric mesh gradient — Stage I (Invest) palette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(900px 420px at 12% -10%, rgba(14,165,233,0.18), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(79,70,229,0.10), transparent 60%), radial-gradient(700px 320px at 50% 50%, rgba(15,23,42,0.06), transparent 65%)',
        }}
      />
      {/* Slow-breathing soft glow */}
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[280px] w-[480px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: 'rgba(14,165,233,0.40)' }}
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="relative px-6 pt-6 pb-7 sm:px-8 sm:pt-8 sm:pb-9">
        {/* Eyebrow */}
        <div className="mb-5 flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-foreground/60" aria-hidden />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Your portfolio
          </h3>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            <TrendingUp className="h-3 w-3" />
            Stage I — Invest
          </span>
        </div>

        {/* Headline + secondary stats */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total portfolio value</p>
            <p
              className="mt-1 text-4xl font-semibold tracking-[-0.02em] tabular-nums text-foreground sm:text-5xl"
              aria-label={`Total portfolio value ${formatCurrency(totalValue)}`}
            >
              <span className="bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700 bg-clip-text text-transparent">
                {formatCurrency(totalValue)}
              </span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {ownedCount === 1 ? '1 owned property' : `${ownedCount} owned properties`}
              {propertyCount > ownedCount && (
                <span className="text-muted-foreground/70">
                  {' '}
                  · {propertyCount - ownedCount} rental{propertyCount - ownedCount > 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>

          {/* KPIs */}
          <dl className="grid grid-cols-3 gap-3 sm:gap-5">
            <KpiCell label="Equity" value={formatCurrency(totalEquity)} accent="emerald" />
            <KpiCell label="Loans" value={formatCurrency(totalLoans)} accent="slate" />
            <KpiCell
              label="Avg LVR"
              value={`${averageLvr.toFixed(1)}%`}
              accent={averageLvr >= 80 ? 'amber' : averageLvr >= 60 ? 'amber-soft' : 'emerald'}
            />
          </dl>
        </div>

        {/* Equity → debt visualisation */}
        {totalValue > 0 && (
          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>
                Equity{' '}
                <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {equityPct.toFixed(1)}%
                </span>
              </span>
              <span>
                Debt{' '}
                <span className="font-semibold tabular-nums text-foreground/70">{(100 - equityPct).toFixed(1)}%</span>
              </span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-foreground/[0.07]">
              <motion.div
                aria-hidden
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                initial={reduced ? { width: `${equityPct}%` } : { width: 0 }}
                animate={{ width: `${equityPct}%` }}
                transition={reduced ? { duration: 0 } : { duration: 1.1, ease: appleEase, delay: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Allocation by type */}
        {segments.length > 0 && (
          <div className="mt-7">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Allocation</p>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-foreground/[0.05]">
              {segments.map((seg, i) => {
                const style = SEGMENT_STYLES[seg.type];
                const pct = (seg.value / totalForBar) * 100;
                if (pct <= 0) return null;
                return (
                  <motion.div
                    key={seg.type}
                    aria-hidden
                    className={`h-full ${style.bar}`}
                    initial={reduced ? { width: `${pct}%` } : { width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={reduced ? { duration: 0 } : { duration: 0.9, ease: appleEase, delay: 0.4 + 0.08 * i }}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {segments.map((seg) => {
                const style = SEGMENT_STYLES[seg.type];
                return (
                  <div key={seg.type} className="flex items-center gap-2 text-xs">
                    <span aria-hidden className={`h-2 w-2 rounded-full ${style.dot}`} />
                    <span className={`font-semibold ${style.chip}`}>{seg.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {seg.count} · {formatCurrency(seg.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function KpiCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'emerald' | 'slate' | 'amber' | 'amber-soft';
}) {
  const tone = {
    emerald: 'text-emerald-700 dark:text-emerald-300',
    slate: 'text-foreground/80',
    amber: 'text-amber-700 dark:text-amber-300',
    'amber-soft': 'text-amber-700 dark:text-amber-300',
  }[accent];

  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums sm:text-xl ${tone}`}>{value}</dd>
    </div>
  );
}

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { appleEase } from '@/components/shell/motion';
import { Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

/**
 * AssetsHero — premium glassmorphic summary card for /dashboard/assets.
 *
 * Visual vocabulary mirrors PropertiesHero / InvestmentsHero, but the
 * atmospheric palette shifts to a **warmer family** (amber + rose +
 * peach) — assets are tangible objects (cars, electronics, furniture,
 * collectibles). The cool sky/indigo Invest palette doesn't suit
 * physical "things you own" the way it suits financial growth, so
 * Assets gets its own sub-palette while staying within Stage I (Invest).
 *
 * Honours prefers-reduced-motion.
 */


export interface AssetsHeroSegment {
  id: string;
  label: string;
  count: number;
  value: number;
  barClass: string;
  dotClass: string;
  chipClass: string;
}

export interface AssetsHeroKpi {
  label: string;
  value: string;
  accent?: 'emerald' | 'rose' | 'neutral';
}

export interface AssetsHeroProps {
  totalValue: number;
  activeCount: number;
  totalCount: number;
  totalPurchaseCost?: number;
  totalAnnualCosts?: number;
  segments?: AssetsHeroSegment[];
}

export function AssetsHero({
  totalValue,
  activeCount,
  totalCount,
  totalPurchaseCost,
  totalAnnualCosts,
  segments = [],
}: AssetsHeroProps) {
  const reduced = useReducedMotion() ?? false;
  const totalForBar = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;
  const inactiveCount = totalCount - activeCount;

  const kpis: AssetsHeroKpi[] = [];
  if (typeof totalPurchaseCost === 'number' && totalPurchaseCost > 0) {
    kpis.push({ label: 'Purchase cost', value: formatCurrency(totalPurchaseCost) });
  }
  if (typeof totalAnnualCosts === 'number' && totalAnnualCosts > 0) {
    kpis.push({ label: 'Annual costs', value: formatCurrency(totalAnnualCosts), accent: 'rose' });
  }
  kpis.push({ label: 'Active', value: String(activeCount) });

  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.6, ease: appleEase }}
      className="relative isolate overflow-hidden rounded-[28px] border border-amber-300/30 dark:border-amber-400/15 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)]"
    >
      {/* Atmospheric mesh gradient — warm Stage-I sub-palette for
          tangible assets (amber + rose + peach). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(900px 420px at 12% -10%, rgba(251,191,36,0.18), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(244,114,182,0.10), transparent 60%), radial-gradient(700px 320px at 50% 50%, rgba(120,53,15,0.06), transparent 65%)',
        }}
      />
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[280px] w-[480px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: 'rgba(251,146,60,0.40)' }}
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="relative px-6 pt-6 pb-7 sm:px-8 sm:pt-8 sm:pb-9">
        {/* Eyebrow */}
        <div className="mb-5 flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-foreground/60" aria-hidden />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Your assets
          </h3>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <Sparkles className="h-3 w-3" />
            Stage I — Invest
          </span>
        </div>

        {/* Headline + KPIs */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total value</p>
            <p
              className="mt-1 text-4xl font-semibold tracking-[-0.02em] tabular-nums text-foreground sm:text-5xl"
              aria-label={`Total assets value ${formatCurrency(totalValue)}`}
            >
              <span className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 bg-clip-text text-transparent">
                {formatCurrency(totalValue)}
              </span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeCount} active {activeCount === 1 ? 'asset' : 'assets'}
              {inactiveCount > 0 && (
                <span className="text-muted-foreground/70"> · {inactiveCount} sold or written off</span>
              )}
            </p>
          </div>

          {kpis.length > 0 && (
            <dl className={`grid gap-3 sm:gap-5 ${kpis.length === 1 ? 'grid-cols-1' : kpis.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {kpis.map((k) => (
                <KpiCell key={k.label} label={k.label} value={k.value} accent={k.accent ?? 'neutral'} />
              ))}
            </dl>
          )}
        </div>

        {/* Allocation by type */}
        {segments.length > 0 && (
          <div className="mt-7">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Allocation by type</p>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-foreground/[0.05]">
              {segments.map((seg, i) => {
                const pct = (Math.max(0, seg.value) / totalForBar) * 100;
                if (pct <= 0) return null;
                return (
                  <motion.div
                    key={seg.id}
                    aria-hidden
                    className={`h-full ${seg.barClass}`}
                    initial={reduced ? { width: `${pct}%` } : { width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={reduced ? { duration: 0 } : { duration: 0.9, ease: appleEase, delay: 0.3 + 0.08 * i }}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {segments.map((seg) => (
                <div key={seg.id} className="flex items-center gap-2 text-xs">
                  <span aria-hidden className={`h-2 w-2 rounded-full ${seg.dotClass}`} />
                  <span className={`font-semibold ${seg.chipClass}`}>{seg.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {seg.count} · {formatCurrency(seg.value)}
                  </span>
                </div>
              ))}
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
  accent: 'emerald' | 'rose' | 'neutral';
}) {
  const tone =
    accent === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-300'
      : accent === 'rose'
      ? 'text-rose-700 dark:text-rose-300'
      : 'text-foreground/80';
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums sm:text-xl ${tone}`}>{value}</dd>
    </div>
  );
}

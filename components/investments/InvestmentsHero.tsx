'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { appleEase } from '@/components/shell/motion';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

/**
 * InvestmentsHero — premium glassmorphic summary card for the
 * /dashboard/investments/* pages. Sits above the tile grid.
 *
 * Shared between the accounts page and the holdings page — the
 * `segments`, `countLabel`, and KPI props are parameterised so each
 * caller passes its own aggregate.
 *
 * Visual vocabulary mirrors components/properties/PropertiesHero.tsx
 * (Stage I — Invest): sky/indigo atmosphere, hero typography,
 * animated allocation thread, springy entry. Honours
 * prefers-reduced-motion.
 */


export interface InvestmentsHeroSegment {
  /** A stable id for keying the segment in the bar (e.g. 'BROKERAGE', 'SHARE') */
  id: string;
  label: string;
  count: number;
  value: number;
  /** Tailwind background gradient classes for this segment's bar slice */
  barClass: string;
  /** Solid colour class for the legend dot */
  dotClass: string;
  /** Foreground text class for the legend label */
  chipClass: string;
}

export interface InvestmentsHeroKpi {
  label: string;
  value: string;
  /** Optional accent — 'emerald' = positive (gain), 'rose' = negative (loss), default neutral */
  accent?: 'emerald' | 'rose' | 'neutral';
}

export interface InvestmentsHeroProps {
  /** Hero title shown above the total — e.g. "Your investment accounts" or "Your holdings". */
  title: string;
  /** Big number — usually a total in dollars. */
  total: number;
  /** Subtitle line under the total — e.g. "5 accounts" or "12 positions across 3 accounts". */
  subtitle: string;
  /** Up-to-three KPI cells (e.g. holdings count, cash, gain). Render order = display order. */
  kpis?: InvestmentsHeroKpi[];
  /** Allocation bar segments (by type). Optional — hide if empty. */
  segments?: InvestmentsHeroSegment[];
  /** Section label for the allocation bar — e.g. "Allocation by account type". */
  segmentsLabel?: string;
}

export function InvestmentsHero({
  title,
  total,
  subtitle,
  kpis = [],
  segments = [],
  segmentsLabel = 'Allocation',
}: InvestmentsHeroProps) {
  const reduced = useReducedMotion() ?? false;
  const totalForBar = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;

  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.6, ease: appleEase }}
      className="relative isolate overflow-hidden rounded-[28px] border border-sky-300/30 dark:border-sky-400/15 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)]"
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
            {title}
          </h3>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            <TrendingUp className="h-3 w-3" />
            Stage I — Invest
          </span>
        </div>

        {/* Headline + secondary KPIs */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total value</p>
            <p
              className="mt-1 text-4xl font-semibold tracking-[-0.02em] tabular-nums text-foreground sm:text-5xl"
              aria-label={`Total value ${formatCurrency(total)}`}
            >
              <span className="bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700 bg-clip-text text-transparent">
                {formatCurrency(total)}
              </span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{segmentsLabel}</p>
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

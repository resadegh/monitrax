'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { appleEase, springSnap as springy } from '@/components/shell/motion';
import {
  BarChart3,
  Bitcoin,
  Edit2,
  Eye,
  Layers,
  PieChart,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { HoldingGlyph } from '@/components/wealth/wealthGlyphs';

/**
 * HoldingTile — Stage I (Invest) v4 tile pattern, applied to
 * individual investment holdings (Phase 39.2).
 *
 * Visual vocabulary mirrors components/properties/PropertyTile.tsx and
 * components/investments/InvestmentAccountTile.tsx — glassmorphic surface,
 * atmosphere mesh, hue tint that intensifies on hover, top accent strip,
 * large filled silhouette glyph, springy hover-lift, gradient CTA.
 *
 * Per-type palette stays within Stage I (sky/indigo) family except CRYPTO
 * which gets a warm amber accent — the universal "digital gold" cue
 * that distinguishes it without breaking the Invest stage tone.
 */


export type HoldingType = 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';

export interface HoldingTileData {
  id: string;
  ticker: string;
  type: HoldingType;
  units: number;
  averagePrice: number;
  value: number; // units × averagePrice
  allocation: number; // % of total portfolio
  frankingPercentage: number | null;
  accountName?: string;
  currency: string;
}

export interface HoldingTileProps {
  holding: HoldingTileData;
  index?: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function typeMeta(type: HoldingType) {
  switch (type) {
    case 'SHARE':
      // Sky/blue — direct ownership of a single company
      return {
        label: 'Share',
        icon: BarChart3,
        accent: 'from-sky-500 to-blue-500',
        iconBg: 'from-sky-500/15 to-blue-500/15',
        iconRing: 'ring-sky-400/25',
        iconColor: 'text-sky-600 dark:text-sky-400',
        cta: 'from-sky-500 to-blue-600',
        ctaShadowDefault: 'shadow-sky-500/15',
        ctaShadowHover: 'hover:shadow-sky-500/25',
        tileBg: 'bg-sky-50/60 dark:bg-sky-950/25 group-hover:bg-sky-100/80 dark:group-hover:bg-sky-900/40',
        tileBorder: 'border-sky-300/40 dark:border-sky-700/30 group-hover:border-sky-400/70 dark:group-hover:border-sky-500/55',
        glyphColor: 'text-sky-600 dark:text-sky-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 0%, rgba(14,165,233,0.16), transparent 60%), radial-gradient(420px 220px at 0% 100%, rgba(59,130,246,0.10), transparent 60%)',
      };
    case 'ETF':
      // Violet/sky — basket of holdings
      return {
        label: 'ETF',
        icon: Layers,
        accent: 'from-violet-500 to-sky-500',
        iconBg: 'from-violet-500/15 to-sky-500/15',
        iconRing: 'ring-violet-400/25',
        iconColor: 'text-violet-600 dark:text-violet-400',
        cta: 'from-violet-500 to-sky-600',
        ctaShadowDefault: 'shadow-violet-500/15',
        ctaShadowHover: 'hover:shadow-violet-500/25',
        tileBg: 'bg-violet-50/60 dark:bg-violet-950/25 group-hover:bg-violet-100/80 dark:group-hover:bg-violet-900/40',
        tileBorder: 'border-violet-300/40 dark:border-violet-700/30 group-hover:border-violet-400/70 dark:group-hover:border-violet-500/55',
        glyphColor: 'text-violet-600 dark:text-violet-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 0%, rgba(139,92,246,0.16), transparent 60%), radial-gradient(380px 200px at 0% 100%, rgba(14,165,233,0.10), transparent 60%)',
      };
    case 'MANAGED_FUND':
      // Indigo/blue — actively managed
      return {
        label: 'Managed fund',
        icon: PieChart,
        accent: 'from-indigo-500 to-blue-500',
        iconBg: 'from-indigo-500/15 to-blue-500/15',
        iconRing: 'ring-indigo-400/25',
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        cta: 'from-indigo-500 to-blue-600',
        ctaShadowDefault: 'shadow-indigo-500/15',
        ctaShadowHover: 'hover:shadow-indigo-500/25',
        tileBg: 'bg-indigo-50/60 dark:bg-indigo-950/25 group-hover:bg-indigo-100/80 dark:group-hover:bg-indigo-900/40',
        tileBorder: 'border-indigo-300/40 dark:border-indigo-700/30 group-hover:border-indigo-400/70 dark:group-hover:border-indigo-500/55',
        glyphColor: 'text-indigo-600 dark:text-indigo-400',
        atmosphere:
          'radial-gradient(440px 240px at 50% 0%, rgba(79,70,229,0.16), transparent 60%), radial-gradient(420px 220px at 100% 100%, rgba(59,130,246,0.10), transparent 60%)',
      };
    case 'CRYPTO':
      // Amber/orange — "digital gold." Distinguishes crypto without
      // breaking the Invest stage feel; warm hue cues volatility and
      // novelty.
      return {
        label: 'Crypto',
        icon: Bitcoin,
        accent: 'from-amber-500 to-orange-500',
        iconBg: 'from-amber-500/15 to-orange-500/15',
        iconRing: 'ring-amber-400/25',
        iconColor: 'text-amber-600 dark:text-amber-400',
        cta: 'from-amber-500 to-orange-600',
        ctaShadowDefault: 'shadow-amber-500/15',
        ctaShadowHover: 'hover:shadow-amber-500/25',
        tileBg: 'bg-amber-50/60 dark:bg-amber-950/25 group-hover:bg-amber-100/80 dark:group-hover:bg-amber-900/40',
        tileBorder: 'border-amber-300/40 dark:border-amber-700/30 group-hover:border-amber-400/70 dark:group-hover:border-amber-500/55',
        glyphColor: 'text-amber-600 dark:text-amber-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 100%, rgba(251,146,60,0.15), transparent 65%), radial-gradient(380px 200px at 0% 0%, rgba(251,191,36,0.08), transparent 60%)',
      };
  }
}

export function HoldingTile({ holding, index = 0, onView, onEdit, onDelete }: HoldingTileProps) {
  const reduced = useReducedMotion() ?? false;
  const meta = typeMeta(holding.type);
  const Icon = meta.icon;

  return (
    <motion.div
      layout
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.55, ease: appleEase, delay: 0.04 * index }}
      whileHover={reduced ? undefined : { y: -3 }}
      className={`group relative isolate overflow-hidden rounded-[22px] border ${meta.tileBorder} ${meta.tileBg} backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow] duration-500 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_48px_rgba(15,23,42,0.10)]`}
    >
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: meta.atmosphere }}
      />

      {/* Large filled silhouette watermark */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -z-10 inset-y-0 left-0 right-[-12%] ${meta.glyphColor} opacity-[0.06] transition-opacity duration-500 group-hover:opacity-[0.12]`}
      >
        <HoldingGlyph type={holding.type} delay={0.04 * index} className="h-full w-full" />
      </div>

      {/* Top accent strip */}
      <div aria-hidden className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${meta.accent}`} />

      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.iconBg} ring-1 ${meta.iconRing}`}>
            <Icon className={`h-5 w-5 ${meta.iconColor}`} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground tabular-nums">
              {holding.ticker}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {holding.accountName ? `${holding.accountName} · ` : ''}
              {holding.currency}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`inline-flex items-center bg-gradient-to-r ${meta.accent} bg-clip-text text-[10px] font-bold uppercase tracking-[0.14em] text-transparent`}>
                {meta.label}
              </span>
              {holding.frankingPercentage !== null && holding.frankingPercentage > 0 && (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20">
                  {holding.frankingPercentage}% franked
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-0 translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 sm:flex">
            <button
              type="button"
              onClick={onEdit}
              title="Edit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Headline value */}
        <div className="mt-5 flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current value</p>
            <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {formatCurrency(holding.value)}
            </p>
          </div>
          {holding.allocation > 0 && (
            <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums bg-gradient-to-r ${meta.accent} text-white shadow-sm`}>
              <TrendingUp className="h-3 w-3" />
              {holding.allocation.toFixed(1)}%
            </div>
          )}
        </div>

        {/* Units + avg price row */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className={`rounded-xl border ${meta.tileBorder.split(' ')[0]} bg-background/40 px-3.5 py-3`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Units</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {holding.units.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </p>
          </div>
          <div className={`rounded-xl border ${meta.tileBorder.split(' ')[0]} bg-background/40 px-3.5 py-3`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Avg price</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {formatCurrency(holding.averagePrice)}
            </p>
          </div>
        </div>

        {/* Primary CTA */}
        <motion.button
          type="button"
          onClick={onView}
          whileHover={reduced ? undefined : { y: -1 }}
          whileTap={reduced ? undefined : { scale: 0.98 }}
          transition={springy}
          className={`mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br ${meta.cta} px-4 py-2.5 text-sm font-semibold text-white shadow-md ${meta.ctaShadowDefault} transition-shadow hover:shadow-lg ${meta.ctaShadowHover}`}
        >
          <Eye className="h-4 w-4" />
          View details
        </motion.button>
      </div>
    </motion.div>
  );
}

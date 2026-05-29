'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { appleEase, springSnap as springy } from '@/components/shell/motion';
import {
  Car,
  Edit2,
  Eye,
  Gem,
  Laptop,
  Package,
  Receipt,
  Sofa,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { AssetGlyph } from '@/components/wealth/wealthGlyphs';
import { RenewalChip } from '@/components/reminders/RenewalChip';
import type { ReminderUrgency } from '@/lib/reminders/reminderEngine';

/**
 * AssetTile — Stage I (Invest) v4 tile pattern, applied to personal
 * assets (Phase 39.3).
 *
 * Visual vocabulary mirrors PropertyTile / InvestmentAccountTile —
 * glassmorphic surface, atmosphere mesh, hue tint that intensifies on
 * hover, top accent strip, large filled silhouette glyph, springy
 * hover-lift, gradient CTA.
 *
 * Per-type palette uses a **warmer family** than Investments —
 * tangible objects (cars, electronics, furniture, etc.) feel right
 * in amber/rose/peach tones rather than the cool sky/indigo used for
 * financial growth.
 *
 * SOLD / WRITTEN_OFF assets get a desaturated neutral treatment so
 * they read as "no longer active" without being negative.
 */


export type AssetType =
  | 'VEHICLE'
  | 'ELECTRONICS'
  | 'FURNITURE'
  | 'EQUIPMENT'
  | 'COLLECTIBLE'
  | 'OTHER';
export type AssetStatus = 'ACTIVE' | 'SOLD' | 'WRITTEN_OFF';

export interface AssetTileData {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  /** Vehicle subtitle: "Make Model Year" — only used for VEHICLE */
  vehicleSubtitle?: string;
  purchasePrice: number;
  currentValue: number;
  depreciation: number; // positive = lost value, negative = gained value
  depreciationPercent: number;
  annualExpenses: number;
  /**
   * Most-urgent renewal for this asset (Phase 21.5), or undefined when none
   * is coming up. Computed by the canonical reminder engine on the page —
   * the tile only renders it (SSOT, CLAUDE.md §12.2).
   */
  renewal?: { urgency: ReminderUrgency; daysUntilDue: number; label: string };
}

export interface AssetTileProps {
  asset: AssetTileData;
  index?: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function typeMeta(type: AssetType) {
  switch (type) {
    case 'VEHICLE':
      // Amber / orange — primary "thing you own that moves" tile
      return {
        label: 'Vehicle',
        icon: Car,
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
    case 'ELECTRONICS':
      // Rose/pink — distinct from vehicle, modern + "consumer"
      return {
        label: 'Electronics',
        icon: Laptop,
        accent: 'from-rose-500 to-pink-500',
        iconBg: 'from-rose-500/15 to-pink-500/15',
        iconRing: 'ring-rose-400/25',
        iconColor: 'text-rose-600 dark:text-rose-400',
        cta: 'from-rose-500 to-pink-600',
        ctaShadowDefault: 'shadow-rose-500/15',
        ctaShadowHover: 'hover:shadow-rose-500/25',
        tileBg: 'bg-rose-50/60 dark:bg-rose-950/25 group-hover:bg-rose-100/80 dark:group-hover:bg-rose-900/40',
        tileBorder: 'border-rose-300/40 dark:border-rose-700/30 group-hover:border-rose-400/70 dark:group-hover:border-rose-500/55',
        glyphColor: 'text-rose-600 dark:text-rose-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 0%, rgba(244,63,94,0.14), transparent 60%), radial-gradient(380px 200px at 0% 100%, rgba(236,72,153,0.10), transparent 60%)',
      };
    case 'FURNITURE':
      // Stone/warm-grey + amber — domestic, settled
      return {
        label: 'Furniture',
        icon: Sofa,
        accent: 'from-stone-500 to-amber-500',
        iconBg: 'from-stone-500/15 to-amber-500/15',
        iconRing: 'ring-stone-400/25',
        iconColor: 'text-stone-600 dark:text-stone-400',
        cta: 'from-stone-500 to-amber-600',
        ctaShadowDefault: 'shadow-stone-500/15',
        ctaShadowHover: 'hover:shadow-stone-500/25',
        tileBg: 'bg-stone-50/60 dark:bg-stone-950/25 group-hover:bg-stone-100/80 dark:group-hover:bg-stone-900/40',
        tileBorder: 'border-stone-300/40 dark:border-stone-700/30 group-hover:border-stone-400/70 dark:group-hover:border-stone-500/55',
        glyphColor: 'text-stone-600 dark:text-stone-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 100%, rgba(168,162,158,0.15), transparent 65%), radial-gradient(380px 200px at 0% 0%, rgba(251,191,36,0.06), transparent 60%)',
      };
    case 'EQUIPMENT':
      // Slate/blue-grey — utilitarian, tools/equipment
      return {
        label: 'Equipment',
        icon: Wrench,
        accent: 'from-slate-500 to-zinc-500',
        iconBg: 'from-slate-500/15 to-zinc-500/15',
        iconRing: 'ring-slate-400/25',
        iconColor: 'text-slate-600 dark:text-slate-400',
        cta: 'from-slate-500 to-zinc-600',
        ctaShadowDefault: 'shadow-slate-500/15',
        ctaShadowHover: 'hover:shadow-slate-500/25',
        tileBg: 'bg-slate-50/60 dark:bg-slate-950/25 group-hover:bg-slate-100/80 dark:group-hover:bg-slate-900/40',
        tileBorder: 'border-slate-300/40 dark:border-slate-700/30 group-hover:border-slate-400/70 dark:group-hover:border-slate-500/55',
        glyphColor: 'text-slate-600 dark:text-slate-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 0%, rgba(100,116,139,0.14), transparent 60%), radial-gradient(380px 200px at 0% 100%, rgba(113,113,122,0.10), transparent 60%)',
      };
    case 'COLLECTIBLE':
      // Fuchsia/violet — special, valuable, one-off
      return {
        label: 'Collectible',
        icon: Gem,
        accent: 'from-fuchsia-500 to-violet-500',
        iconBg: 'from-fuchsia-500/15 to-violet-500/15',
        iconRing: 'ring-fuchsia-400/25',
        iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
        cta: 'from-fuchsia-500 to-violet-600',
        ctaShadowDefault: 'shadow-fuchsia-500/15',
        ctaShadowHover: 'hover:shadow-fuchsia-500/25',
        tileBg: 'bg-fuchsia-50/60 dark:bg-fuchsia-950/25 group-hover:bg-fuchsia-100/80 dark:group-hover:bg-fuchsia-900/40',
        tileBorder: 'border-fuchsia-300/40 dark:border-fuchsia-700/30 group-hover:border-fuchsia-400/70 dark:group-hover:border-fuchsia-500/55',
        glyphColor: 'text-fuchsia-600 dark:text-fuchsia-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 100%, rgba(217,70,239,0.14), transparent 65%), radial-gradient(380px 200px at 0% 0%, rgba(139,92,246,0.10), transparent 60%)',
      };
    case 'OTHER':
      // Warm peach + neutral — generic but still warm
      return {
        label: 'Other',
        icon: Package,
        accent: 'from-orange-400 to-amber-500',
        iconBg: 'from-orange-400/15 to-amber-500/15',
        iconRing: 'ring-orange-400/25',
        iconColor: 'text-orange-600 dark:text-orange-400',
        cta: 'from-orange-400 to-amber-600',
        ctaShadowDefault: 'shadow-orange-500/15',
        ctaShadowHover: 'hover:shadow-orange-500/25',
        tileBg: 'bg-orange-50/60 dark:bg-orange-950/25 group-hover:bg-orange-100/80 dark:group-hover:bg-orange-900/40',
        tileBorder: 'border-orange-300/40 dark:border-orange-700/30 group-hover:border-orange-400/70 dark:group-hover:border-orange-500/55',
        glyphColor: 'text-orange-600 dark:text-orange-400',
        atmosphere:
          'radial-gradient(420px 220px at 50% 50%, rgba(251,146,60,0.12), transparent 65%), radial-gradient(320px 180px at 100% 100%, rgba(251,191,36,0.08), transparent 60%)',
      };
  }
}

function statusMeta(status: AssetStatus) {
  switch (status) {
    case 'ACTIVE':
      return null; // no badge for active — it's the default
    case 'SOLD':
      return {
        label: 'Sold',
        className:
          'bg-foreground/[0.06] text-foreground/70 ring-1 ring-foreground/10',
      };
    case 'WRITTEN_OFF':
      return {
        label: 'Written off',
        className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20',
      };
  }
}

export function AssetTile({ asset, index = 0, onView, onEdit, onDelete }: AssetTileProps) {
  const reduced = useReducedMotion() ?? false;
  const meta = typeMeta(asset.type);
  const Icon = meta.icon;
  const status = statusMeta(asset.status);
  const isActive = asset.status === 'ACTIVE';
  const lostValue = asset.depreciation > 0;

  return (
    <motion.div
      layout
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.55, ease: appleEase, delay: 0.04 * index }}
      whileHover={reduced ? undefined : { y: -3 }}
      className={`group relative isolate overflow-hidden rounded-[22px] border ${meta.tileBorder} ${meta.tileBg} backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow] duration-500 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_48px_rgba(15,23,42,0.10)] ${
        isActive ? '' : 'opacity-75'
      }`}
    >
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: meta.atmosphere }}
      />

      {/* Filled silhouette watermark */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -z-10 inset-y-0 left-0 right-[-12%] ${meta.glyphColor} opacity-[0.06] transition-opacity duration-500 group-hover:opacity-[0.12]`}
      >
        <AssetGlyph type={asset.type} delay={0.04 * index} className="h-full w-full" />
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
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">{asset.name}</h3>
            {asset.vehicleSubtitle && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{asset.vehicleSubtitle}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`inline-flex items-center bg-gradient-to-r ${meta.accent} bg-clip-text text-[10px] font-bold uppercase tracking-[0.14em] text-transparent`}>
                {meta.label}
              </span>
              {status && (
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${status.className}`}>
                  {status.label}
                </span>
              )}
              {asset.renewal && (
                <RenewalChip
                  urgency={asset.renewal.urgency}
                  daysUntilDue={asset.renewal.daysUntilDue}
                  label={asset.renewal.label}
                />
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
              {formatCurrency(asset.currentValue)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Purchased: <span className="tabular-nums">{formatCurrency(asset.purchasePrice)}</span>
            </p>
          </div>
          {asset.depreciationPercent !== 0 && (
            <div
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                lostValue
                  ? 'bg-rose-500/12 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20'
                  : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20'
              }`}
            >
              {lostValue ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {lostValue ? '−' : '+'}
              {Math.abs(asset.depreciationPercent).toFixed(1)}%
            </div>
          )}
        </div>

        {/* KPI row: depreciation $ + annual costs */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div
            className={`rounded-xl border px-3.5 py-3 ${
              lostValue
                ? 'border-rose-500/15 bg-rose-500/5'
                : asset.depreciation < 0
                ? 'border-emerald-500/15 bg-emerald-500/5'
                : `${meta.tileBorder.split(' ')[0]} bg-background/40`
            }`}
          >
            <p
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                lostValue
                  ? 'text-rose-700 dark:text-rose-300'
                  : asset.depreciation < 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-muted-foreground'
              }`}
            >
              {lostValue ? 'Depreciated' : asset.depreciation < 0 ? 'Appreciated' : 'No change'}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {formatCurrency(Math.abs(asset.depreciation))}
            </p>
          </div>
          <div className={`rounded-xl border ${meta.tileBorder.split(' ')[0]} bg-background/40 px-3.5 py-3`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Annual cost</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {formatCurrency(asset.annualExpenses)}
              {asset.annualExpenses > 0 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">/yr</span>
              )}
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

'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowUpRight,
  Edit2,
  Eye,
  FileText,
  Home as HomeIcon,
  KeyRound,
  Landmark,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { PropertyGlyph } from '@/components/wealth/wealthGlyphs';
import { useIsMobile } from '@/hooks/useIsMobile';

/**
 * PropertyTile — premium glassmorphic property card.
 *
 * Part of the My Wealth (TRAIL Stage I — Invest) redesign.
 * Visual vocabulary mirrors components/dashboard/TrailStageIndicator.tsx:
 * sky/indigo Invest palette, appleEase, springy physics, glassmorphic
 * card, soft glow on hover. Honours prefers-reduced-motion.
 *
 * Tone (per TRAIL_FRAMEWORK.md §2 Stage I): wealth-building celebration.
 * Greens for equity gains, sky/indigo for the Invest stage signal,
 * warm amber only for genuine cautions (LVR > 80%).
 */

const appleEase: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];
const springy = { type: 'spring', stiffness: 320, damping: 28, mass: 0.8 } as const;

export interface PropertyTileData {
  id: string;
  name: string;
  address: string;
  type: 'HOME' | 'INVESTMENT' | 'RENTAL';
  purchasePrice: number;
  currentValue: number;
  loansCount: number;
  incomeCount: number;
  expenseCount: number;
  depreciationCount: number;
  totalRentExpense?: number; // RENTAL only — annualised
}

export interface PropertyTileMetrics {
  equity: number;
  lvr: number;
  gainPercentage: number;
  rentalYield: number;
  cashflow: number;
}

export interface PropertyTileProps {
  property: PropertyTileData;
  metrics: PropertyTileMetrics;
  index?: number; // for stagger
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function lvrTone(lvr: number): { text: string; bg: string; ring: string; label: string } {
  if (lvr >= 80) return { text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/15', ring: 'ring-amber-500/30', label: 'High' };
  if (lvr >= 60) return { text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20', label: 'Moderate' };
  return { text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', label: 'Healthy' };
}

function typeMeta(type: PropertyTileData['type']) {
  // Per-type tonal palette — each type gets a distinct emotional
  // colour identity. Differentiation happens through atmosphere,
  // icon tone, accent strip, label gradient, and CTA — never through
  // tile shape (so the grid stays coherent).
  switch (type) {
    case 'HOME':
      // Warm hearth — amber + peach. Conveys home, comfort, the room
      // you live in. Glow positioned bottom-right (fireplace), with a
      // softer wash top-left (window).
      return {
        label: 'Primary residence',
        icon: HomeIcon,
        accent: 'from-amber-500 to-orange-500',
        iconBg: 'from-amber-500/15 to-orange-500/15',
        iconRing: 'ring-amber-400/25',
        iconColor: 'text-amber-600 dark:text-amber-400',
        cta: 'from-amber-500 to-orange-600',
        ctaShadowDefault: 'shadow-amber-500/15',
        ctaShadowHover: 'hover:shadow-amber-500/25',
        // Tile surface tint — v4: shade jump on hover (50 → 100 light,
        // 950 → 900 dark) so the colour change is actually visible.
        // v3 only bumped opacity within the same shade and the difference
        // was imperceptible.
        tileBg:
          'bg-amber-50/60 dark:bg-amber-950/25 group-hover:bg-amber-100/80 dark:group-hover:bg-amber-900/40',
        tileBorder:
          'border-amber-300/40 dark:border-amber-700/30 group-hover:border-amber-400/70 dark:group-hover:border-amber-500/55',
        // Silhouette tint — same family, slightly muted vs the icon
        glyphColor: 'text-amber-600 dark:text-amber-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 100%, rgba(251,146,60,0.15), transparent 65%), radial-gradient(380px 200px at 0% 0%, rgba(251,191,36,0.08), transparent 60%)',
      };
    case 'INVESTMENT':
      // Cool growth — sky + indigo. Conveys ambition, future, ascent.
      // Diagonal sweep from bottom-left to top-right (upward growth).
      return {
        label: 'Investment property',
        icon: ArrowUpRight,
        accent: 'from-sky-500 to-indigo-500',
        iconBg: 'from-sky-500/15 to-indigo-500/15',
        iconRing: 'ring-sky-400/25',
        iconColor: 'text-sky-600 dark:text-sky-400',
        cta: 'from-sky-500 to-indigo-600',
        ctaShadowDefault: 'shadow-sky-500/15',
        ctaShadowHover: 'hover:shadow-sky-500/25',
        tileBg:
          'bg-sky-50/60 dark:bg-sky-950/25 group-hover:bg-sky-100/80 dark:group-hover:bg-sky-900/40',
        tileBorder:
          'border-sky-300/40 dark:border-sky-700/30 group-hover:border-sky-400/70 dark:group-hover:border-sky-500/55',
        glyphColor: 'text-sky-600 dark:text-sky-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 0%, rgba(14,165,233,0.16), transparent 60%), radial-gradient(420px 220px at 0% 100%, rgba(79,70,229,0.10), transparent 60%)',
      };
    case 'RENTAL':
      // Calm transition — teal + cyan. Conveys transient, neutral —
      // neither owning nor heavy. Soft centred wash, no directional
      // pull (rentals are temporary by nature).
      return {
        label: 'Rental (renting)',
        icon: KeyRound,
        accent: 'from-teal-500 to-cyan-500',
        iconBg: 'from-teal-500/15 to-cyan-500/15',
        iconRing: 'ring-teal-400/25',
        iconColor: 'text-teal-600 dark:text-teal-400',
        cta: 'from-teal-500 to-cyan-600',
        ctaShadowDefault: 'shadow-teal-500/15',
        ctaShadowHover: 'hover:shadow-teal-500/25',
        tileBg:
          'bg-teal-50/60 dark:bg-teal-950/25 group-hover:bg-teal-100/80 dark:group-hover:bg-teal-900/40',
        tileBorder:
          'border-teal-300/40 dark:border-teal-700/30 group-hover:border-teal-400/70 dark:group-hover:border-teal-500/55',
        glyphColor: 'text-teal-600 dark:text-teal-400',
        atmosphere:
          'radial-gradient(420px 220px at 50% 50%, rgba(20,184,166,0.12), transparent 65%), radial-gradient(320px 180px at 100% 100%, rgba(34,211,238,0.10), transparent 60%)',
      };
  }
}

export function PropertyTile({ property, metrics, index = 0, onView, onEdit, onDelete }: PropertyTileProps) {
  const reduced = useReducedMotion() ?? false;
  const isMobile = useIsMobile();
  const meta = typeMeta(property.type);
  const Icon = meta.icon;
  const lvr = lvrTone(metrics.lvr);
  const isPositiveGain = metrics.gainPercentage >= 0;
  const isInvestment = property.type === 'INVESTMENT';
  const isRental = property.type === 'RENTAL';

  // Mobile sticky-stack scroll pattern (Phase 39 mobile interaction):
  // each tile uses position:sticky on mobile so the next tile rises
  // up and visually OVERLAYS the current one (Apple Wallet card-deck
  // feel) instead of a flat list scroll. As the next tile covers
  // this one, scrollYProgress ramps from 0→1 and we apply a subtle
  // scale + opacity dim to give a depth/parallax cue ("the receding
  // tile is moving back while the new one comes forward").
  // Disabled on desktop (md+) where the grid is multi-column, and
  // disabled when prefers-reduced-motion is set.
  const stackRef = useRef<HTMLDivElement>(null);
  const stackEnabled = isMobile && !reduced;
  const { scrollYProgress } = useScroll({
    target: stackRef,
    offset: ['start start', 'end start'],
  });
  // Subtle variant — pairs with v4 atmosphere/hue treatment.
  // Tweak these two lines to dial drama later (e.g. 0.92 / 0.5 for
  // a more cinematic Apple-iOS-product-page feel).
  const stackScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);
  const stackOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.7]);

  const tile = (
    <motion.div
      layout
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.55, ease: appleEase, delay: 0.04 * index }}
      whileHover={reduced ? undefined : { y: -3 }}
      className={`group relative isolate overflow-hidden rounded-[22px] border ${meta.tileBorder} ${meta.tileBg} backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow] duration-500 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_48px_rgba(15,23,42,0.10)]`}
    >
      {/* Atmosphere — per-type tonal wash (warm for HOME, cool for
          INVESTMENT, cyan for RENTAL). Subtle by default, lifts on hover. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: meta.atmosphere }}
      />

      {/* Filled silhouette watermark — v4: nearly fills the whole tile
          (was 58% × 64% in a corner; now ~110% × full height with a
          right-bleed). The SVG's preserveAspectRatio="xMaxYMid meet"
          aligns the silhouette to the right edge of the container, so
          the visible composition leans right while the left half
          fades into the atmosphere. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -z-10 inset-y-0 left-0 right-[-12%] ${meta.glyphColor} opacity-[0.06] transition-opacity duration-500 group-hover:opacity-[0.12]`}
      >
        <PropertyGlyph type={property.type} delay={0.04 * index} className="h-full w-full" />
      </div>

      {/* Top accent strip — type-coloured */}
      <div
        aria-hidden
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${meta.accent}`}
      />

      <div className="p-5 sm:p-6">
        {/* Header: icon + name + type badge + actions */}
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.iconBg} ring-1 ${meta.iconRing}`}>
            <Icon className={`h-5 w-5 ${meta.iconColor}`} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
              {property.name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{property.address || '—'}</p>
            <span
              className={`mt-2 inline-flex items-center rounded-full bg-gradient-to-r ${meta.accent} bg-clip-text px-0 text-[10px] font-bold uppercase tracking-[0.14em] text-transparent`}
            >
              {meta.label}
            </span>
          </div>

          {/* Hover-reveal action cluster */}
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

        {/* Body — branches by type */}
        {isRental ? (
          <div className="mt-5 rounded-xl border border-sky-200/40 bg-sky-50/40 dark:border-sky-400/15 dark:bg-sky-500/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">Annual rent</p>
            {property.totalRentExpense && property.totalRentExpense > 0 ? (
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {formatCurrency(property.totalRentExpense)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/yr</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Add rent as an expense to track it here.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Headline value */}
            <div className="mt-5 flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current value</p>
                <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatCurrency(property.currentValue)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Purchased: <span className="tabular-nums">{formatCurrency(property.purchasePrice)}</span>
                </p>
              </div>
              <div
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                  isPositiveGain
                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20'
                    : 'bg-rose-500/12 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20'
                }`}
              >
                {isPositiveGain ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {metrics.gainPercentage >= 0 ? '+' : ''}
                {metrics.gainPercentage.toFixed(1)}%
              </div>
            </div>

            {/* Equity + LVR row */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Equity</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                  {formatCurrency(metrics.equity)}
                </p>
              </div>
              <div className={`rounded-xl border px-3.5 py-3 ${lvr.bg} ring-1 ${lvr.ring} border-transparent`}>
                <div className="flex items-center justify-between">
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${lvr.text}`}>LVR</p>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${lvr.text} opacity-70`}>{lvr.label}</span>
                </div>
                <p className={`mt-0.5 text-lg font-semibold tabular-nums ${lvr.text}`}>
                  {metrics.lvr.toFixed(1)}%
                </p>
                {/* mini LVR bar */}
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                  <motion.div
                    aria-hidden
                    className={`h-full rounded-full ${
                      metrics.lvr >= 80
                        ? 'bg-amber-500'
                        : metrics.lvr >= 60
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                    initial={reduced ? { width: `${Math.min(100, metrics.lvr)}%` } : { width: 0 }}
                    animate={{ width: `${Math.min(100, metrics.lvr)}%` }}
                    transition={reduced ? { duration: 0 } : { duration: 0.9, ease: appleEase, delay: 0.2 + 0.04 * index }}
                  />
                </div>
              </div>
            </div>

            {/* Investment-only: yield + cashflow */}
            {isInvestment && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-3.5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">Yield</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                    {metrics.rentalYield.toFixed(2)}%
                  </p>
                </div>
                <div
                  className={`rounded-xl border px-3.5 py-3 ${
                    metrics.cashflow >= 0
                      ? 'border-emerald-500/15 bg-emerald-500/5'
                      : 'border-rose-500/15 bg-rose-500/5'
                  }`}
                >
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      metrics.cashflow >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    Cashflow / yr
                  </p>
                  <p
                    className={`mt-0.5 text-lg font-semibold tabular-nums ${
                      metrics.cashflow >= 0 ? 'text-foreground' : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {formatCurrency(metrics.cashflow)}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Linked counts */}
        {(property.loansCount > 0 ||
          property.incomeCount > 0 ||
          property.expenseCount > 0 ||
          property.depreciationCount > 0) && (
          <div className="mt-5 flex flex-wrap gap-1.5 border-t border-foreground/[0.06] pt-4">
            {property.loansCount > 0 && (
              <LinkedPill icon={Landmark} label={`${property.loansCount} ${property.loansCount > 1 ? 'loans' : 'loan'}`} />
            )}
            {property.incomeCount > 0 && <LinkedPill icon={ArrowUpRight} label={`${property.incomeCount} income`} />}
            {property.expenseCount > 0 && (
              <LinkedPill icon={Receipt} label={`${property.expenseCount} ${property.expenseCount > 1 ? 'expenses' : 'expense'}`} />
            )}
            {property.depreciationCount > 0 && (
              <LinkedPill icon={FileText} label={`${property.depreciationCount} depreciation`} />
            )}
          </div>
        )}

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

  // On desktop (or when motion is reduced), return the tile as-is.
  // On mobile, wrap in a sticky-positioned container with scroll-driven
  // scale/opacity so each tile pins and gets visually overlaid by the
  // next as the user scrolls — the "card-deck" feel.
  if (!stackEnabled) {
    return tile;
  }

  return (
    <motion.div
      ref={stackRef}
      // sticky on mobile, normal flow on md+ (desktop's multi-column
      // grid handles layout there — no stacking).
      className="sticky top-3 md:static md:top-auto"
      style={{ scale: stackScale, opacity: stackOpacity, willChange: 'transform, opacity' }}
    >
      {tile}
    </motion.div>
  );
}

function LinkedPill({ icon: Icon, label }: { icon: typeof Landmark; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-background/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

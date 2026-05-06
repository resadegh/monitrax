'use client';

/**
 * MetricTile — shared atmospheric tile primitive.
 *
 * Phase 39 PropertyTile / InvestmentAccountTile / AssetTile vocabulary
 * extracted to a reusable surface. Org Portal practice tiles +
 * future shell pages compose this rather than re-rolling the
 * glass + atmosphere + hover-lift pattern.
 *
 * Visual rules:
 *   • rounded-[22px] outer radius
 *   • bg-card/70 + backdrop-blur-xl glass surface (match consumer tiles)
 *   • per-`tone` atmospheric mesh + accent border
 *   • optional glyph watermark (filled-silhouette, 0.06→0.12 hover)
 *   • whileHover y: -3 spring lift
 *   • staggered entry by `index`
 *   • prefers-reduced-motion respected
 */

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { tileEnter, useReducedMotionSafe } from './motion';

export type MetricTileTone = 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';

interface ToneSpec {
  border: string;
  hoverBorder: string;
  mesh: string;
  iconBg: string;
  iconText: string;
  watermarkText: string;
}

const TONES: Record<MetricTileTone, ToneSpec> = {
  sky: {
    border: 'border-sky-300/35 dark:border-sky-400/15',
    hoverBorder: 'hover:border-sky-400/60',
    mesh:
      'radial-gradient(440px 240px at 100% 0%, rgba(14,165,233,0.16), transparent 60%), radial-gradient(420px 220px at 0% 100%, rgba(79,70,229,0.10), transparent 60%)',
    iconBg: 'bg-gradient-to-br from-sky-500 to-indigo-600',
    iconText: 'text-white',
    watermarkText: 'text-sky-500',
  },
  emerald: {
    border: 'border-emerald-300/35 dark:border-emerald-400/15',
    hoverBorder: 'hover:border-emerald-400/60',
    mesh:
      'radial-gradient(440px 240px at 100% 0%, rgba(16,185,129,0.16), transparent 60%), radial-gradient(420px 220px at 0% 100%, rgba(5,150,105,0.10), transparent 60%)',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    iconText: 'text-white',
    watermarkText: 'text-emerald-500',
  },
  amber: {
    border: 'border-amber-300/35 dark:border-amber-400/15',
    hoverBorder: 'hover:border-amber-400/60',
    mesh:
      'radial-gradient(440px 240px at 100% 0%, rgba(245,158,11,0.16), transparent 60%), radial-gradient(420px 220px at 0% 100%, rgba(217,119,6,0.10), transparent 60%)',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    iconText: 'text-white',
    watermarkText: 'text-amber-500',
  },
  rose: {
    border: 'border-rose-300/35 dark:border-rose-400/15',
    hoverBorder: 'hover:border-rose-400/60',
    mesh:
      'radial-gradient(440px 240px at 100% 0%, rgba(244,63,94,0.16), transparent 60%), radial-gradient(420px 220px at 0% 100%, rgba(190,18,60,0.10), transparent 60%)',
    iconBg: 'bg-gradient-to-br from-rose-500 to-pink-600',
    iconText: 'text-white',
    watermarkText: 'text-rose-500',
  },
  violet: {
    border: 'border-violet-300/35 dark:border-violet-400/15',
    hoverBorder: 'hover:border-violet-400/60',
    mesh:
      'radial-gradient(440px 240px at 100% 0%, rgba(139,92,246,0.16), transparent 60%), radial-gradient(420px 220px at 0% 100%, rgba(124,58,237,0.10), transparent 60%)',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600',
    iconText: 'text-white',
    watermarkText: 'text-violet-500',
  },
  slate: {
    border: 'border-slate-300/40 dark:border-slate-400/15',
    hoverBorder: 'hover:border-slate-400/60',
    mesh:
      'radial-gradient(440px 240px at 100% 0%, rgba(100,116,139,0.14), transparent 60%), radial-gradient(420px 220px at 0% 100%, rgba(15,23,42,0.10), transparent 60%)',
    iconBg: 'bg-gradient-to-br from-slate-600 to-slate-800',
    iconText: 'text-white',
    watermarkText: 'text-slate-500',
  },
};

export interface MetricTileProps {
  /**
   * Atmospheric tone family. Pick by emotional fit, not by hue:
   * sky = active/engaged data, emerald = positive/healthy,
   * amber = needs-attention but not urgent, rose = urgent/alerting,
   * violet = analytics/synthesis, slate = neutral.
   */
  tone?: MetricTileTone;
  /** lucide-react icon (or any 18-20px ReactNode). Renders in 44×44 corner box. */
  icon?: ReactNode;
  /** Filled-silhouette glyph from `practiceGlyphs.tsx`. Renders as 0.06 watermark. */
  watermark?: ReactNode;
  /** Stagger index for entrance animation. Pass the array index. */
  index?: number;
  /** Optional click target. When provided the entire tile becomes interactive. */
  onClick?: () => void;
  /** When `onClick` is set, this aria-label describes the action. */
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}

export function MetricTile({
  tone = 'sky',
  icon,
  watermark,
  index = 0,
  onClick,
  ariaLabel,
  className = '',
  children,
}: MetricTileProps) {
  const reduced = useReducedMotionSafe();
  const spec = TONES[tone];

  const Component = onClick ? motion.button : motion.div;

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : tileEnter(index)}
      whileHover={reduced || !onClick ? undefined : { y: -3 }}
      className={[
        'group relative isolate overflow-hidden rounded-[22px] border',
        spec.border,
        spec.hoverBorder,
        'bg-card/70 backdrop-blur-xl',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)]',
        'hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_48px_rgba(15,23,42,0.10)]',
        'transition-[background-color,border-color,box-shadow] duration-500',
        'p-5 sm:p-6 text-left',
        onClick ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1' : '',
        className,
      ].join(' ')}
    >
      {/* Atmospheric mesh */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: spec.mesh }}
      />

      {/* Glyph watermark — fills the right portion of the tile, dim
          by default, lifts slightly on hover. */}
      {watermark && (
        <div
          aria-hidden
          className={[
            'pointer-events-none absolute inset-y-0 right-[-12%] -z-10 flex items-center',
            spec.watermarkText,
            'opacity-[0.06] transition-opacity duration-500 group-hover:opacity-[0.12]',
          ].join(' ')}
          style={{ width: '70%' }}
        >
          {watermark}
        </div>
      )}

      {/* Optional icon corner box */}
      {icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl shadow-md shadow-black/5">
          <div
            className={`flex h-full w-full items-center justify-center rounded-xl ${spec.iconBg} ${spec.iconText}`}
          >
            {icon}
          </div>
        </div>
      )}

      <div className="relative">{children}</div>
    </Component>
  );
}

/**
 * MetricTileHeadline — large tabular-nums value paired with a label.
 * The standard tile body when the tile is showing a single metric.
 */
export function MetricTileHeadline({
  label,
  value,
  sub,
  subTone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: 'positive' | 'attention' | 'neutral';
}) {
  const subClass =
    subTone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : subTone === 'attention'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-muted-foreground';

  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {sub && (
        <p className={`mt-1 text-xs tabular-nums ${subClass}`}>{sub}</p>
      )}
    </>
  );
}

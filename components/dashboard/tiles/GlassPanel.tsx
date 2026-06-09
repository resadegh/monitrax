'use client';

/**
 * GlassPanel — canonical §18.7.2 polished tile chrome.
 *
 * Foundation primitive for the Phase 45.4-6 dashboard glass migration
 * + the §18.7.6 Compact Dashboard pattern. Composes the entire §18.7.2
 * recipe so consumer components don't repeat it:
 *   - rounded-[radius] (default 22px tile / 28px hero)
 *   - 1px hairline border at foreground/10
 *   - bg-card/70 backdrop-blur-xl
 *   - three-tier float shadow + 1px white rim (light) / black float + 1px
 *     inner-top white rim 4% (dark — §18.7.2 dark-mode rules)
 *   - 3px sub-palette gradient top-accent strip
 *   - 1px inner-top white highlight (curved-glass cue, opacity-60 light /
 *     opacity-10 dark)
 *   - faint sub-palette tinted bg (`from-{sub}-50/40 to-card/70` light /
 *     `from-{sub}-500/[0.08] to-card/70` dark)
 *
 * Every dashboard tile component (GlassKpiCard, GlassPairedMetricCard,
 * the widget glass wrappers) renders content INSIDE this panel — keeps
 * the glass DNA consistent across the surface.
 *
 * Stitch source: project 1859462351962811110, multiple screens — first
 * canonical use in `dashboard-mobile-compact-v1` (screen
 * `55cff20dae64476fa18879fa0400592f`) + `dashboard-kpi-row-v1` (screen
 * `65f0ddfb12e34e79bed33b4af1d42140`).
 */

import type { ReactNode } from 'react';

export type GlassSubPalette = 'emerald' | 'sky' | 'indigo' | 'violet' | 'amber' | 'slate' | 'sky-indigo' | 'indigo-violet';

const TINT_BG: Record<GlassSubPalette, string> = {
  emerald: 'bg-gradient-to-br from-emerald-50/40 to-card/70 dark:from-emerald-500/[0.08] dark:to-card/70',
  sky: 'bg-gradient-to-br from-sky-50/40 to-card/70 dark:from-sky-500/[0.08] dark:to-card/70',
  indigo: 'bg-gradient-to-br from-indigo-50/40 to-card/70 dark:from-indigo-500/[0.08] dark:to-card/70',
  violet: 'bg-gradient-to-br from-violet-50/40 to-card/70 dark:from-violet-500/[0.08] dark:to-card/70',
  amber: 'bg-gradient-to-br from-amber-50/40 to-card/70 dark:from-amber-500/[0.08] dark:to-card/70',
  slate: 'bg-gradient-to-br from-slate-50/40 to-card/70 dark:from-slate-500/[0.08] dark:to-card/70',
  'sky-indigo': 'bg-gradient-to-br from-sky-50/30 to-card/70 dark:from-sky-500/[0.06] dark:to-card/70',
  'indigo-violet': 'bg-gradient-to-br from-indigo-50/30 to-card/70 dark:from-indigo-500/[0.06] dark:to-card/70',
};

const ACCENT_GRADIENT: Record<GlassSubPalette, string> = {
  emerald: 'from-emerald-500 to-emerald-600',
  sky: 'from-sky-500 to-sky-600',
  indigo: 'from-indigo-500 to-indigo-600',
  violet: 'from-violet-500 to-violet-600',
  amber: 'from-amber-500 to-amber-600',
  slate: 'from-slate-500 to-slate-600',
  'sky-indigo': 'from-sky-500 to-indigo-500',
  'indigo-violet': 'from-indigo-500 to-violet-500',
};

export interface GlassPanelProps {
  children: ReactNode;
  subPalette: GlassSubPalette;
  /** Tile (22px), card (20px), or hero (28px). Default 22px. */
  radius?: 'tile' | 'card' | 'hero';
  /** Internal padding. Default `p-5` (20px). Use `p-6` (24px) for KPI tiles, `p-7` (28px) for heroes. */
  padding?: string;
  /** Show the 3px gradient top-accent strip. Default true. */
  accent?: boolean;
  /** Show hover lift. Default false (only enable on tiles that link somewhere). */
  hoverLift?: boolean;
  /** Extra className for the outer container (composition / spans / grid hints). */
  className?: string;
  /** ARIA / semantic role override. */
  as?: 'div' | 'section' | 'article';
}

const RADIUS_CLASS = {
  tile: 'rounded-[22px]',
  card: 'rounded-[20px]',
  hero: 'rounded-[28px]',
} as const;

export function GlassPanel({
  children,
  subPalette,
  radius = 'tile',
  padding = 'p-5',
  accent = true,
  hoverLift = false,
  className = '',
  as: Tag = 'div',
}: GlassPanelProps) {
  return (
    <Tag
      className={`
        relative overflow-hidden border border-foreground/10 backdrop-blur-xl
        ${RADIUS_CLASS[radius]}
        ${TINT_BG[subPalette]}
        shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_36px_rgba(15,23,42,0.08)]
        dark:border-foreground/20
        dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]
        ${hoverLift ? 'transition-transform duration-300 hover:-translate-y-0.5' : ''}
        ${className}
      `}
    >
      {accent && (
        <div
          aria-hidden
          className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${ACCENT_GRADIENT[subPalette]}`}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10"
      />
      <div className={`relative ${padding}`}>{children}</div>
    </Tag>
  );
}

/**
 * Luminous solid-gradient icon-badge "gem" — paired with GlassPanel.
 * Reusable across KPI tiles, widget headers, and the Compact Dashboard
 * Bento Pair rows. Sub-palette match the parent panel's accent.
 */
export interface GlassIconBadgeProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  subPalette: GlassSubPalette;
  /** Default 'md' (40px). Use 'sm' (32px) inside Bento Pair tiles + Compact strip. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const BADGE_SIZE = {
  sm: { box: 'h-8 w-8 rounded-[10px]', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10 rounded-[12px]', icon: 'h-5 w-5' },
  lg: { box: 'h-11 w-11 rounded-[14px]', icon: 'h-5 w-5' },
} as const;

const BADGE_GRADIENT: Record<GlassSubPalette, string> = {
  emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30',
  sky: 'bg-gradient-to-br from-sky-500 to-sky-600 shadow-sky-500/30',
  indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-indigo-500/30',
  violet: 'bg-gradient-to-br from-violet-500 to-violet-600 shadow-violet-500/30',
  amber: 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30',
  slate: 'bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/30',
  'sky-indigo': 'bg-gradient-to-br from-sky-500 to-indigo-600 shadow-sky-500/30',
  'indigo-violet': 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/30',
};

export function GlassIconBadge({ icon: Icon, subPalette, size = 'md', className = '' }: GlassIconBadgeProps) {
  const sz = BADGE_SIZE[size];
  return (
    <div
      className={`flex shrink-0 items-center justify-center text-white shadow-md ${sz.box} ${BADGE_GRADIENT[subPalette]} ${className}`}
    >
      <Icon className={sz.icon} strokeWidth={1.5} />
    </div>
  );
}

/**
 * Sub-palette gradient eyebrow — small uppercase label paired with the
 * GlassIconBadge in tile headers. The text-fill is the sub-palette
 * gradient (luminous on dark naturally per §18.7.2).
 */
const EYEBROW_GRADIENT_TEXT: Record<GlassSubPalette, string> = {
  emerald: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
  sky: 'bg-gradient-to-r from-sky-500 to-sky-600',
  indigo: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
  violet: 'bg-gradient-to-r from-violet-500 to-violet-600',
  amber: 'bg-gradient-to-r from-amber-500 to-amber-600',
  slate: 'bg-gradient-to-r from-slate-500 to-slate-600',
  'sky-indigo': 'bg-gradient-to-r from-sky-500 to-indigo-500',
  'indigo-violet': 'bg-gradient-to-r from-indigo-500 to-violet-500',
};

export function GlassEyebrow({ children, subPalette }: { children: ReactNode; subPalette: GlassSubPalette }) {
  return (
    <span
      className={`${EYEBROW_GRADIENT_TEXT[subPalette]} bg-clip-text text-[10px] font-bold uppercase tracking-[0.16em] text-transparent`}
    >
      {children}
    </span>
  );
}

'use client';

/**
 * GlassHero — shared hero surface for any Monitrax shell page.
 *
 * Phase 39 canonical contract (PropertiesHero.tsx, InvestmentsHero.tsx,
 * AssetsHero.tsx, AdviceHero.tsx) extracted into a reusable primitive
 * so Org Portal + future surfaces stay visually aligned with the
 * consumer My Wealth redesign without copy-pasting class names.
 *
 * Visual rules:
 *   • rounded-[28px] outer radius
 *   • bg-card/70 + backdrop-blur-xl glass surface
 *   • atmospheric mesh background (configurable per stage/theme)
 *   • optional slow-breathing soft glow pill
 *   • soft layered shadow — never a heavy drop-shadow
 *   • appleEase entry, prefers-reduced-motion respected
 *
 * Slots:
 *   • eyebrow — small uppercase label row (provided by caller; usually
 *     stage badge + label like "Your portfolio")
 *   • children — headline + KPI grid composed by caller
 *
 * Themes are atmospheric-only — the eyebrow and headline gradients are
 * the caller's responsibility (so Org Portal can use sky/indigo for
 * "Practice", advisers can use rose for "Attention", etc.).
 */

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { appleEase, breathingGlow, useReducedMotionSafe } from './motion';

export type GlassHeroAtmosphere = 'sky' | 'emerald' | 'amber' | 'rose' | 'slate';

interface AtmosphereSpec {
  border: string;
  mesh: string;
  glow: string;
}

const ATMOSPHERES: Record<GlassHeroAtmosphere, AtmosphereSpec> = {
  sky: {
    border: 'border-sky-300/30 dark:border-sky-400/15',
    mesh:
      'radial-gradient(900px 420px at 12% -10%, rgba(14,165,233,0.18), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(79,70,229,0.10), transparent 60%), radial-gradient(700px 320px at 50% 50%, rgba(15,23,42,0.06), transparent 65%)',
    glow: 'rgba(14,165,233,0.40)',
  },
  emerald: {
    border: 'border-emerald-300/30 dark:border-emerald-400/15',
    mesh:
      'radial-gradient(900px 420px at 12% -10%, rgba(16,185,129,0.18), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(5,150,105,0.10), transparent 60%), radial-gradient(700px 320px at 50% 50%, rgba(15,23,42,0.06), transparent 65%)',
    glow: 'rgba(16,185,129,0.40)',
  },
  amber: {
    border: 'border-amber-300/30 dark:border-amber-400/15',
    mesh:
      'radial-gradient(900px 420px at 12% -10%, rgba(245,158,11,0.18), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(217,119,6,0.10), transparent 60%), radial-gradient(700px 320px at 50% 50%, rgba(15,23,42,0.06), transparent 65%)',
    glow: 'rgba(245,158,11,0.40)',
  },
  rose: {
    border: 'border-rose-300/30 dark:border-rose-400/15',
    mesh:
      'radial-gradient(900px 420px at 12% -10%, rgba(244,63,94,0.16), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(190,18,60,0.10), transparent 60%), radial-gradient(700px 320px at 50% 50%, rgba(15,23,42,0.06), transparent 65%)',
    glow: 'rgba(244,63,94,0.35)',
  },
  slate: {
    border: 'border-slate-300/40 dark:border-slate-400/15',
    mesh:
      'radial-gradient(900px 420px at 12% -10%, rgba(100,116,139,0.14), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(15,23,42,0.10), transparent 60%)',
    glow: 'rgba(100,116,139,0.30)',
  },
};

export interface GlassHeroProps {
  atmosphere?: GlassHeroAtmosphere;
  children: ReactNode;
  className?: string;
}

export function GlassHero({
  atmosphere = 'sky',
  children,
  className = '',
}: GlassHeroProps) {
  const reduced = useReducedMotionSafe();
  const spec = ATMOSPHERES[atmosphere];

  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.6, ease: appleEase }}
      className={[
        'relative isolate overflow-hidden rounded-[28px] border',
        spec.border,
        'bg-card/70 backdrop-blur-xl',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)]',
        className,
      ].join(' ')}
    >
      {/* Atmospheric mesh */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: spec.mesh }}
      />

      {/* Slow breathing soft glow */}
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[280px] w-[480px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: spec.glow }}
          animate={breathingGlow.animate}
          transition={breathingGlow.transition}
        />
      )}

      <div className="relative px-6 pt-6 pb-7 sm:px-8 sm:pt-8 sm:pb-9">
        {children}
      </div>
    </motion.div>
  );
}

/**
 * GlassHeroEyebrow — small uppercase label row with optional badge.
 * Composes inside <GlassHero>. Caller controls badge content.
 */
export function GlassHeroEyebrow({
  label,
  badge,
}: {
  label: string;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <span
        className="inline-flex h-1.5 w-1.5 rounded-full bg-foreground/60"
        aria-hidden
      />
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </h3>
      {badge && <div className="ml-auto">{badge}</div>}
    </div>
  );
}

/**
 * GlassHeroHeadline — gradient-text monetary or count headline.
 * Caller passes the actual value (already-formatted string).
 */
export function GlassHeroHeadline({
  label,
  value,
  ariaLabel,
  gradientClassName = 'bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700',
}: {
  label: string;
  value: string;
  ariaLabel?: string;
  gradientClassName?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 text-4xl font-semibold tracking-[-0.02em] tabular-nums text-foreground sm:text-5xl"
        aria-label={ariaLabel ?? `${label} ${value}`}
      >
        <span
          className={`${gradientClassName} bg-clip-text text-transparent`}
        >
          {value}
        </span>
      </p>
    </div>
  );
}

/**
 * GlassHeroKpiCell — secondary KPI cell next to the headline. Use
 * inside a `grid grid-cols-{n} gap-3` wrapper. Tone tints the value
 * colour without disturbing the layout.
 */
export function GlassHeroKpiCell({
  label,
  value,
  tone = 'neutral',
  sub,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'attention' | 'neutral';
  sub?: string;
}) {
  const valueClass =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : tone === 'attention'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-foreground';

  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${valueClass}`}>
        {value}
      </dd>
      {sub && (
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {sub}
        </p>
      )}
    </div>
  );
}

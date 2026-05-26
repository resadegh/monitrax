'use client';

/**
 * Public-site marketing hero — dark Deep Cosmos.
 *
 * Phase 48 PR 3 (2026-05-26). Replaces the v1 ivory-era `TrailHero`.
 * Built from the locked Stitch canonical screen (`.stitch/SITE.md` §7 v4):
 * project `1859462351962811110`, screen `42730aaf...` "Monitrax Hero —
 * Symbolic 3D Icons". Six floating 3D icons baked locally to
 * `public/marketing/hero/*.png` so we don't depend on Stitch's Google
 * CDN URLs (which can rotate). Each icon represents one wealth structure:
 *   property · super · trust · company · investments · cashflow
 * aligned with the in-app `components/wealth/wealthGlyphs.tsx` vocabulary.
 *
 * Motion composition (per CLAUDE.md §0 architect lens):
 *   - `useReducedMotionSafe()` from `components/shell/motion.ts` — the
 *     canonical hook, never re-define locally.
 *   - `heroEnter` transition for the centred copy block.
 *   - `tileEnter(index)` for staggered floating-icon entrance.
 *   - Pure-CSS `cosmos-glow-center` for the radial emerald breath glow
 *     behind the headline (utility class from PR 1).
 *   - Floating idle motion: a `cosmos-float` keyframe gated by
 *     `prefers-reduced-motion`.
 *
 * Accessibility:
 *   - `alt=""` on decorative icons (announced via the visible text alone).
 *   - `aria-label` on the section.
 *   - All motion respects `prefers-reduced-motion`.
 *   - 44px tap target on CTA.
 *
 * LCP optimisation:
 *   - All 6 icon images use `<Image>` with `priority` so they fetch as
 *     soon as the hero mounts — they're above the fold.
 *   - Icons hidden on mobile (`hidden lg:block`) — the centred copy reads
 *     cleaner without competing visuals at narrow widths.
 */

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { heroEnter, tileEnter, useReducedMotionSafe } from '@/components/shell/motion';

type FloatingIcon = {
  src: string;
  label: string;
  className: string;
  style: React.CSSProperties;
};

const FLOATING_ICONS: readonly FloatingIcon[] = [
  {
    src: '/marketing/hero/property.png',
    label: 'Property',
    className: 'w-[200px] xl:w-[240px]',
    style: { top: '15%', left: '8%', transform: 'rotate(-15deg)' },
  },
  {
    src: '/marketing/hero/super.png',
    label: 'Super / SMSF',
    className: 'w-[170px] xl:w-[200px]',
    style: { top: '18%', right: '8%', transform: 'rotate(12deg)' },
  },
  {
    src: '/marketing/hero/trust.png',
    label: 'Trust',
    className: 'w-[150px] xl:w-[180px]',
    style: { bottom: '26%', left: '6%', transform: 'rotate(-10deg)' },
  },
  {
    src: '/marketing/hero/company.png',
    label: 'Company',
    className: 'w-[140px] xl:w-[160px]',
    style: { bottom: '14%', right: '12%', transform: 'rotate(-20deg)' },
  },
  {
    src: '/marketing/hero/investments.png',
    label: 'Investments',
    className: 'w-[180px] xl:w-[220px]',
    style: { top: '60%', left: '15%', transform: 'rotate(5deg)' },
  },
  {
    src: '/marketing/hero/cashflow.png',
    label: 'Cashflow',
    className: 'w-[230px] xl:w-[280px]',
    style: { top: '50%', right: '4%', transform: 'rotate(18deg)' },
  },
] as const;

export function Hero() {
  const reduced = useReducedMotionSafe();

  return (
    <section
      aria-label="Monitrax — Australian Wealth Operating System"
      className="cosmos-glow-center relative isolate flex min-h-[88vh] w-full items-center justify-center overflow-hidden bg-cosmos pt-20 md:pt-24 lg:min-h-screen"
    >
      {/* Floating 3D icons — decorative, desktop only */}
      {FLOATING_ICONS.map((icon, i) => (
        <motion.div
          key={icon.src}
          aria-hidden="true"
          className={`pointer-events-none absolute z-10 hidden drop-shadow-[0_20px_50px_rgba(0,0,0,0.6)] lg:block ${icon.className}`}
          style={icon.style}
          initial={reduced ? false : { opacity: 0, scale: 0.85 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={tileEnter(i + 1)}
        >
          <div className={reduced ? '' : 'cosmos-float'}>
            <Image
              src={icon.src}
              alt=""
              width={400}
              height={400}
              priority
              className="h-auto w-full select-none"
              draggable={false}
            />
          </div>
        </motion.div>
      ))}

      {/* Centred copy block */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={heroEnter}
        className="relative z-20 mx-auto flex max-w-4xl flex-col items-center px-6 text-center"
      >
        {/* Eyebrow chip */}
        <div className="cosmos-glass mb-8 rounded-full px-4 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-cosmos-soft">
            Australian Wealth Operating System
          </span>
        </div>

        {/* Headline */}
        <h1 className="mb-8 text-balance text-5xl font-bold leading-[1.05] tracking-tight text-cosmos sm:text-6xl lg:text-7xl xl:text-[96px]">
          Your wealth,
          <br />
          <span className="bg-gradient-to-r from-cosmos-action-soft to-cosmos-action bg-clip-text text-transparent">
            fully integrated.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mb-12 max-w-xl text-base leading-relaxed text-cosmos-soft sm:text-lg">
          Property, super, investments, trusts, cashflow and tax — read by one engine,
          in one calm view. So the next move is obvious before you make it.
        </p>

        {/* CTA + reassurance */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/register"
            className="cosmos-cta inline-flex min-h-[44px] items-center justify-center rounded-full px-10 py-4 text-lg font-bold"
          >
            Start free
          </Link>
          <span className="text-sm text-cosmos-muted">
            Built for Australian wealth-builders. No credit card.
          </span>
        </div>
      </motion.div>

      {/* Scroll affordance */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 text-cosmos-faint"
      >
        <svg
          className={`h-6 w-6 ${reduced ? '' : 'animate-bounce'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}

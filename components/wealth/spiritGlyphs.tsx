'use client';

/**
 * Spirit Glyphs — line-art SVGs that sit as low-opacity watermarks
 * behind My Wealth tile content, signalling each tile's type without
 * breaking the consistent grid of tile shapes.
 *
 * Design rules (do NOT relax — the elegance comes from restraint):
 *   1. Single stroke, 1.5px, `currentColor`. No fills.
 *   2. Round line-caps and line-joins, every glyph.
 *   3. viewBox 0 0 120 120 — every glyph composed within the same box.
 *   4. No decorative details (no smoke from chimneys, no door handles,
 *      no bows on keys, no spokes on wheels). Geometric, not whimsical.
 *   5. Composition leans slightly into the right half of the viewBox
 *      because the watermark bleeds off the right edge of the tile.
 *   6. Default opacity (set by the consumer): ~0.06 default → ~0.12 hover.
 *
 * Stage I — Invest palette is the standard `currentColor` source:
 * the consumer wraps the glyph in a `text-sky-500` (or similar) span.
 *
 * This file is intentionally a flat library of small components rather
 * than a dynamic switch — keeps tree-shaking trivial and lets
 * each glyph be authored individually without case-statement bloat.
 */

import { motion, useReducedMotion } from 'framer-motion';

const appleEase: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

interface GlyphProps {
  /** Optional className passed to the outermost <svg>; positioning lives here. */
  className?: string;
  /** Used to delay glyph entry slightly per tile so the page doesn't paint with all glyphs at once. */
  delay?: number;
}

const SHARED_SVG_PROPS = {
  viewBox: '0 0 120 120',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
} as const;

function useEntry(delay: number) {
  const reduced = useReducedMotion() ?? false;
  return reduced
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.9, ease: appleEase, delay: 0.15 + delay },
      };
}

/**
 * HOME — minimalist gable. Peaked roof line, single chimney, a
 * baseline that hints at "ground" without drawing walls or windows.
 */
export function HomeGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Roof peak */}
      <path d="M 18 78 L 60 36 L 102 78" />
      {/* Chimney (right slope) */}
      <path d="M 86 54 L 86 28 L 96 28 L 96 60" />
      {/* Baseline — extends slightly past the roof for grounding */}
      <path d="M 8 78 L 112 78" />
    </motion.svg>
  );
}

/**
 * INVESTMENT — a doorway with an upward arrow rising through it.
 * Reads as "growth out of a property" without being literal.
 */
export function InvestmentGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Floor line */}
      <path d="M 14 98 L 106 98" />
      {/* Doorway — open archway */}
      <path d="M 32 98 L 32 52 Q 32 38 46 38 L 74 38 Q 88 38 88 52 L 88 98" />
      {/* Up-arrow rising through the doorway */}
      <path d="M 60 92 L 60 18" />
      <path d="M 46 32 L 60 18 L 74 32" />
    </motion.svg>
  );
}

/**
 * RENTAL — a single key. Round bow on the left, shaft to the right,
 * two teeth on the bottom edge. No decorative ring, no curlicues.
 */
export function RentalGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Bow */}
      <circle cx="32" cy="60" r="14" />
      {/* Inner ring (small detail — matches a real key's keyring hole) */}
      <circle cx="32" cy="60" r="4" />
      {/* Shaft */}
      <path d="M 46 60 L 108 60" />
      {/* Teeth */}
      <path d="M 80 60 L 80 72" />
      <path d="M 96 60 L 96 72" />
    </motion.svg>
  );
}

/** Resolver — one place to map property type → glyph. Keeps consumer code clean. */
export function PropertyGlyph({
  type,
  className,
  delay,
}: {
  type: 'HOME' | 'INVESTMENT' | 'RENTAL';
  className?: string;
  delay?: number;
}) {
  switch (type) {
    case 'HOME':
      return <HomeGlyph className={className} delay={delay} />;
    case 'INVESTMENT':
      return <InvestmentGlyph className={className} delay={delay} />;
    case 'RENTAL':
      return <RentalGlyph className={className} delay={delay} />;
  }
}

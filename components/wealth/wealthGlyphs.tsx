'use client';

/**
 * Wealth Glyphs (v4) — large filled silhouettes used as ambient
 * watermarks behind My Wealth tile content.
 *
 * v4 changes vs v3:
 *   - Silhouettes now fill 80–95% of the 120×120 viewBox so they
 *     look "almost the size of the main tile" when the consumer
 *     stretches them to the tile's full inner area (Reza's request).
 *   - Compositions are deliberately top-heavy or full-height so the
 *     visible watermark covers the upper portion of the tile too,
 *     not just the bottom-right.
 *
 * Design rules (unchanged from v3 — the elegance comes from restraint):
 *   1. Filled paths only. fill="currentColor". No strokes.
 *   2. Single closed silhouette per glyph. Solid, no negative-space
 *      tricks (the bow on the key is a solid disc).
 *   3. viewBox 0 0 120 120 — every glyph composed within the same box.
 *   4. No decorative micro-details. Compact, iconic.
 *   5. Default opacity (set by consumer): ~0.05 default → ~0.10 hover.
 *
 * Reusable across Properties, Investments, Assets — file scoped under
 * components/wealth/ so future tiles can pull from the same library.
 */

import { motion, useReducedMotion } from 'framer-motion';

const appleEase: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

interface GlyphProps {
  /** Optional className for positioning + sizing on the consumer side. */
  className?: string;
  /** Stagger delay so multiple tiles don't fade in identically. */
  delay?: number;
}

const SHARED_SVG_PROPS = {
  viewBox: '0 0 120 120',
  fill: 'currentColor',
  // xMaxYMid means: align the SVG to the right edge of its container,
  // vertically centred. Combined with a container that bleeds slightly
  // off the tile's right edge, this gives the watermark an editorial
  // "leaning out of frame" feel rather than dead-centre.
  preserveAspectRatio: 'xMaxYMid meet',
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
 * HOME — large peaked-roof house with chimney. Fills nearly the
 * entire 120×120 viewBox (y: 8 → 114, x: 6 → 114) so when the
 * container is stretched to most of the tile, the silhouette reads
 * as a giant ambient house behind the content.
 */
export function HomeFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* House silhouette — full viewBox */}
      <path d="M 6 114 L 6 60 L 60 8 L 114 60 L 114 114 Z" />
      {/* Chimney */}
      <rect x="92" y="22" width="12" height="26" rx="1" />
    </motion.svg>
  );
}

/**
 * INVESTMENT — full-viewBox house silhouette with an up-arrow rising
 * out of its right shoulder. House occupies the lower-left, arrow
 * fills the right column — together they fill the whole frame.
 */
export function InvestmentFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* House */}
      <path d="M 4 114 L 4 70 L 44 32 L 84 70 L 84 114 Z" />
      <rect x="68" y="48" width="8" height="22" rx="1" />
      {/* Up-arrow rising on the right — chevron + tail */}
      <polygon points="100,8 84,30 92,30 92,98 110,98 110,30 118,30" />
    </motion.svg>
  );
}

/**
 * RENTAL — large key. Bow on the upper-left, shaft running across
 * the middle, two prominent teeth on the bottom-right. Sized to
 * fill ~80% of viewBox horizontally and ~75% vertically.
 */
export function RentalFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Bow */}
      <circle cx="34" cy="60" r="28" />
      {/* Shaft */}
      <rect x="58" y="50" width="58" height="20" rx="4" />
      {/* Teeth */}
      <rect x="80" y="50" width="8" height="32" rx="1" />
      <rect x="100" y="50" width="8" height="32" rx="1" />
    </motion.svg>
  );
}

/** Resolver — keeps consumer code clean. */
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
      return <HomeFilledGlyph className={className} delay={delay} />;
    case 'INVESTMENT':
      return <InvestmentFilledGlyph className={className} delay={delay} />;
    case 'RENTAL':
      return <RentalFilledGlyph className={className} delay={delay} />;
  }
}

'use client';

/**
 * Wealth Glyphs — FILLED silhouettes used as low-opacity watermarks
 * behind My Wealth tile content. These are the v3 follow-up to the
 * rejected v1 line-art glyphs.
 *
 * Why FILLED, not stroked:
 *   v1 used 1.5px stroke-only line art at ~7% opacity. Reza reported
 *   it "looks more like a render issue than a design." Reason: at
 *   low opacity, partial strokes read as incomplete render artifacts.
 *   Filled shapes at the same opacity read as ambient illustration —
 *   the eye accepts them as intentional decoration. This is the same
 *   pattern Apple and Stripe use for product-page background art.
 *
 * Design rules (do NOT relax):
 *   1. Filled paths only. No `stroke=""`. fill="currentColor".
 *   2. viewBox 0 0 120 120 — every glyph composed within the same box.
 *   3. Single closed silhouette per glyph (no open paths, no fancy
 *      negative-space tricks). Recognisable at a glance even at 4%.
 *   4. No decorative micro-details (no doors, no windows, no spokes,
 *      no smoke). Compact, iconic.
 *   5. Composition leans slightly into the right half because the
 *      watermark bleeds off the right edge of the tile.
 *   6. Default opacity (set by the consumer): ~0.04 default → ~0.10
 *      hover. Tones gentle.
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
 * HOME — classic peaked-roof house silhouette with a single chimney.
 * Solid filled. Reads instantly at any opacity.
 */
export function HomeFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* House body + roof as a single filled silhouette */}
      <path d="M 22 100 L 22 64 L 60 38 L 98 64 L 98 100 Z" />
      {/* Chimney */}
      <rect x="80" y="48" width="10" height="20" rx="1" />
    </motion.svg>
  );
}

/**
 * INVESTMENT — house silhouette with an up-arrow badge to the right.
 * Conveys "property + growth" without becoming literal.
 */
export function InvestmentFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Smaller house, sits on the left */}
      <path d="M 14 100 L 14 66 L 46 42 L 78 66 L 78 100 Z" />
      <rect x="60" y="50" width="8" height="16" rx="1" />
      {/* Up-arrow badge — filled chevron with stem, on the right */}
      <polygon points="98,32 84,48 92,48 92,72 104,72 104,48 112,48" />
    </motion.svg>
  );
}

/**
 * RENTAL — key silhouette. Filled bow + shaft + two teeth.
 * Solid disc bow (no negative-space ring) so it works cleanly at
 * 4% opacity without rendering tricks.
 */
export function RentalFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Bow */}
      <circle cx="32" cy="60" r="18" />
      {/* Shaft */}
      <rect x="42" y="55" width="62" height="10" rx="3" />
      {/* Teeth */}
      <rect x="76" y="55" width="6" height="18" rx="1" />
      <rect x="90" y="55" width="6" height="18" rx="1" />
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

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

// ─────────────────────────────────────────────────────────────────────
// Phase 39.2 — Investments glyphs
// Five for accounts (BROKERAGE / SUPERS / FUND / TRUST / ETF_CRYPTO)
// Four for holdings (SHARE / ETF / MANAGED_FUND / CRYPTO)
// Plus two resolvers (AccountGlyph, HoldingGlyph).
// ─────────────────────────────────────────────────────────────────────

/**
 * BROKERAGE — three-bar candlestick skeleton (rising bars).
 * Reads as "trading account" / "market activity."
 */
export function BrokerageFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Wicks */}
      <rect x="22" y="44" width="3" height="60" rx="1" />
      <rect x="55" y="28" width="3" height="76" rx="1" />
      <rect x="88" y="14" width="3" height="90" rx="1" />
      {/* Candles (rising sequence) */}
      <rect x="12" y="60" width="24" height="32" rx="2" />
      <rect x="45" y="44" width="24" height="44" rx="2" />
      <rect x="78" y="26" width="24" height="56" rx="2" />
      {/* Baseline */}
      <rect x="6" y="108" width="108" height="3" rx="1" />
    </motion.svg>
  );
}

/**
 * SUPERS (Superannuation) — classical column / pillar.
 * Reads as "long-term, foundational, retirement pillar."
 */
export function SuperFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Capital (top) */}
      <rect x="20" y="14" width="80" height="14" rx="2" />
      <rect x="14" y="28" width="92" height="6" rx="1" />
      {/* Shaft */}
      <rect x="34" y="34" width="52" height="62" rx="2" />
      {/* Base */}
      <rect x="14" y="96" width="92" height="6" rx="1" />
      <rect x="20" y="102" width="80" height="14" rx="2" />
    </motion.svg>
  );
}

/**
 * FUND (Managed Fund) — three layered waves stacked vertically.
 * Reads as "diversified, managed, flowing."
 */
export function FundFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Three filled wave bands. Path uses smooth curves to suggest
          managed flow. Each band roughly fills 30% of viewBox height. */}
      <path d="M 6 32 Q 30 14 60 32 T 114 32 L 114 50 Q 90 68 60 50 T 6 50 Z" />
      <path d="M 6 64 Q 30 46 60 64 T 114 64 L 114 80 Q 90 98 60 80 T 6 80 Z" />
      <path d="M 6 94 Q 30 76 60 94 T 114 94 L 114 110 Q 90 122 60 110 T 6 110 Z" />
    </motion.svg>
  );
}

/**
 * TRUST — shield silhouette. Reads as "protected, held in trust."
 */
export function TrustFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Shield: flat top, curving sides, pointed bottom. */}
      <path d="M 24 10 L 96 10 L 96 60 Q 96 96 60 116 Q 24 96 24 60 Z" />
    </motion.svg>
  );
}

/**
 * ETF_CRYPTO — hexagonal lattice. Reads as "decentralised, network."
 */
export function EtfCryptoFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Three overlapping hexagons forming a tight lattice. */}
      <polygon points="34,16 66,16 82,40 66,64 34,64 18,40" />
      <polygon points="58,52 90,52 106,76 90,100 58,100 42,76" />
      <polygon points="20,76 52,76 68,100 52,124 20,124 4,100" />
    </motion.svg>
  );
}

// ─────────────── Holdings ───────────────

/**
 * SHARE — single dominant candlestick on a baseline.
 * Reads as "individual stock."
 */
export function ShareFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Wick */}
      <rect x="56" y="6" width="8" height="108" rx="1" />
      {/* Candle body (large central) */}
      <rect x="32" y="32" width="56" height="60" rx="3" />
      {/* Baseline */}
      <rect x="6" y="112" width="108" height="3" rx="1" />
    </motion.svg>
  );
}

/**
 * ETF — diamond lattice (4 diamonds in a 2×2 grid).
 * Reads as "basket of holdings."
 */
export function EtfFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      <polygon points="36,8 60,32 36,56 12,32" />
      <polygon points="84,8 108,32 84,56 60,32" />
      <polygon points="36,56 60,80 36,104 12,80" />
      <polygon points="84,56 108,80 84,104 60,80" />
    </motion.svg>
  );
}

/**
 * MANAGED_FUND — braided rope (three twisting lines, filled).
 * Reads as "diversified bundle."
 */
export function ManagedFundFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Three thick parallel S-curves, each filled. */}
      <path d="M 6 12 Q 60 30 6 60 Q 60 90 6 116 L 30 116 Q 84 90 30 60 Q 84 30 30 12 Z" />
      <path d="M 42 12 Q 96 30 42 60 Q 96 90 42 116 L 66 116 Q 120 90 66 60 Q 120 30 66 12 Z" opacity="0.7" />
      <path d="M 78 12 Q 132 30 78 60 Q 132 90 78 116 L 102 116 Q 156 90 102 60 Q 156 30 102 12 Z" opacity="0.5" />
    </motion.svg>
  );
}

/**
 * CRYPTO — hexagon (the universal blockchain symbol).
 */
export function CryptoFilledGlyph({ className, delay = 0 }: GlyphProps) {
  const entry = useEntry(delay);
  return (
    <motion.svg {...SHARED_SVG_PROPS} className={className} {...entry}>
      {/* Single large hexagon */}
      <polygon points="60,8 108,34 108,86 60,112 12,86 12,34" />
    </motion.svg>
  );
}

/** Resolver — investment account types. */
export function AccountGlyph({
  type,
  className,
  delay,
}: {
  type: 'BROKERAGE' | 'SUPERS' | 'FUND' | 'TRUST' | 'ETF_CRYPTO';
  className?: string;
  delay?: number;
}) {
  switch (type) {
    case 'BROKERAGE':
      return <BrokerageFilledGlyph className={className} delay={delay} />;
    case 'SUPERS':
      return <SuperFilledGlyph className={className} delay={delay} />;
    case 'FUND':
      return <FundFilledGlyph className={className} delay={delay} />;
    case 'TRUST':
      return <TrustFilledGlyph className={className} delay={delay} />;
    case 'ETF_CRYPTO':
      return <EtfCryptoFilledGlyph className={className} delay={delay} />;
  }
}

/** Resolver — holding types. */
export function HoldingGlyph({
  type,
  className,
  delay,
}: {
  type: 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';
  className?: string;
  delay?: number;
}) {
  switch (type) {
    case 'SHARE':
      return <ShareFilledGlyph className={className} delay={delay} />;
    case 'ETF':
      return <EtfFilledGlyph className={className} delay={delay} />;
    case 'MANAGED_FUND':
      return <ManagedFundFilledGlyph className={className} delay={delay} />;
    case 'CRYPTO':
      return <CryptoFilledGlyph className={className} delay={delay} />;
  }
}

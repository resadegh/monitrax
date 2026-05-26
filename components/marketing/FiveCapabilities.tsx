'use client';

/**
 * Public-site marketing — "The Five" TRAIL capabilities.
 *
 * Phase 48 PR 4 (2026-05-26). Built from the Stitch `five-and-how` canonical
 * screen, section 1. Five cards mapping 1:1 to the TRAIL framework stages
 * (T·R·A·I·L) with the canonical stage hues from `lib/navigation/trailNav.tsx`
 * → `TRAIL_STAGE_TONES` (SSOT, NEVER drift): T sky · R amber · A indigo ·
 * I emerald · L violet. Each card carries an inline-SVG glyph (filled
 * silhouette per `wealthGlyphs.tsx` vocabulary — no material-symbols
 * dependency), a description, and a qualitative descriptor.
 *
 * Strategic discipline (CLAUDE.md §0 financial-adviser lens):
 *   - Descriptor lines are qualitative ("Multi-entity native", "Structure-
 *     aware") — never quantitative claims we can't trace. The Stitch source
 *     had "30+ entity types" (currently 20 in schema); softened to
 *     "Multi-entity native" to stay defensible.
 *
 * Composes: cosmos-* tokens + TRAIL stage hue tokens (PR 1), `Reveal` +
 * `StaggerContainer` / `StaggerItem` (animations.tsx).
 */

import { Reveal, StaggerContainer, StaggerItem } from './animations';

type Capability = {
  stage: 'T' | 'R' | 'A' | 'I' | 'L';
  title: string;
  description: string;
  descriptor: string;
  glyph: React.ComponentType<{ className?: string }>;
  /** Tailwind classes pinned to the canonical TRAIL stage hue. */
  hueText: string;
  hueRingBg: string;
  hueGlow: string;
};

const CAPABILITIES: readonly Capability[] = [
  {
    stage: 'T',
    title: 'Track your full picture.',
    description:
      'Property, loans, super, investments, cashflow, entities — one engine reads them all together.',
    descriptor: 'Multi-entity native',
    glyph: TrackGlyph,
    hueText: 'text-cosmos-track',
    hueRingBg: 'bg-cosmos-track/10',
    hueGlow: 'shadow-[0_-1px_30px_-15px_hsl(var(--cosmos-track)/0.6)]',
  },
  {
    stage: 'R',
    title: 'Reduce the leaks.',
    description:
      'Duplicate insurance. Lazy cash next to non-deductible debt. Subscriptions you forgot.',
    descriptor: 'Cross-account aware',
    glyph: ReduceGlyph,
    hueText: 'text-cosmos-reduce',
    hueRingBg: 'bg-cosmos-reduce/10',
    hueGlow: 'shadow-[0_-1px_30px_-15px_hsl(var(--cosmos-reduce)/0.6)]',
  },
  {
    stage: 'A',
    title: 'Anchor your safety net.',
    description:
      'Cash, offset, redraw, equity — measured against your actual household risk.',
    descriptor: 'Structure-aware',
    glyph: AnchorGlyph,
    hueText: 'text-cosmos-anchor',
    hueRingBg: 'bg-cosmos-anchor/10',
    hueGlow: 'shadow-[0_-1px_30px_-15px_hsl(var(--cosmos-anchor)/0.6)]',
  },
  {
    stage: 'I',
    title: 'Model the next move.',
    description:
      'Selling shares or switching debt — each ripples across tax and liquidity. See it before deciding.',
    descriptor: 'Scenario modelling',
    glyph: InvestGlyph,
    hueText: 'text-cosmos-invest',
    hueRingBg: 'bg-cosmos-invest/10',
    hueGlow: 'shadow-[0_-1px_30px_-15px_hsl(var(--cosmos-invest)/0.6)]',
  },
  {
    stage: 'L',
    title: 'Decide from the picture.',
    description:
      'When the picture is clean, decisions are faster. Fewer "can we afford this" moments.',
    descriptor: 'One calm view',
    glyph: LiveGlyph,
    hueText: 'text-cosmos-live',
    hueRingBg: 'bg-cosmos-live/10',
    hueGlow: 'shadow-[0_-1px_30px_-15px_hsl(var(--cosmos-live)/0.6)]',
  },
] as const;

export function FiveCapabilities() {
  return (
    <section
      id="trail"
      aria-label="The five TRAIL capabilities"
      className="bg-cosmos py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="mb-16 max-w-3xl">
            <p className="mb-4 inline-block text-[11px] font-medium uppercase tracking-[0.3em] text-cosmos-action">
              The Five
            </p>
            <h2 className="mb-6 text-balance text-3xl font-semibold leading-[1.15] tracking-tight text-cosmos sm:text-4xl lg:text-[44px]">
              One framework. Five capabilities. The order that compounds.
            </h2>
            <p className="text-lg leading-relaxed text-cosmos-soft">
              Track sets the picture. Reduce cuts the leaks. Anchor confirms the
              safety net. Invest models the next move. Live makes decisions from
              the full picture.
            </p>
          </div>
        </Reveal>

        <StaggerContainer className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          {CAPABILITIES.map(
            ({ stage, title, description, descriptor, glyph: Glyph, hueText, hueRingBg, hueGlow }) => (
              <StaggerItem key={stage}>
                <article
                  className={`cosmos-glass group flex h-full min-h-[360px] flex-col justify-between rounded-2xl p-7 transition-transform duration-300 hover:-translate-y-1 ${hueGlow}`}
                >
                  <div>
                    <div
                      className={`mb-6 flex h-10 w-10 items-center justify-center rounded-lg ${hueRingBg}`}
                    >
                      <Glyph className={`h-5 w-5 ${hueText}`} />
                    </div>
                    <h3 className="mb-3 text-xl font-semibold leading-snug text-cosmos">
                      {title}
                    </h3>
                    <p className="text-sm leading-relaxed text-cosmos-soft">
                      {description}
                    </p>
                  </div>
                  <div className="mt-8 border-t border-cosmos-hairline pt-5">
                    <span
                      className={`block text-[10px] font-medium uppercase tracking-[0.18em] ${hueText}`}
                    >
                      {stage === 'T' && 'Track'}
                      {stage === 'R' && 'Reduce'}
                      {stage === 'A' && 'Anchor'}
                      {stage === 'I' && 'Invest'}
                      {stage === 'L' && 'Live'}
                    </span>
                    <p className="mt-1 text-lg font-semibold text-cosmos">{descriptor}</p>
                  </div>
                </article>
              </StaggerItem>
            ),
          )}
        </StaggerContainer>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stage glyphs — filled silhouettes, `fill='currentColor'`, no strokes.    */
/* -------------------------------------------------------------------------- */

type GlyphProps = { className?: string };

function TrackGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3 13h2v6H3zm5-5h2v11H8zm5-4h2v15h-2zm5 7h2v8h-2z" />
    </svg>
  );
}

function ReduceGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="m12 2 2 6h6l-5 4 2 7-6-4-6 4 2-7-5-4h6z" />
    </svg>
  );
}

function AnchorGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-1 5.83V10H8v2h3v8.93A8 8 0 0 1 3.07 13H6v-2H1v1a11 11 0 0 0 22 0v-1h-5v2h2.93A8 8 0 0 1 13 20.93V12h3v-2h-3V7.83A3 3 0 0 0 12 2m0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2" />
    </svg>
  );
}

function InvestGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="m3 17 6-6 4 4 7-9 2 1-9 11-4-4-5 5z" />
    </svg>
  );
}

function LiveGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

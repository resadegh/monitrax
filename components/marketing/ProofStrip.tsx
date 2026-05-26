'use client';

/**
 * Public-site marketing — "Built for Australian structures" proof strip.
 *
 * Phase 48 PR 4 (2026-05-26). Built from the Stitch `below-hero` canonical
 * screen, section 2. Sits directly under the hero. Establishes credibility
 * by surfacing the six wealth structures the engine understands —
 * proof-by-specificity, not buzzword adjacent ("trusted by thousands" etc.).
 *
 * Composes: cosmos-* tokens (PR 1), `Reveal` (animations.tsx).
 */

import { Reveal } from './animations';

const STRUCTURES = [
  { label: 'Property', glyph: PropertyGlyph },
  { label: 'SMSF', glyph: SmsfGlyph },
  { label: 'Investments', glyph: InvestmentsGlyph },
  { label: 'Trust', glyph: TrustGlyph },
  { label: 'Company', glyph: CompanyGlyph },
  { label: 'Super', glyph: SuperGlyph },
] as const;

export function ProofStrip() {
  return (
    <section
      aria-label="Built for Australian structures"
      className="relative overflow-hidden border-y border-cosmos-hairline bg-cosmos py-20"
    >
      <div className="mx-auto max-w-7xl px-6 text-center">
        <Reveal>
          <p className="mb-8 text-[11px] font-medium uppercase tracking-[0.2em] text-cosmos-muted">
            Built for Australian structures
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <ul className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {STRUCTURES.map(({ label, glyph: Glyph }) => (
              <li
                key={label}
                className="cosmos-glass inline-flex items-center gap-3 rounded-full px-6 py-3"
              >
                <Glyph className="h-5 w-5 text-cosmos-action" />
                <span className="text-sm font-medium text-cosmos">{label}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inline glyphs — fill='currentColor', filled silhouettes, no strokes.      */
/*  Aligned with `components/wealth/wealthGlyphs.tsx` vocabulary.             */
/* -------------------------------------------------------------------------- */

type GlyphProps = { className?: string };

function PropertyGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z" />
    </svg>
  );
}

function SmsfGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2 2 7v2h20V7zm-8 9v7H2v2h20v-2h-2v-7h-3v7h-2v-7h-2v7h-2v-7h-2v7H7v-7z" />
    </svg>
  );
}

function InvestmentsGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="m3 17 6-6 4 4 7-9 2 1-9 11-4-4-5 5z" />
    </svg>
  );
}

function TrustGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />
    </svg>
  );
}

function CompanyGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3 21V7l9-4 9 4v14h-6v-7h-6v7zm5-11h2V8H8zm6 0h2V8h-2zm-6 4h2v-2H8zm6 0h2v-2h-2z" />
    </svg>
  );
}

function SuperGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C7 2 4 5 4 9c0 3.5 2 5 5 6v3a3 3 0 1 0 6 0v-3c3-1 5-2.5 5-6 0-4-3-7-8-7m-1 19v-3h2v3a1 1 0 1 1-2 0" />
    </svg>
  );
}

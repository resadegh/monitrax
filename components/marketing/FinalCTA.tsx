'use client';

/**
 * Public-site marketing — Final CTA.
 *
 * Phase 48 PR 5 (2026-05-26). Built from the Stitch `closing` canonical
 * screen, section 10. Last conversion surface before the footer.
 * Replaces the v1 `TrailCTA` — the LAST remaining v1 marketing component
 * (after PR 5 the entire landing page is Deep Cosmos canonical).
 *
 * Composes: cosmos-* tokens + `cosmos-cta` + `cosmos-glow-center` (PR 1),
 * `Reveal` (animations.tsx).
 */

import Link from 'next/link';
import { Reveal } from './animations';

export function FinalCTA() {
  return (
    <section
      aria-label="Ready to see the picture"
      className="cosmos-glow-center relative overflow-hidden bg-cosmos py-32 md:py-40"
    >
      <Reveal>
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
          <p className="mb-8 text-[11px] font-medium uppercase tracking-[0.18em] text-cosmos-muted">
            The next move
          </p>
          <h2 className="mb-8 max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-cosmos sm:text-5xl lg:text-6xl xl:text-[64px]">
            Ready to see the picture?
          </h2>
          <p className="mb-12 max-w-md text-lg leading-relaxed text-cosmos-soft">
            Add your accounts, model your next move, decide from clarity. No bank
            connection required to start.
          </p>
          <Link
            href="/register"
            className="cosmos-cta group inline-flex min-h-[44px] items-center gap-2 rounded-full px-10 py-5 text-base font-semibold"
          >
            Start free
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="mt-6 text-sm font-medium tracking-wide text-cosmos-muted">
            No credit card. Just clarity.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

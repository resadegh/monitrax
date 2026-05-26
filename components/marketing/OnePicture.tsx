'use client';

/**
 * Public-site marketing — "One picture · no swivel-chairing" section.
 *
 * Phase 48 PR 4 (2026-05-26). Built from the Stitch `below-hero` canonical
 * screen, section 3. Two-column layout. Left: editorial copy on the
 * "integration debt" idea. Right: stylised before / engine / after
 * visualization that demonstrates Monitrax's collapse-the-tools value.
 *
 * Strategic discipline (CLAUDE.md §0 + Phase 46 §9):
 *   - The "Strategic Simulation" decision card is labelled **Example** to
 *     make clear the number is illustrative, not derived from a user's
 *     real data. We never quote numbers we can't trace to canonical data.
 *   - "Discover the Engine" link routes to `/trail-method` (the closest
 *     existing surface that explains how the engine works) — no dead links.
 *
 * Composes: cosmos-* tokens (PR 1), `Reveal` (animations.tsx).
 */

import Link from 'next/link';
import { Reveal } from './animations';

export function OnePicture() {
  return (
    <section
      aria-label="One picture, no swivel-chairing"
      className="relative overflow-hidden bg-cosmos py-24 md:py-32"
    >
      {/* Subtle radial emerald glow behind the right column */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 -z-0 hidden h-full w-1/2 lg:block"
        style={{
          background:
            'radial-gradient(circle at 70% 50%, hsl(var(--cosmos-action) / 0.06), transparent 60%)',
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2 lg:gap-20">
        {/* LEFT — editorial copy */}
        <Reveal>
          <div className="max-w-xl">
            <div className="mb-6 flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-8 bg-cosmos-action" />
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-cosmos-action">
                One view · no swivel-chairing
              </span>
            </div>
            <h2 className="mb-6 text-balance text-3xl font-semibold leading-[1.15] tracking-tight text-cosmos sm:text-4xl lg:text-[44px]">
              Your financial life lives across five tabs, two portals, and your
              accountant's head.
            </h2>
            <blockquote className="mb-6 border-l-2 border-cosmos-action/30 pl-6 text-base italic leading-relaxed text-cosmos-soft">
              "That's integration debt — the cost of running more moving parts
              than any single view can hold."
            </blockquote>
            <p className="mb-8 text-lg leading-relaxed text-cosmos-soft">
              Monitrax brings them together. Property, loans, super, investments,
              cashflow, and tax — read by one engine, in one calm view, with the
              relationships between them already mapped. The picture you've been
              holding in your head, finally written down.
            </p>
            <Link
              href="/trail-method"
              className="group inline-flex items-center gap-3 text-sm font-medium text-cosmos-action transition-colors hover:text-cosmos-action-soft"
            >
              Discover the engine
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
        </Reveal>

        {/* RIGHT — before / engine / after visualization */}
        <Reveal delay={0.1}>
          <div className="relative flex min-h-[560px] flex-col items-center justify-between py-4">
            {/* BEFORE — scattered glass tiles */}
            <div className="relative h-44 w-full">
              <span className="absolute left-1/2 top-0 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.18em] text-cosmos-faint">
                Before
              </span>
              <ScatterTile className="left-[10%] top-10 -rotate-12 opacity-50" />
              <ScatterTile className="right-[18%] top-6 rotate-12 opacity-40" />
              <ScatterTile className="left-1/2 top-24 -translate-x-1/2 -rotate-3 opacity-60" />
              <ScatterTile className="left-[28%] top-12 rotate-6 opacity-30" />
              <ScatterTile className="right-[8%] top-28 -rotate-[20deg] opacity-50" />
            </div>

            {/* ENGINE node — glass pill with pulse dot */}
            <div className="relative flex w-full items-center justify-center py-10">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cosmos-action/30 to-transparent"
              />
              <div className="cosmos-glass relative z-10 inline-flex items-center gap-3 rounded-full border border-cosmos-action/30 bg-cosmos-surface px-8 py-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-cosmos-action opacity-50" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-cosmos-action" />
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-cosmos">
                  Monitrax Engine
                </span>
              </div>
            </div>

            {/* AFTER — the decision card */}
            <div className="w-full">
              <p className="mb-5 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-cosmos-action/70">
                Now you can decide
              </p>
              <div className="mx-auto max-w-md rounded-2xl border border-cosmos-action/40 bg-cosmos-action/[0.04] p-7 shadow-[0_0_40px_rgba(22,163,74,0.12)] backdrop-blur-3xl">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-cosmos-action">
                    Strategic Simulation
                  </h3>
                  <span className="rounded-md border border-cosmos-hairline bg-cosmos-elevated px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cosmos-muted">
                    Example
                  </span>
                </div>
                <p className="text-base font-medium leading-snug text-cosmos">
                  "Sell the brokerage holdings, pay down the offset, or
                  salary-sacrifice $200/mo to super?"
                </p>
                <div className="mt-7 flex items-end justify-between border-t border-cosmos-action/20 pt-5">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-cosmos-muted">
                      Modelled outcome
                    </span>
                    <span className="text-xl font-semibold text-cosmos-action">
                      Clarity before commitment
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ScatterTile({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute h-10 w-10 rounded-xl border border-cosmos-hairline bg-cosmos-surface/70 backdrop-blur-md ${className ?? ''}`}
    />
  );
}

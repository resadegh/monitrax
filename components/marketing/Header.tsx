'use client';

/**
 * Public-site marketing header.
 *
 * Phase 48 PR 2 (2026-05-26): rebuilt to the dark Deep Cosmos design
 * (`docs/blueprint/PHASE_48_PUBLIC_WEBSITE_REDESIGN.md`,
 * `.stitch/SITE.md` §7 — locked v4 direction). Composes the cosmos-*
 * token vocabulary added in PR 1.
 *
 * Behavioural contract preserved from the previous header:
 *   - sticky top-0 z-50 (`useEffect` not needed — pure CSS sticky)
 *   - mobile menu toggle via local `useState`
 *   - nav items + Sign in / Start free CTAs route to the same paths
 *     (`/signin`, `/register`)
 *
 * Visual deltas vs the previous (ivory-era v1):
 *   - Logo: refined geometric "M" — emerald-tinted square (cosmos-action/15
 *     bg + cosmos-action/30 border). NO amber gradient pill (that was v1
 *     leftover; SITE.md §7 explicit "remove").
 *   - CTAs: emerald `cosmos-cta` pill instead of amber gradient. Brand
 *     action color locked per SITE.md §7.
 *   - Nav: trimmed from 4 to 3 items — removed `/pricing` and `/security`
 *     because those routes do not exist (CLAUDE.md §12.1 zero-dead-links).
 *     `/pricing` will return as `/#pricing` anchor once PR 5 lands.
 *   - Background: `bg-cosmos-deeper/80 backdrop-blur-xl` (was `bg-stone-950/90`).
 *
 * No auth-context awareness here — that's intentional. The header is
 * presentational; authenticated users on `app/page.tsx` are redirected to
 * `/dashboard` via the useEffect added in PR 1, so they don't see the
 * marketing header for more than a single frame.
 */

import Link from 'next/link';
import { useState } from 'react';

const NAV_ITEMS = [
  { label: 'The TRAIL', href: '/#trail' },
  { label: 'Method', href: '/trail-method' },
  { label: 'Wealth Check', href: '/wealth-check' },
] as const;

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-cosmos-hairline bg-cosmos-deeper/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand mark — geometric M, emerald-tinted square, refined */}
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-opacity duration-200 hover:opacity-90"
            aria-label="Monitrax — home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cosmos-action/30 bg-cosmos-action/15">
              <span className="text-lg font-bold tracking-tight text-cosmos-action">M</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-cosmos">Monitrax</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-cosmos-soft transition-colors duration-200 hover:text-cosmos"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/signin"
              className="rounded-full px-4 py-2 text-sm font-medium text-cosmos-soft transition-colors duration-200 hover:text-cosmos"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="cosmos-cta inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Start free
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="md:hidden -mr-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-cosmos transition-colors hover:bg-cosmos-elevated"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile nav drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-cosmos-hairline py-4">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-cosmos-soft transition-colors hover:bg-cosmos-elevated hover:text-cosmos"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-cosmos-hairline pt-3">
                <Link
                  href="/signin"
                  className="rounded-full border border-cosmos-hairline px-4 py-2.5 text-center text-sm font-medium text-cosmos transition-colors hover:bg-cosmos-elevated"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="cosmos-cta inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Start free
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

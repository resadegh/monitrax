/**
 * Public-site marketing footer.
 *
 * Phase 48 PR 2 (2026-05-26): rebuilt to the dark Deep Cosmos design
 * (`docs/blueprint/PHASE_48_PUBLIC_WEBSITE_REDESIGN.md` §4 PR2 row,
 * `.stitch/SITE.md` §7 — locked v4 direction, Stitch `closing` screen).
 * Composes the cosmos-* token vocabulary added in PR 1.
 *
 * Visual deltas vs the previous (v1):
 *   - Background: `bg-cosmos-deeper` (#08080F) — slightly darker than the
 *     body's `--cosmos-bg` (#0A0A14), creating a chiseled-edge delineation
 *     between content and footer per the Stitch closing.html reference.
 *   - Logo: refined geometric "M" — emerald-tinted square (matches Header).
 *     Previous logo was a solid emerald block — works but less elegant.
 *   - Trimmed dead-link columns. CLAUDE.md §12.1 zero-dead-links audit
 *     (2026-05-26) confirmed the following routes do NOT exist:
 *       `/about`, `/contact`, `/blog`, `/learn`, `/changelog`,
 *       `/pricing`, `/security`
 *     Previous footer linked to ALL of them — every click landed on a 404.
 *     This rebuild keeps only links to routes that resolve, plus anchor
 *     links to landing-page sections that PR 3-5 will add (`/#trail`,
 *     `/#pricing`, `/#security`). The "Company" column is removed entirely
 *     because every entry there was dead.
 *   - ACN displayed (per the Phase 47 legal docs — ReNew Holding Company
 *     Pty Ltd, ACN 675 267 311, 10 Fairview St Guildford NSW 2161). ABN
 *     omitted until confirmed.
 *   - Social icons removed for now — the previous placeholder URLs went to
 *     `linkedin.com` and `twitter.com` (provider home pages, not Monitrax
 *     accounts). Will return in a follow-up PR once real handles exist.
 */

import Link from 'next/link';

const PRODUCT_LINKS = [
  { label: 'Sign in', href: '/signin' },
  { label: 'Start free', href: '/register' },
  { label: 'The TRAIL', href: '/#trail' },
] as const;

const EXPLORE_LINKS = [
  { label: 'TRAIL Check', href: '/trail-check' },
  { label: 'Wealth Check', href: '/wealth-check' },
  { label: 'The TRAIL Method', href: '/trail-method' },
] as const;

const LEGAL_LINKS = [
  { label: 'Terms of Service', href: '/legal/terms-of-service' },
  { label: 'Privacy Policy', href: '/legal/privacy-policy' },
  { label: 'AFSL · Credit · Tax Boundary', href: '/legal/afsl-credit-tax-boundary-disclosure' },
  { label: 'CDR Policy', href: '/legal/cdr-policy' },
  { label: 'All legal documents', href: '/legal' },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-cosmos-hairline bg-cosmos-deeper" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-16 md:py-20">
          <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4 lg:gap-x-12">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Monitrax — home">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cosmos-action/30 bg-cosmos-action/15">
                  <span className="text-lg font-bold tracking-tight text-cosmos-action">M</span>
                </div>
                <span className="text-lg font-semibold tracking-tight text-cosmos">Monitrax</span>
              </Link>
              <p className="mt-6 max-w-xs text-sm leading-relaxed text-cosmos-soft">
                Australian wealth operating system for households outgrowing spreadsheets.
              </p>
              <p className="mt-6 text-[11px] uppercase leading-loose tracking-[0.18em] text-cosmos-faint">
                ReNew Holding Company Pty Ltd
                <br />
                ACN 675 267 311
              </p>
            </div>

            {/* Product column */}
            <div>
              <h3 className="text-sm font-semibold text-cosmos">Product</h3>
              <ul className="mt-5 space-y-3">
                {PRODUCT_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-cosmos-soft transition-colors hover:text-cosmos"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Explore column */}
            <div>
              <h3 className="text-sm font-semibold text-cosmos">Explore</h3>
              <ul className="mt-5 space-y-3">
                {EXPLORE_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-cosmos-soft transition-colors hover:text-cosmos"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal column */}
            <div>
              <h3 className="text-sm font-semibold text-cosmos">Legal</h3>
              <ul className="mt-5 space-y-3">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-cosmos-soft transition-colors hover:text-cosmos"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar — chiseled hairline divider + copyright */}
        <div className="border-t border-cosmos-hairline py-8">
          <p className="text-xs text-cosmos-faint">
            © {new Date().getFullYear()} Monitrax. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

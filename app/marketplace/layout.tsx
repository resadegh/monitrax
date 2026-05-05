/**
 * Phase 32C PR4a — Public marketplace layout.
 *
 * Public-facing surface for D2C users (signed-in or not) to discover
 * professionals on Monitrax. Org-attached users go through the in-app
 * Ask-a-Pro flow — see IMPLEMENTATION_PLAN.md "leaky funnel" guardrail.
 *
 * Mirrors the Help Center chrome (warm-ivory background, brand mark, simple
 * top nav) so the marketplace reads as part of Monitrax, not a tacked-on
 * directory site. Future split to `marketplace.monitrax.com.au` is a Vercel
 * rewrite — the layout stays.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Find a professional · Monitrax',
  description:
    'Browse Monitrax-vetted financial advisers, mortgage brokers, and accountants in Australia.',
};

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Link href="/marketplace" className="flex items-center gap-2 group">
            <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold tracking-tight group-hover:bg-slate-800 transition-colors">
              M
            </span>
            <span className="font-semibold tracking-tight">Monitrax · Find a professional</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/help/consumer/what-is-trail"
              className="px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              How Monitrax works
            </Link>
            <Link
              href="/"
              className="px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Open app
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-200/70 mt-16 py-8 text-center text-xs text-slate-500">
        Listings on Monitrax are reviewed before going live. Compliance numbers (AFSL / credit rep / TPB) are
        cross-checked against ASIC and the Tax Practitioners Board public registers.
      </footer>
    </div>
  );
}

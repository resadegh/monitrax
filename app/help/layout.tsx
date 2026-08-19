/**
 * Help Center layout — public surface, no auth required.
 *
 * Inherits the consumer brand tokens (warm-ivory background, brand navy
 * accents) so the help site reads as part of Monitrax, not a tacked-on
 * docs subdomain. Future split to `help.monitrax.com.au` is a Vercel
 * rewrite — the layout stays.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { isModuleEnabled } from '@/lib/featureFlags/moduleGate';

export const metadata = {
  title: 'Help Center · Monitrax',
  description:
    'Documentation, training, and compliance resources for Monitrax users, organisations, and their compliance teams.',
};

export default async function HelpLayout({ children }: { children: ReactNode }) {
  // MON-163: the "Practice" nav item targets /portal/dashboard — a
  // MODULE_ORG_PORTAL surface, hidden in v1. Server-side flag read (this
  // is a server layout; the fail-closed gate hides the link on any error).
  // MON-160 class: force request-time rendering so a build never bakes
  // the flag verdict into the static shell (same doctrine as the ONE
  // shared route guard).
  await connection();
  const portalModuleEnabled = await isModuleEnabled('MODULE_ORG_PORTAL');
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Link
            href="/help"
            className="flex items-center gap-2 group"
          >
            <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold tracking-tight group-hover:bg-slate-800 transition-colors">
              M
            </span>
            <span className="font-semibold tracking-tight">Monitrax Help</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Open app
            </Link>
            {portalModuleEnabled && (
              <Link
                href="/portal/dashboard"
                className="px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Practice
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-200/70 mt-16 py-8 text-center text-xs text-slate-500">
        Monitrax — wealth orchestration for Australian households and the
        professionals who advise them.
      </footer>
    </div>
  );
}

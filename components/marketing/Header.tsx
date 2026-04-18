'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-stone-950/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 shadow-sm">
              <span className="text-lg font-bold text-white">M</span>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Monitrax</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/#trail"
              className="text-sm font-medium text-stone-400 hover:text-white transition-colors"
            >
              The TRAIL
            </Link>
            <Link
              href="/trail-method"
              className="text-sm font-medium text-stone-400 hover:text-white transition-colors"
            >
              Method
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-stone-400 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/security"
              className="text-sm font-medium text-stone-400 hover:text-white transition-colors"
            >
              Security
            </Link>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" className="text-stone-300 hover:text-white hover:bg-white/10" asChild>
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button className="bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-sm" asChild>
              <Link href="/register">Start free</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 -mr-2 text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.06] py-4">
            <nav className="flex flex-col gap-4">
              <Link
                href="/#trail"
                className="text-sm font-medium text-stone-400 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                The TRAIL
              </Link>
              <Link
                href="/trail-method"
                className="text-sm font-medium text-stone-400 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Method
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-medium text-stone-400 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/security"
                className="text-sm font-medium text-stone-400 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Security
              </Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.06]">
                <Button variant="outline" className="w-full bg-transparent border-stone-700 text-stone-300 hover:bg-white/10 hover:text-white" asChild>
                  <Link href="/signin">Sign in</Link>
                </Button>
                <Button className="w-full bg-gradient-to-b from-amber-500 to-amber-600 text-white" asChild>
                  <Link href="/register">Start free</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

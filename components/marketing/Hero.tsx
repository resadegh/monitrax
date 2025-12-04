import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-primary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-16 sm:py-24 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
            {/* Left column - Copy */}
            <div className="max-w-2xl">
              {/* Pill badge */}
              <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium mb-6 text-white/90">
                <span className="text-brand-secondary">Australian wealth OS</span>
                <span className="mx-2 text-white/50">•</span>
                <span className="text-white/70">Forecasts</span>
                <span className="mx-2 text-white/50">•</span>
                <span className="text-white/70">Strategy</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-white">
                Know where your wealth is{' '}
                <span className="text-brand-secondary">heading</span>, not just where it&apos;s been.
              </h1>

              {/* Subheadline */}
              <p className="mt-6 text-lg text-white/70 sm:text-xl">
                Monitrax brings your properties, loans, investments and cash together with
                Australian-aware forecasts and an AI strategy engine.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-brand-secondary hover:bg-brand-secondary/90 text-white" asChild>
                  <Link href="/pricing">See plans & pricing</Link>
                </Button>
                <Button size="lg" variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white" asChild>
                  <Link href="/signin">Sign in</Link>
                </Button>
              </div>

              {/* Trust icons */}
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/60">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Property
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Investments
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Tax
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Cashflow
                </div>
              </div>
            </div>

            {/* Right column - App preview */}
            <div className="relative lg:pl-8">
              <div className="relative rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl backdrop-blur-sm">
                <div className="rounded-xl bg-neutral-900/80 p-6">
                  {/* Mock dashboard preview */}
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="h-6 w-32 rounded bg-white/10" />
                      <div className="h-8 w-8 rounded-full bg-white/10" />
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                        <div className="h-3 w-16 rounded bg-white/10 mb-2" />
                        <div className="h-6 w-24 rounded bg-brand-secondary/30" />
                      </div>
                      <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                        <div className="h-3 w-16 rounded bg-white/10 mb-2" />
                        <div className="h-6 w-20 rounded bg-brand-secondary/20" />
                      </div>
                      <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                        <div className="h-3 w-16 rounded bg-white/10 mb-2" />
                        <div className="h-6 w-24 rounded bg-sky-500/20" />
                      </div>
                    </div>

                    {/* Chart placeholder */}
                    <div className="rounded-lg bg-white/5 p-4 border border-white/10">
                      <div className="h-3 w-24 rounded bg-white/10 mb-4" />
                      <div className="flex items-end gap-1 h-32">
                        {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((height, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t bg-brand-secondary/60"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* List items */}
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg bg-white/5 p-3 border border-white/10">
                          <div className="h-8 w-8 rounded bg-white/10" />
                          <div className="flex-1">
                            <div className="h-3 w-24 rounded bg-white/10 mb-1" />
                            <div className="h-2 w-16 rounded bg-white/5" />
                          </div>
                          <div className="h-4 w-16 rounded bg-white/10" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 h-72 w-72 rounded-full bg-brand-secondary/10 blur-3xl" />
              <div className="absolute -bottom-8 -left-8 h-72 w-72 rounded-full bg-brand-secondary/5 blur-3xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}

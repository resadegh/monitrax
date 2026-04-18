'use client';

import Link from 'next/link';
import { Reveal } from './animations';

export function TrailCTA() {
  return (
    <section className="bg-stone-950">
      <div className="mx-auto max-w-3xl px-6 py-24 sm:py-32 text-center">
        <Reveal>
          <h2
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
            style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            Ready to start your TRAIL?
          </h2>
        </Reveal>

        <Reveal delay={0.12}>
          <p className="mx-auto mt-4 max-w-xl text-lg text-stone-400" style={{ lineHeight: 1.6 }}>
            Join thousands of Australians who stopped stressing about money
            and started living.
          </p>
        </Reveal>

        <Reveal delay={0.24}>
          <div className="mt-10">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-amber-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-600/30"
            >
              Start for free
            </Link>
            <p className="mt-3 text-sm text-stone-500">
              No credit card. No commitment. Just clarity.
            </p>
            <p className="mt-4">
              <Link
                href="/trail-check"
                className="text-sm font-medium text-stone-400 hover:text-amber-400 transition-colors"
              >
                Not ready? Take the free TRAIL Check first &rarr;
              </Link>
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.36}>
          <p className="mt-12 text-sm text-stone-600 italic">
            Your trail to financial freedom starts with one step: seeing
            where you stand.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

'use client';

import { Reveal } from './animations';

export function TrailBridge() {
  return (
    <section className="bg-white dark:bg-stone-950">
      <div className="mx-auto max-w-2xl px-6 py-24 sm:py-32 text-center">
        <Reveal>
          <h2
            className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-4xl lg:text-5xl"
            style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            What if your money
            <br />
            <span className="text-amber-600">had one view?</span>
          </h2>
        </Reveal>

        <Reveal delay={0.15}>
          <p
            className="mx-auto mt-6 max-w-xl text-lg text-stone-500 dark:text-stone-400"
            style={{ lineHeight: 1.7 }}
          >
            Not another app that shows you charts. A clearer view of property,
            super, investments, cashflow, tax and entities — together — so you
            can see what changes when you adjust the levers.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

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
            <span className="text-amber-600">had a guide?</span>
          </h2>
        </Reveal>

        <Reveal delay={0.15}>
          <p
            className="mx-auto mt-6 max-w-xl text-lg text-stone-500 dark:text-stone-400"
            style={{ lineHeight: 1.7 }}
          >
            Not another app that shows you charts and leaves you to figure it
            out. A personal financial guide that walks beside you — from
            confusion to confidence, one step at a time.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

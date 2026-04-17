'use client';

import { Reveal, StaggerContainer, StaggerItem } from './animations';

const painPoints = [
  'You have 4 bank accounts, 2 credit cards, and a mortgage. None of them talk to each other.',
  'You check your balance and wonder where $3,000 went last month.',
  "You know you should be doing better. You just don't know where to start.",
];

export function TrailProblem() {
  return (
    <section className="bg-stone-50 dark:bg-stone-900">
      <div className="mx-auto max-w-3xl px-6 py-24 sm:py-32 text-center">
        <Reveal>
          <h2
            className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-4xl lg:text-5xl"
            style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            You&apos;re not bad with money.
            <br />
            <span className="text-stone-500 dark:text-stone-400">
              You just don&apos;t have a path.
            </span>
          </h2>
        </Reveal>

        <StaggerContainer className="mt-16 space-y-6 text-left">
          {painPoints.map((point, i) => (
            <StaggerItem key={i}>
              <div className="flex gap-4 items-start rounded-2xl bg-white dark:bg-stone-800 p-6 shadow-sm border border-stone-200 dark:border-stone-700">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-700 text-sm font-semibold text-stone-500">
                  {i + 1}
                </span>
                <p className="text-lg text-stone-600 dark:text-stone-300" style={{ lineHeight: 1.6 }}>
                  {point}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <Reveal delay={0.4}>
          <p className="mt-12 text-base text-stone-500 dark:text-stone-400">
            <span className="text-2xl font-bold text-stone-900 dark:text-stone-100">72%</span>{' '}
            of Australians feel stressed about money.{' '}
            <span className="text-amber-600 font-medium">You&apos;re not alone.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

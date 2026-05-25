'use client';

import { Reveal, StaggerContainer, StaggerItem } from './animations';

const painPoints = [
  'Your accountant sees one slice of your finances, once a year. The other 364 days, you are holding the picture in your head.',
  'Your mortgage, super, broker, ETFs and rental property each live in a different login. None of them know about each other.',
  'You could probably guess your net worth within 20%. You could not prove it tonight without an hour of spreadsheets.',
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
            You don&apos;t have a money problem.
            <br />
            <span className="text-stone-500 dark:text-stone-400">
              You have a picture problem.
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
          <p className="mt-12 text-base text-stone-500 dark:text-stone-400 max-w-2xl mx-auto" style={{ lineHeight: 1.7 }}>
            When you&apos;ve got more than three moving parts, the picture
            starts living across five tabs, two portals and your
            accountant&apos;s head.{' '}
            <span className="text-amber-600 font-medium">
              That&apos;s the problem Monitrax exists to solve.
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

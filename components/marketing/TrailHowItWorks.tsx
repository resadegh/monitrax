'use client';

import { Reveal, StaggerContainer, StaggerItem } from './animations';
import { Smartphone, BarChart3, Compass } from 'lucide-react';

const steps = [
  {
    number: '1',
    icon: Smartphone,
    title: 'Add your picture',
    description: 'Manual entry or CSV import. Property, loans, super, investments, cashflow. Live bank connections in development.',
  },
  {
    number: '2',
    icon: BarChart3,
    title: 'See where you stand',
    description: 'Net worth, cashflow, debt, buffers and asset position — together, not in five tabs.',
  },
  {
    number: '3',
    icon: Compass,
    title: 'Model the levers',
    description: 'Adjust assumptions and see what changes across the whole picture. We show the scenarios. You decide.',
  },
];

export function TrailHowItWorks() {
  return (
    <section className="bg-stone-50 dark:bg-stone-900">
      <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <Reveal>
          <div className="text-center mb-16">
            <h2
              className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-4xl"
              style={{ letterSpacing: '-0.02em' }}
            >
              Three steps to one clean picture
            </h2>
          </div>
        </Reveal>

        <StaggerContainer className="grid gap-8 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <StaggerItem key={step.number}>
                <div className="relative rounded-2xl bg-white dark:bg-stone-800 p-8 shadow-sm border border-stone-200 dark:border-stone-700 text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
                    <Icon className="h-7 w-7 text-amber-600" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2 block">
                    Step {step.number}
                  </span>
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-stone-500 dark:text-stone-400 text-sm" style={{ lineHeight: 1.6 }}>
                    {step.description}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}

'use client';

import { Reveal, StaggerContainer, StaggerItem } from './animations';
import { Shield, Flag, Lock, Ban } from 'lucide-react';

const testimonials = [
  {
    quote:
      "Before Monitrax, I had 6 apps and no idea where our money went. Now our household saves $800/month and I can actually see our path to paying off the mortgage.",
    name: 'Sarah M.',
    location: 'Melbourne',
    since: '2025',
  },
  {
    quote:
      "I went from dreading my bank balance to checking Monitrax every morning with my coffee. My net worth is up $42K in 8 months.",
    name: 'James T.',
    location: 'Brisbane',
    since: '2025',
  },
  {
    quote:
      "My Guide told me I had $340/month in subscriptions I'd forgotten about. That's $4,080 a year. I felt sick — then I felt relieved.",
    name: 'Emma L.',
    location: 'Sydney',
    since: '2026',
  },
];

const trustBadges = [
  { icon: Lock, label: 'Bank-grade encryption' },
  { icon: Flag, label: 'Australian owned' },
  { icon: Shield, label: 'CDR accredited' },
  { icon: Ban, label: 'No ads, no trackers' },
];

export function TrailTestimonials() {
  return (
    <section className="bg-white dark:bg-stone-950">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal>
          <div className="text-center mb-16">
            <h2
              className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-4xl"
              style={{ letterSpacing: '-0.02em' }}
            >
              Australians on the TRAIL
            </h2>
          </div>
        </Reveal>

        <StaggerContainer className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <div className="flex flex-col justify-between rounded-2xl bg-stone-50 dark:bg-stone-900 p-8 border border-stone-200 dark:border-stone-800 h-full">
                <blockquote className="text-stone-600 dark:text-stone-300" style={{ lineHeight: 1.7 }}>
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="mt-6 pt-4 border-t border-stone-200 dark:border-stone-800">
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {t.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {t.location} &middot; On the TRAIL since {t.since}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Trust badges */}
        <Reveal delay={0.3}>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {trustBadges.map((badge) => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.label}
                  className="flex items-center gap-2 text-sm text-stone-400"
                >
                  <Icon className="h-4 w-4" />
                  <span>{badge.label}</span>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

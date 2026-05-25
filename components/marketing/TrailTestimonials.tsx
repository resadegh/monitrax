'use client';

import { Reveal, StaggerContainer, StaggerItem } from './animations';
import { Shield, Flag, Lock, Ban } from 'lucide-react';

/**
 * Trust blocks (Phase 47 row 66 — wealth-builder ICP rewrite).
 *
 * Replaces the prior testimonial cards, which contained fabricated
 * quotes with specific dollar amounts. Per CLAUDE.md §0 and the
 * Phase 47 Master Positioning Brief, manufactured social proof
 * before there are real customers carries ACL s18 misleading-conduct
 * risk. The trust-block format is honest at this stage of the
 * product and reads as substantive credibility for the wealth-builder
 * ICP. When real consenting customer stories exist later, swap
 * this section back to a testimonial format.
 */
const trustBlocks = [
  {
    title: 'Built around TRAIL',
    body: 'Track → Reduce → Anchor → Invest → Live. A five-stage framework that gives a complex financial life an order, without pretending it is simple.',
  },
  {
    title: 'Compliance bedrock',
    body: 'Privacy Act and Consumer Data Right protections built in. No advertising trackers. No data sales. CDR Representative pathway in progress for live bank connections.',
  },
  {
    title: 'Built by an Australian wealth-builder',
    body: 'Started because the same person buying property, contributing to super, running a small business and managing a trust should not have to hold the picture in their head.',
  },
];

const trustBadges = [
  { icon: Lock, label: 'Bank-grade encryption' },
  { icon: Flag, label: 'Australian owned' },
  { icon: Shield, label: 'CDR pathway in progress' },
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
              Built for the Australian wealth-builder
            </h2>
          </div>
        </Reveal>

        <StaggerContainer className="grid gap-6 md:grid-cols-3">
          {trustBlocks.map((b) => (
            <StaggerItem key={b.title}>
              <div className="flex flex-col rounded-2xl bg-stone-50 dark:bg-stone-900 p-8 border border-stone-200 dark:border-stone-800 h-full">
                <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-3">
                  {b.title}
                </h3>
                <p className="text-stone-600 dark:text-stone-300" style={{ lineHeight: 1.7 }}>
                  {b.body}
                </p>
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

'use client';

import { Reveal } from './animations';
import {
  Eye,
  Scissors,
  Anchor,
  TrendingUp,
  Sun,
} from 'lucide-react';

const stages = [
  {
    letter: 'T',
    name: 'Track',
    tagline: 'See your full picture',
    body: 'Connect your bank in 60 seconds. See every account, every loan, every dollar — all in one place. The unknown is always scarier than the known.',
    icon: Eye,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    letter: 'R',
    name: 'Reduce',
    tagline: 'Fix the leaks',
    body: 'Your Guide finds the waste: forgotten subscriptions, impulse spending, debt that\'s costing you. Fix the leaks before you fill the bucket.',
    icon: Scissors,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
  {
    letter: 'A',
    name: 'Anchor',
    tagline: 'Build your safety net',
    body: 'Build an emergency fund so one unexpected bill doesn\'t send you backward. Three months of expenses. That\'s your anchor.',
    icon: Anchor,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    letter: 'I',
    name: 'Invest',
    tagline: 'Grow your wealth',
    body: 'Properties. Shares. Super. Assets. Track them all. Watch your net worth climb. Compound growth is how wealth is built.',
    icon: TrendingUp,
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
  },
  {
    letter: 'L',
    name: 'Live',
    tagline: 'On your terms',
    body: 'Your money works for you. Your Guide shifts from triage to optimisation. You make choices from abundance, not stress.',
    icon: Sun,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
  },
];

export function TrailJourney() {
  return (
    <section className="bg-stone-950 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal>
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-500 mb-4">
              The TRAIL Framework
            </p>
            <h2
              className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
              style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
            >
              Five steps. One trail.
              <br />
              Your financial freedom.
            </h2>
          </div>
        </Reveal>

        {/* TRAIL progress bar (desktop) */}
        <Reveal delay={0.2}>
          <div className="hidden md:flex items-center justify-center gap-1 mb-16">
            {stages.map((stage, i) => (
              <div key={stage.letter} className="flex items-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${stage.border} ${stage.bg}`}>
                  <span className={`text-sm font-bold ${stage.color}`}>
                    {stage.letter}
                  </span>
                </div>
                {i < stages.length - 1 && (
                  <div className="w-12 lg:w-20 h-0.5 bg-gradient-to-r from-stone-700 to-stone-700" />
                )}
              </div>
            ))}
          </div>
        </Reveal>

        {/* Stage cards */}
        <div className="space-y-6">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <Reveal key={stage.letter} delay={i * 0.1}>
                <div className={`relative rounded-2xl border ${stage.border} ${stage.bg} p-8 md:p-10`}>
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    {/* Icon + letter */}
                    <div className="flex items-center gap-4 md:w-48 shrink-0">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stage.bg} border ${stage.border}`}>
                        <Icon className={`h-6 w-6 ${stage.color}`} />
                      </div>
                      <div>
                        <span className={`text-xs font-bold uppercase tracking-widest ${stage.color}`}>
                          {stage.letter} — {stage.name}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">
                        {stage.tagline}
                      </h3>
                      <p className="text-stone-400" style={{ lineHeight: 1.7 }}>
                        {stage.body}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

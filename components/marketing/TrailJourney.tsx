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
    body: 'Bring properties, loans, super, investments and cashflow into one view. Manual entry and CSV import today; live bank connections in development. The first step is making the picture visible enough to manage.',
    icon: Eye,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    letter: 'R',
    name: 'Reduce',
    tagline: 'Stop the hidden leaks',
    body: 'Duplicate insurance. Lazy cash sitting next to non-deductible debt. Subscriptions you forgot. Loan settings that no longer match the plan. The small inefficiencies that compound when your financial life is spread too thin.',
    icon: Scissors,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
  {
    letter: 'A',
    name: 'Anchor',
    tagline: 'Confirm the safety net is real',
    body: 'Offset, redraw, cash reserve, equity — see your buffer against your actual loans, rental costs and household commitments. Not "do you have one"; whether it is the right size for your structure.',
    icon: Anchor,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    letter: 'I',
    name: 'Invest',
    tagline: 'Model the next move with context',
    body: 'Another property, switching debt, salary-sacrificing super, selling shares — each moves cashflow, tax position and liquidity together. See what changes across the whole picture before you decide.',
    icon: TrendingUp,
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
  },
  {
    letter: 'L',
    name: 'Live',
    tagline: 'Decide from the full picture',
    body: 'When the picture is clean, decisions get faster and quieter. Travel, sabbatical, helping family, scaling the business — fewer "can we afford this" moments, more "what does it change".',
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
              Five steps. One picture.
              <br />
              A cleaner way to run your wealth.
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

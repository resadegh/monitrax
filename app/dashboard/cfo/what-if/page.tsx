'use client';

/**
 * Phase 45 PR 2.A — "What If?" lever picker.
 *
 * Screen A from `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §6.3.
 * Canonical Stitch artefact: `.stitch/designs/what-if-lever-picker{,-dark,-mobile,-mobile-dark}.{html,png}`
 * (locked in PR #977, full 4-variant matrix per CLAUDE.md §18.7.2).
 *
 * Vocabulary: §18.7.2 My Wealth glass — warm-ivory ground in light mode,
 * deep-navy in dark; glass-card tiles with per-lever gradient top-accent
 * strips + watermark glyphs. Per-lever sub-palette per §6.2:
 *
 *   - Refinance loan        REDUCE · DEBT             amber → rose       Percent
 *   - Salary-sacrifice      INVEST · SUPER            emerald → indigo   PiggyBank
 *   - Sell property         LIVE · EXIT               violet → fuchsia   Home
 *   - Pay extra off debt    ANCHOR · DEBT FREEDOM     indigo → blue      TrendingDown
 *   - Buy investment        INVEST · PROPERTY         teal → cyan        Building2
 *
 * AFSL discipline (Q-HOOK-AFSL): bottom card surfaces the General Advice
 * Warning — "Monitrax shows what changes. It doesn't tell you what to
 * do." Never product names, never broker recommendations, always
 * frames as "information about your own numbers."
 *
 * PR 2.A scope: the picker page itself + lever-detail route stubs.
 * Lever-detail interactive flow (sliders + projection chart + GAW
 * footer) ships in PR 2.B.
 */

import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import {
  Percent,
  PiggyBank,
  Home,
  TrendingDown,
  Building2,
  Info,
  ArrowRight,
  Construction,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ScenarioType } from '@/lib/cfo/scenarios';

interface LeverDescriptor {
  id: ScenarioType;
  trailStage: string;          // e.g. "INVEST · SUPER"
  title: string;               // tile title
  description: string;         // muted subtitle
  Icon: LucideIcon;
  /**
   * Static Tailwind class strings — written out fully so Tailwind's JIT
   * scanner can detect them. NEVER interpolate gradient stops via template
   * literals (`${color}/20`) — the scanner won't resolve dynamic class names.
   */
  topStripClass: string;       // e.g. "bg-gradient-to-r from-amber-400 to-rose-400"
  iconBadgeClass: string;      // e.g. "bg-gradient-to-br from-amber-400/20 to-rose-400/20"
  iconColor: string;           // e.g. "text-amber-500 dark:text-amber-400"
  /** Where the lever-detail page lives. */
  href: string;
}

const LEVERS: LeverDescriptor[] = [
  {
    id: 'refinanceLoan',
    trailStage: 'REDUCE · DEBT',
    title: 'Refinance a loan',
    description:
      'Drop your rate. See your monthly repayment, lifetime interest, and 10-year net-worth shift.',
    Icon: Percent,
    topStripClass: 'bg-gradient-to-r from-amber-400 to-rose-400',
    iconBadgeClass: 'bg-gradient-to-br from-amber-400/20 to-rose-400/20',
    iconColor: 'text-amber-500 dark:text-amber-400',
    href: '/dashboard/cfo/what-if/refinanceLoan',
  },
  {
    id: 'salarySacrificeToSuper',
    trailStage: 'INVEST · SUPER',
    title: 'Salary-sacrifice to super',
    description:
      'Boost your retirement fund pre-tax. See the year-1 tax savings and compounded long-term impact.',
    Icon: PiggyBank,
    topStripClass: 'bg-gradient-to-r from-emerald-400 to-indigo-400',
    iconBadgeClass: 'bg-gradient-to-br from-emerald-400/20 to-indigo-400/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    href: '/dashboard/cfo/what-if/salarySacrificeToSuper',
  },
  {
    id: 'sellProperty',
    trailStage: 'LIVE · EXIT',
    title: 'Sell a property',
    description:
      'Model the capital gains, debt clearance, and liquidity release from divesting a real-estate asset.',
    Icon: Home,
    topStripClass: 'bg-gradient-to-r from-violet-400 to-fuchsia-400',
    iconBadgeClass: 'bg-gradient-to-br from-violet-400/20 to-fuchsia-400/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    href: '/dashboard/cfo/what-if/sellProperty',
  },
  {
    id: 'payDownLoan',
    trailStage: 'ANCHOR · DEBT FREEDOM',
    title: 'Pay extra off a debt',
    description:
      'Accelerate your payoff date. Calculate interest saved and exact timeline compression.',
    Icon: TrendingDown,
    topStripClass: 'bg-gradient-to-r from-indigo-400 to-blue-400',
    iconBadgeClass: 'bg-gradient-to-br from-indigo-400/20 to-blue-400/20',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    href: '/dashboard/cfo/what-if/payDownLoan',
  },
  {
    id: 'addInvestment',
    trailStage: 'INVEST · PROPERTY',
    title: 'Buy an investment property',
    description:
      'Model deposit requirements, rental yield, holding costs, and long-term capital growth potential.',
    Icon: Building2,
    topStripClass: 'bg-gradient-to-r from-teal-400 to-cyan-400',
    iconBadgeClass: 'bg-gradient-to-br from-teal-400/20 to-cyan-400/20',
    iconColor: 'text-teal-600 dark:text-teal-400',
    href: '/dashboard/cfo/what-if/addInvestment',
  },
];

function LeverTile({ lever }: { lever: LeverDescriptor }) {
  const { trailStage, title, description, Icon, topStripClass, iconBadgeClass, iconColor, href } = lever;

  return (
    <Link
      href={href}
      className="group relative flex min-h-[180px] flex-col overflow-hidden rounded-[20px] border border-foreground/10 bg-card/70 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_40px_rgba(15,23,42,0.10)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.04)] dark:hover:shadow-[0_2px_4px_rgba(0,0,0,0.40),0_0_0_1px_rgba(255,255,255,0.08)]"
    >
      {/* Top accent strip — per-lever gradient */}
      <div
        className={`absolute left-0 right-0 top-0 h-[3px] ${topStripClass} transition-all duration-300 group-hover:shadow-[0_0_12px_4px_rgba(255,255,255,0.15)]`}
      />

      {/* Icon badge + arrow */}
      <div className="mb-auto flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl border border-foreground/10 ${iconBadgeClass} relative z-10`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={2} />
        </div>
        <ArrowRight
          className="h-5 w-5 text-foreground/40 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-foreground/80"
          strokeWidth={2}
        />
      </div>

      {/* Label + title */}
      <div className="relative z-10 mt-8">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-foreground/60">
          {trailStage}
        </p>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Watermark glyph — bleeds off the right edge */}
      <Icon
        className={`pointer-events-none absolute -bottom-4 -right-4 h-32 w-32 ${iconColor} opacity-[0.06] transition-opacity duration-300 group-hover:opacity-[0.10]`}
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </Link>
  );
}

function EmptyStateTile() {
  return (
    <div className="relative flex min-h-[180px] flex-col items-center justify-center overflow-hidden rounded-[20px] border-2 border-dashed border-foreground/15 bg-card/30 p-6 text-center backdrop-blur-xl">
      <Construction className="mb-3 h-6 w-6 text-foreground/40" strokeWidth={1.5} />
      <p className="text-sm text-muted-foreground">
        More levers coming — we&apos;re working on it.
      </p>
    </div>
  );
}

function GeneralAdviceWarning() {
  return (
    <div className="rounded-[20px] border border-foreground/10 bg-card/70 p-6 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/5">
          <Info className="h-4 w-4 text-foreground/60" strokeWidth={2} />
        </div>
        <div className="flex-1">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-foreground/60">
            Why no recommendations
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">
            Monitrax shows what changes. It doesn&apos;t tell you what to do. Every lever
            here is information about your own numbers — never personal advice. For
            decisions about your money, talk to a licensed financial adviser. Read the{' '}
            <Link
              href="/legal/general-advice-warning"
              className="text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              General Advice Warning
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WhatIfLeverPickerPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          My Guide · Decision support
        </p>
        <PageHeader
          title="What if?"
          description="See how a single move would change your 10-year picture. Pick one lever — Monitrax shows what changes, never what you should do."
        />

        {/* Lever grid */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {LEVERS.map((lever) => (
            <LeverTile key={lever.id} lever={lever} />
          ))}
          <EmptyStateTile />
        </div>

        {/* General Advice Warning */}
        <div className="mt-8">
          <GeneralAdviceWarning />
        </div>
      </div>
    </DashboardLayout>
  );
}

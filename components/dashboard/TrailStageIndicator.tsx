'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Scissors,
  Anchor,
  TrendingUp,
  Sun,
  ArrowRight,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';

interface TrailData {
  emergencyFund?: { monthsCovered: number };
  cashflow?: { monthlySurplus: number };
  hasAccounts: boolean;
  hasInvestments: boolean;
  healthScore: number;
}

interface Stage {
  letter: 'T' | 'R' | 'A' | 'I' | 'L';
  name: string;
  tagline: string;
  headline: string;
  description: string;
  question: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  bgLight: string;
  ring: string;
  href: string;
}

// Stage copy is sourced from docs/blueprint/TRAIL_FRAMEWORK.md §2.
// Keep `description` and `question` short enough to fit in the
// banner without resizing the home dashboard above the fold.
const stages: Stage[] = [
  {
    letter: 'T',
    name: 'Track',
    tagline: 'See your full picture',
    headline: 'Track your full picture',
    description:
      'Face your full financial reality — no judgment, just clarity. See every account, every debt, every dollar in and out. End the avoidance.',
    question: 'What do I actually have, owe, earn, and spend?',
    icon: Eye,
    color: 'text-amber-600',
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-500/10',
    ring: 'ring-amber-500',
    // Phase 36: My Accounts sidebar item points at /dashboard/balances.
    // The legacy /dashboard/accounts page is being retired.
    href: '/dashboard/balances',
  },
  {
    letter: 'R',
    name: 'Reduce',
    tagline: 'Fix the leaks',
    headline: 'Reduce the waste, fix the leaks',
    description:
      'Cut wasteful spending, get cashflow positive, set a budget, and start paying down debt. Stop the leaks before you fill the bucket.',
    question: 'Am I spending less than I earn? Where can I cut waste?',
    icon: Scissors,
    color: 'text-orange-600',
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-500/10',
    ring: 'ring-orange-500',
    href: '/dashboard/budget-analysis',
  },
  {
    letter: 'A',
    name: 'Anchor',
    tagline: 'Build your safety net',
    headline: 'Anchor your safety net',
    description:
      'Build an emergency fund that covers three months of expenses. Anchor yourself so one unexpected bill doesn’t send you backward.',
    question: 'Can I handle a financial shock without going into debt?',
    icon: Anchor,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500',
    bgLight: 'bg-emerald-500/10',
    ring: 'ring-emerald-500',
    href: '/dashboard/safety-net',
  },
  {
    letter: 'I',
    name: 'Invest',
    tagline: 'Grow your wealth',
    headline: 'Invest in your future',
    description:
      'Now that you’re stable, start accumulating. Buy property, invest in shares and super, build assets, and grow your net worth deliberately.',
    question: 'Is my net worth growing? Am I building something that lasts?',
    icon: TrendingUp,
    color: 'text-sky-600',
    bg: 'bg-sky-500',
    bgLight: 'bg-sky-500/10',
    ring: 'ring-sky-500',
    href: '/dashboard/properties',
  },
  {
    letter: 'L',
    name: 'Live',
    tagline: 'On your terms',
    headline: 'Live on your terms',
    description:
      'Your wealth works for you. Passive income approaches or exceeds expenses. You make decisions from abundance, not scarcity.',
    question: 'Can I live the life I want without financial worry?',
    icon: Sun,
    color: 'text-yellow-600',
    bg: 'bg-yellow-500',
    bgLight: 'bg-yellow-500/10',
    ring: 'ring-yellow-500',
    href: '/dashboard/cfo',
  },
];

function determineStage(data: TrailData | null): number {
  if (!data) return 0;
  if (!data.hasAccounts) return 0;
  if (data.cashflow && data.cashflow.monthlySurplus <= 0) return 1;
  if (!data.emergencyFund || data.emergencyFund.monthsCovered < 3) return 2;
  if (!data.hasInvestments) return 3;
  if (data.healthScore < 75) return 3;
  return 4;
}

export function TrailStageIndicator() {
  const { token } = useAuth();
  const router = useRouter();
  const [trailData, setTrailData] = useState<TrailData | null>(null);
  // `selected` = which stage is currently in the spotlight. Starts as
  // null so we render the user's actual stage; once they interact
  // (hover/click) we override.
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/master-snapshot', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success || json.data || json.netWorth !== undefined) {
          const d = json.data || json;
          setTrailData({
            hasAccounts: (d.accounts?.length || 0) > 0 || (d.netWorth?.totalAssets || 0) > 0,
            hasInvestments: (d.investments?.totalValue || 0) > 0 || (d.properties?.length || 0) > 0,
            emergencyFund: d.emergencyFund,
            cashflow: d.cashflow ? { monthlySurplus: d.cashflow.netMonthlyCashflow || d.cashflow.monthlySurplus || 0 } : undefined,
            healthScore: d.healthScore?.score || d.health?.score || 0,
          });
        }
      })
      .catch(() => {});
  }, [token]);

  const userStage = useMemo(() => determineStage(trailData), [trailData]);

  // Spotlight = hover wins, then explicit selection, then user's actual stage.
  const spotlightIndex = hovered ?? selected ?? userStage;
  const spotlight = stages[spotlightIndex];

  // Second click on the same selected letter navigates. First click
  // just selects (so the user can read the description).
  function handleStageClick(index: number) {
    if (selected === index) {
      router.push(stages[index].href);
      return;
    }
    setSelected(index);
  }

  function handleCtaClick() {
    router.push(spotlight.href);
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Your TRAIL
        </h3>
        <button
          type="button"
          onClick={handleCtaClick}
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          aria-label={`Go to ${spotlight.name} page`}
        >
          Go to {spotlight.name} <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Interactive stage row. Hover = preview, click = select, second
          click on the same letter = navigate. Default selection mirrors
          the user's actual TRAIL stage. */}
      <div
        className="flex items-center gap-1 sm:gap-2 mb-5 overflow-x-auto"
        role="tablist"
        aria-label="TRAIL stages"
      >
        {stages.map((stage, i) => {
          const isCompleted = i < userStage;
          const isCurrent = i === userStage;
          const isSpotlit = i === spotlightIndex;
          const isSelected = selected === i;

          return (
            <div key={stage.letter} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                role="tab"
                aria-selected={isSpotlit}
                aria-label={`Stage ${stage.letter} — ${stage.name}. ${stage.tagline}.`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                onClick={() => handleStageClick(i)}
                className={`relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full text-base sm:text-lg font-bold transition-all duration-200 ${
                  isSpotlit
                    ? `${stage.bg} text-white scale-110 shadow-lg ring-4 ring-offset-2 ring-offset-card ${stage.ring}`
                    : isCompleted
                    ? `${stage.bg} text-white opacity-80 hover:opacity-100`
                    : isCurrent
                    ? `${stage.bg} text-white ring-2 ring-offset-2 ring-offset-card ${stage.ring}`
                    : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                }`}
              >
                {isCompleted && !isSpotlit ? (
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  stage.letter
                )}
                {isSelected && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary"
                    aria-hidden
                  />
                )}
              </button>
              {i < stages.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 sm:mx-1.5 transition-colors ${
                    i < userStage ? stage.bg : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Spotlight panel — shows the description of whichever letter is
          hovered or selected. Defaults to the user's current stage. */}
      <div
        className={`rounded-xl ${spotlight.bgLight} p-4 sm:p-5 transition-colors`}
        role="tabpanel"
        aria-live="polite"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-card shadow-sm`}>
            <spotlight.icon className={`h-6 w-6 ${spotlight.color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-bold uppercase tracking-widest ${spotlight.color}`}>
              Stage {spotlight.letter} — {spotlight.name}
              {spotlightIndex === userStage && (
                <span className="ml-2 inline-flex items-center rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-foreground/70">
                  You are here
                </span>
              )}
            </p>
            <p className="mt-1 text-base font-semibold text-foreground leading-snug">
              {spotlight.headline}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              {spotlight.description}
            </p>
            <p className="mt-2 text-xs italic text-muted-foreground/80">
              {spotlight.question}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground/80">
          <span className="hidden sm:inline">
            {selected === spotlightIndex
              ? 'Click again to open this stage →'
              : 'Hover to preview · click to focus · click again to open'}
          </span>
          <button
            type="button"
            onClick={handleCtaClick}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 ${spotlight.bg}`}
          >
            Open {spotlight.name} <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

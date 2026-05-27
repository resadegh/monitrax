'use client';

/**
 * EditorialMoneyStoryHero — the Restrained Editorial dashboard's headline
 * card. Three lines stacked top-to-bottom — Earned · Kept · Free today —
 * each with an eyebrow + data-xl number + slate-500 sub line.
 *
 * Replaces `MoneyStoryHero` (the Phase-43 glass / cosmos variant) on the
 * dashboard's new editorial composition. Both components currently coexist
 * — the dashboard's first restyle PR swaps the consumer to this one and
 * we keep the cosmos variant for any other surface still using it.
 *
 * Stitch reference: screens `81e67b3e78934fd1aad6a8e81ab2cb2a` (seed) +
 * `f723372ebbd83b197770129eff849a2` (in context). Design source of truth
 * in `docs/design/MONITRAX_STITCH_DESIGN_SYSTEM.md`.
 *
 * Design specs (locked):
 *   - White card, 16px radius, 1.5px outline-variant, navy-tinted shadow.
 *     Generous 32px internal padding (not 24px — this is the hero).
 *   - Three rows; each row has a 12px eyebrow, a data-xl (40px / 600) navy
 *     number, and a body-sm slate-500 helper sub line.
 *   - The headline row that matches the user's TRAIL stage (T → Earned,
 *     R → Kept, A → Free today, I/L → Free today) gets a 3px emerald
 *     accent bar on the left edge of its row — restrained emphasis, never
 *     a full background colour.
 *   - No icons. No gradients. No motion. Sparkline at the bottom is
 *     optional, emerald 1.5px stroke, area fill 8%, no axes.
 *
 * SSOT contract: identical to `MoneyStoryHero` — all values supplied by
 * the snapshot. This component is presentational only and computes nothing
 * (CLAUDE.md §6.4 + §12.3).
 */

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import type { ReactNode } from 'react';
import type { TrailStage } from '@/lib/cfo/trailStage';
import { EditorialCard } from './EditorialCard';
import { Eyebrow } from './Eyebrow';
import { DataValue } from './DataValue';

export interface EditorialMoneyStoryHeroProps {
  earned: number;
  kept: number;
  keptMargin: number;
  freeToday: number;
  freeDays: number;
  enoughHistory: boolean;
  trailStage?: TrailStage;
  /**
   * Optional inline sparkline at the bottom of the card. Render emerald
   * 1.5px stroke, 8% area fill, no axes. The hero supplies the slot; the
   * caller renders the chart.
   */
  sparkline?: ReactNode;
}

type LineKey = 'earned' | 'kept' | 'free';

const STAGE_HEADLINE_LINE: Record<TrailStage, LineKey> = {
  T: 'earned',
  R: 'kept',
  A: 'free',
  I: 'free',
  L: 'free',
};

const STAGE_DRILL: Record<TrailStage, { to: string; label: string }> = {
  T: { to: '/dashboard/balances', label: 'See your full picture' },
  R: { to: '/dashboard/budget-analysis', label: 'See where it goes' },
  A: { to: '/dashboard/safety-net', label: 'See your runway' },
  I: { to: '/dashboard/cfo', label: 'See your next move' },
  L: { to: '/dashboard/cfo', label: 'See your story' },
};

function Row({
  eyebrow,
  value,
  sub,
  emphasized,
}: {
  eyebrow: string;
  value: string;
  sub: ReactNode;
  emphasized: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 py-3 pl-4 pr-2 md:flex-row md:items-baseline md:justify-between md:gap-6',
        emphasized && 'border-l-[3px] border-editorial-emerald'
      )}
    >
      <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-4">
        <Eyebrow className="md:w-32 md:shrink-0">{eyebrow}</Eyebrow>
        <DataValue size="xl" className="leading-none">
          {value}
        </DataValue>
      </div>
      <p className="text-sm leading-relaxed text-editorial-slate md:max-w-xs md:text-right">
        {sub}
      </p>
    </div>
  );
}

export function EditorialMoneyStoryHero({
  earned,
  kept,
  keptMargin,
  freeToday,
  freeDays,
  enoughHistory,
  trailStage = 'T',
  sparkline,
}: EditorialMoneyStoryHeroProps) {
  const headlineLine = STAGE_HEADLINE_LINE[trailStage];
  const drill = STAGE_DRILL[trailStage];

  const earnedFmt = formatCurrency(earned, { showCents: false });
  const keptFmt = formatCurrency(kept, { showCents: false });
  const freeFmt = formatCurrency(freeToday, { showCents: false });

  const keptSub =
    earned > 0
      ? `${Math.round(keptMargin)}% kept margin · ${Math.round(keptMargin) >= 24 ? 'above AU avg' : 'AU avg is ~24%'}`
      : 'Add income to unlock margin';

  const freeSub = enoughHistory
    ? `${Math.round(freeDays)} days of life at current burn`
    : 'Truly liquid cash today';

  return (
    <Link
      href={drill.to}
      aria-label={`Your money story — ${drill.label}`}
      className="group block outline-none focus-visible:ring-2 focus-visible:ring-editorial-emerald/40 focus-visible:ring-offset-2"
    >
      <EditorialCard
        hover
        className="!p-8 md:!p-10"
        aria-label="Your money story for the last 30 days"
      >
        {/* Header eyebrow + drill-down hint */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Eyebrow>Your money story · last 30 days</Eyebrow>
            <p className="text-sm text-editorial-slate">
              Earned · Kept · Free today
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-editorial-slate transition-colors group-hover:text-editorial-ink">
            <span className="hidden sm:inline">{drill.label}</span>
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          </span>
        </div>

        {/* The three lines */}
        <div className="mt-6 divide-y divide-editorial-divider/60">
          <Row
            eyebrow="EARNED · LAST MONTH"
            value={earnedFmt}
            sub="Before tax — what your work paid out"
            emphasized={headlineLine === 'earned'}
          />
          <Row
            eyebrow="KEPT · LAST MONTH"
            value={keptFmt}
            sub={keptSub}
            emphasized={headlineLine === 'kept'}
          />
          <Row
            eyebrow="FREE TODAY"
            value={freeFmt}
            sub={freeSub}
            emphasized={headlineLine === 'free'}
          />
        </div>

        {sparkline && (
          <div className="mt-6 -mb-1" aria-hidden>
            {sparkline}
          </div>
        )}
      </EditorialCard>
    </Link>
  );
}

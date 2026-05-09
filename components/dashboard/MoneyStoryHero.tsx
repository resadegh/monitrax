'use client';

/**
 * MoneyStoryHero — Phase 43 (the Personal P&L scoreboard).
 *
 * THREE LINES, IN HIERARCHY:
 *   1. Earned     — gross monthly income (pre-tax). The "vanity" line.
 *   2. Kept       — net income minus essential expenses. The "sanity" line.
 *   3. Free today — truly liquid cash, expressed in days of life. The
 *                   "reality" line.
 *
 * Inspired by Jason Andrew's "Stark Naked Numbers" hierarchy
 * (Revenue is vanity, Profit is sanity, Cash is reality), translated
 * into TRAIL T → R → A and Monitrax warm-language doctrine. The book's
 * brutality is left at the door — the math is sharp, the copy is kind.
 *
 * SSOT contract:
 *   - All five values come from `snapshot.quickMetrics` (added in
 *     Phase 43). This component computes nothing. If you need the same
 *     numbers elsewhere, read them from the snapshot — never recompute.
 *
 * Design contract:
 *   - Composes <GlassHero> + <GlassHeroEyebrow> + <GlassHeroKpiCell>
 *     from `components/shell/`. Reviewers MUST reject any local
 *     re-implementation of `appleEase` / rounded-28px glass / the
 *     mesh atmosphere (CLAUDE.md §16, 06_UI_UX_FOUNDATION.md §15.10).
 *   - Stage emphasis (T / R / A) rotates which line gets the prominent
 *     headline; all three lines always render. Guided, not gated
 *     (CLAUDE.md §14.3).
 *
 * @see docs/blueprint/PHASE_43_MONEY_STORY.md
 * @see docs/blueprint/TRAIL_FRAMEWORK.md §6 (3-line scoreboard pattern)
 */

import { formatCurrency } from '@/lib/utils/formatters';
import {
  GlassHero,
  GlassHeroEyebrow,
  GlassHeroHeadline,
  GlassHeroKpiCell,
  type GlassHeroAtmosphere,
} from '@/components/shell';
import type { TrailStage } from '@/lib/cfo/trailStage';

export interface MoneyStoryHeroProps {
  /** Monthly gross income (pre-tax). The "Earned" line. */
  earned: number;
  /** monthlyNetIncome − essential expenses. The "Kept" line. */
  kept: number;
  /** kept ÷ earned × 100 (%). 0 when no income. */
  keptMargin: number;
  /** Liquid cash today. The "Free today" line. */
  freeToday: number;
  /** freeToday ÷ daily expense burn. 0 when expenses are 0. */
  freeDays: number;
  /**
   * False when the user has no recorded expenses — gates the
   * per-day display so we never show a misleading "0 days of life".
   */
  enoughHistory: boolean;
  /**
   * The user's current TRAIL stage. Drives which line gets the
   * prominent headline + the secondary copy. Optional; defaults to 'T'.
   */
  trailStage?: TrailStage;
}

/**
 * Stage-specific framing. Emphasis rotates with TRAIL position; the
 * three lines themselves never change. Copy follows the warm-words
 * rule (CLAUDE.md §14.3) — normalising, never shaming.
 */
const STAGE_FRAMING: Record<
  'T' | 'R' | 'A' | 'I' | 'L',
  {
    atmosphere: GlassHeroAtmosphere;
    headlineLine: 'earned' | 'kept' | 'free';
    secondary: (kept: number, keptMargin: number, freeDays: number) => string;
  }
> = {
  T: {
    atmosphere: 'amber',
    headlineLine: 'earned',
    secondary: () =>
      'Most people never see this number written down. You now do.',
  },
  R: {
    atmosphere: 'sky',
    headlineLine: 'kept',
    secondary: (_kept, keptMargin) => {
      // 24% is the AU household-savings-rate median (RBA, ABS national accounts proxy).
      // Framing is comparative-not-judgemental per behavioural-psychology lens.
      if (keptMargin <= 0) {
        return "Right now more's going out than coming in. That's a fixable signal, not a verdict.";
      }
      if (keptMargin >= 24) {
        return `${Math.round(keptMargin)}% kept — above the AU household average. Quietly excellent.`;
      }
      return `${Math.round(keptMargin)}% kept this month. The AU household average is around 24%.`;
    },
  },
  A: {
    atmosphere: 'emerald',
    headlineLine: 'free',
    secondary: (_kept, _keptMargin, freeDays) => {
      const days = Math.round(freeDays);
      if (days <= 0) return 'Building runway is the next step on the TRAIL.';
      if (days < 30)
        return `${days} days of runway — every week added is the safety net widening.`;
      if (days < 90)
        return `${days} days of runway. The 90-day target is in reach.`;
      return `${days} days of runway. Your safety net is doing its job.`;
    },
  },
  I: {
    atmosphere: 'violet',
    headlineLine: 'free',
    secondary: (_kept, _keptMargin, freeDays) =>
      freeDays >= 90
        ? "Your foundation's solid — what's next is making the surplus work."
        : 'Foundation first. Investing on top of a thin runway is fragile.',
  },
  L: {
    atmosphere: 'emerald',
    headlineLine: 'free',
    secondary: () =>
      'The whole story working as designed. This is what TRAIL stage 5 reads like.',
  },
};

export function MoneyStoryHero({
  earned,
  kept,
  keptMargin,
  freeToday,
  freeDays,
  enoughHistory,
  trailStage = 'T',
}: MoneyStoryHeroProps) {
  const framing = STAGE_FRAMING[trailStage];
  const secondary = framing.secondary(kept, keptMargin, freeDays);
  const earnedDisplay = formatCurrency(earned, { showCents: false });
  const keptDisplay = formatCurrency(kept, { showCents: false });
  const freeDisplay = formatCurrency(freeToday, { showCents: false });
  const keptMarginDisplay =
    earned > 0 ? `${Math.round(keptMargin)}% of what you earn` : '—';
  const freeDaysDisplay = enoughHistory
    ? `${Math.round(freeDays)} days of life`
    : 'Truly liquid right now';

  // Headline data (the prominent gradient line) is selected by stage.
  // The other two lines render as KPI cells below. Same component, same
  // data, only the visual hierarchy rotates with the user's stage.
  const headline =
    framing.headlineLine === 'earned'
      ? { label: 'Earned · last month', value: earnedDisplay, sub: 'Before tax — what your work paid out' }
      : framing.headlineLine === 'kept'
        ? { label: 'Kept · last month', value: keptDisplay, sub: keptMarginDisplay }
        : { label: 'Free today', value: freeDisplay, sub: freeDaysDisplay };

  const cell1 =
    framing.headlineLine === 'earned'
      ? { label: 'Kept', value: keptDisplay, sub: keptMarginDisplay, tone: 'neutral' as const }
      : { label: 'Earned', value: earnedDisplay, sub: 'Monthly · before tax', tone: 'neutral' as const };

  const cell2 =
    framing.headlineLine === 'free'
      ? { label: 'Kept', value: keptDisplay, sub: keptMarginDisplay, tone: 'neutral' as const }
      : { label: 'Free today', value: freeDisplay, sub: freeDaysDisplay, tone: 'neutral' as const };

  const gradientByStage: Record<'T' | 'R' | 'A' | 'I' | 'L', string> = {
    T: 'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700',
    R: 'bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700',
    A: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700',
    I: 'bg-gradient-to-br from-violet-500 via-violet-600 to-indigo-700',
    L: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-cyan-700',
  };

  return (
    <GlassHero atmosphere={framing.atmosphere}>
      <GlassHeroEyebrow label="Your money story · last 30 days" />

      <GlassHeroHeadline
        label={headline.label}
        value={headline.value}
        gradientClassName={gradientByStage[trailStage]}
        ariaLabel={`${headline.label} ${headline.value}`}
      />

      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        {secondary}
      </p>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <GlassHeroKpiCell
          label={cell1.label}
          value={cell1.value}
          sub={cell1.sub}
          tone={cell1.tone}
        />
        <GlassHeroKpiCell
          label={cell2.label}
          value={cell2.value}
          sub={cell2.sub}
          tone={cell2.tone}
        />
      </dl>
    </GlassHero>
  );
}

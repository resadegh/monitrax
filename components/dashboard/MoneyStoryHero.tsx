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
 * VISUALISATION — the Money Story Bar (Phase 43):
 *   A 3-segment proportional bar under the headline that splits Earned
 *   into Tax / Spent / Saved. Behavioural-psychology lens: when stress
 *   depletes System 2 cognition (Mani et al. 2013), visuals engage
 *   System 1 — concrete and intuitive when numbers feel abstract. Loss
 *   aversion is handled by neutral slate (never red) for "Spent";
 *   emerald victory tone is reserved for "Saved" (Bandura
 *   self-efficacy — visible progress reinforces capability).
 *
 * SSOT contract:
 *   - All values come from `snapshot.quickMetrics` + `cashflow`
 *     (added in Phase 43). This component computes nothing.
 *   - Stage colours match `TRAIL_STAGE_TONES` (T=sky, R=amber,
 *     A=indigo, I=emerald, L=violet). Source of truth:
 *     `lib/navigation/trailNav.tsx`.
 *
 * Design contract:
 *   - Composes `<GlassHero>` + `<GlassHeroEyebrow>` + `<GlassHeroHeadline>`
 *     + `<GlassHeroKpiCell>` from `components/shell/`. Reviewers MUST
 *     reject any local re-implementation of `appleEase` / rounded-28px
 *     glass / mesh atmosphere (CLAUDE.md §16, 06_UI_UX_FOUNDATION.md
 *     §15.10).
 *   - Hero is wrapped in a `<Link>` per design principle 3.2
 *     ("Everything is a Drill-Down"). Tap target → stage-appropriate
 *     detail page.
 *   - Stage emphasis (T / R / A / I / L) rotates which line gets the
 *     prominent headline; all three lines always render (guided, not
 *     gated, CLAUDE.md §14.3).
 *
 * @see docs/blueprint/PHASE_43_MONEY_STORY.md
 * @see docs/blueprint/TRAIL_FRAMEWORK.md §5 (3-line scoreboard pattern)
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import {
  GlassHero,
  GlassHeroEyebrow,
  GlassHeroHeadline,
  GlassHeroKpiCell,
  appleEase,
  useReducedMotionSafe,
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
  /** Monthly PAYG-equivalent — first segment of the Money Story Bar. */
  taxWithheld: number;
  /** True monthly surplus (= monthlyCashflow) — third segment of the bar. */
  surplus: number;
  /**
   * False when the user has no recorded expenses — gates the
   * per-day display so we never show a misleading "0 days of life".
   */
  enoughHistory: boolean;
  /**
   * The user's current TRAIL stage. Drives which line gets the
   * prominent headline + the secondary copy + the drill-down target.
   * Optional; defaults to 'T'.
   */
  trailStage?: TrailStage;
}

/**
 * Stage framing — atmosphere, gradient, headline target, drill-down,
 * secondary copy. Atmosphere + gradient come from the canonical
 * TRAIL_STAGE_TONES in `lib/navigation/trailNav.tsx`. Drill-down
 * destinations follow design-principle 3.2 (everything is a
 * drill-down) and pick the most relevant detail page per stage.
 */
const STAGE_FRAMING: Record<
  TrailStage,
  {
    atmosphere: GlassHeroAtmosphere;
    headlineLine: 'earned' | 'kept' | 'free';
    headlineGradient: string;
    drillTo: string;
    drillLabel: string;
    secondary: (kept: number, keptMargin: number, freeDays: number) => string;
  }
> = {
  T: {
    atmosphere: 'sky',
    headlineLine: 'earned',
    headlineGradient: 'bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700',
    drillTo: '/dashboard/balances',
    drillLabel: 'See your full picture',
    secondary: () =>
      'Most people never see this number written down. You now do.',
  },
  R: {
    atmosphere: 'amber',
    headlineLine: 'kept',
    headlineGradient:
      'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700',
    drillTo: '/dashboard/budget-analysis',
    drillLabel: 'See where it goes',
    secondary: (_kept, keptMargin) => {
      // 24% is the AU household-savings-rate median (RBA / ABS national-
      // accounts proxy). Comparative-not-judgemental per the
      // behavioural-psychology lens.
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
    atmosphere: 'indigo',
    headlineLine: 'free',
    headlineGradient:
      'bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700',
    drillTo: '/dashboard/safety-net',
    drillLabel: 'See your runway',
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
    atmosphere: 'emerald',
    headlineLine: 'free',
    headlineGradient:
      'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700',
    drillTo: '/dashboard/cfo',
    drillLabel: 'See your next move',
    secondary: (_kept, _keptMargin, freeDays) =>
      freeDays >= 90
        ? "Your foundation's solid — what's next is making the surplus work."
        : 'Foundation first. Investing on top of a thin runway is fragile.',
  },
  L: {
    atmosphere: 'violet',
    headlineLine: 'free',
    headlineGradient:
      'bg-gradient-to-br from-violet-500 via-violet-600 to-fuchsia-700',
    drillTo: '/dashboard/cfo',
    drillLabel: 'See your story',
    secondary: () =>
      'The whole story working as designed. This is what TRAIL stage 5 reads like.',
  },
};

/**
 * MoneyStoryBar — 3-segment proportional visualisation of Earned.
 *
 * Segments: Tax (slate) · Spent (warm-grey) · Saved (emerald).
 *
 * Design principles:
 *   - Loss aversion: never use red for "Spent". Slate + warm-grey.
 *     Emerald is reserved as a victory tone for "Saved" — Bandura
 *     self-efficacy (visible progress reinforces capability).
 *   - Cognitive ease: a single bar with three labels. No legend, no
 *     axis. The proportions ARE the legend.
 *   - Concreteness: the bar gives the abstract "31% kept" a visible
 *     spatial form — System 1 cognition when System 2 is depleted
 *     (Mani et al. 2013).
 *   - Reduced-motion-safe: the segment-fill animation is suppressed
 *     under `prefers-reduced-motion`.
 *   - Edge cases: when `earned` is 0, the bar self-hides (rendering
 *     a fully-grey bar would be misinformation).
 */
function MoneyStoryBar({
  earned,
  taxWithheld,
  surplus,
}: {
  earned: number;
  taxWithheld: number;
  surplus: number;
}) {
  const reduced = useReducedMotionSafe();

  if (earned <= 0) return null;

  // Clamp segments to non-negative + ≤1 sums. When surplus is negative
  // (cashflow deficit), the user spent more than they kept — the bar
  // shows it as "all spent, nothing saved" without alarm colours.
  const safeTax = Math.max(0, Math.min(taxWithheld, earned));
  const safeSurplus = Math.max(0, surplus);
  const taxPct = (safeTax / earned) * 100;
  const surplusPct = Math.min((safeSurplus / earned) * 100, 100 - taxPct);
  const spentPct = Math.max(0, 100 - taxPct - surplusPct);

  // Single source of truth for segment styling. Order follows the
  // story arc (taxes leave first, then living, then what's saved).
  const segments = [
    {
      key: 'tax',
      label: 'Tax',
      pct: taxPct,
      barCls: 'bg-slate-400/85 dark:bg-slate-500/80',
      dotCls: 'bg-slate-400 dark:bg-slate-500',
    },
    {
      key: 'spent',
      label: 'Spent',
      pct: spentPct,
      barCls: 'bg-slate-300/90 dark:bg-slate-600/70',
      dotCls: 'bg-slate-300 dark:bg-slate-600',
    },
    {
      key: 'saved',
      label: 'Saved',
      pct: surplusPct,
      barCls: 'bg-emerald-500/85 dark:bg-emerald-400/80',
      dotCls: 'bg-emerald-500 dark:bg-emerald-400',
    },
  ];

  return (
    <div className="mt-7" aria-label="Money story breakdown">
      {/* The bar itself — three flex segments with proportional widths. */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-foreground/[0.06] ring-1 ring-foreground/[0.04]">
        {segments.map((s, i) => (
          <motion.div
            key={s.key}
            className={s.barCls}
            style={{ flexBasis: `${s.pct}%`, transformOrigin: 'left' }}
            initial={reduced ? { opacity: 1 } : { opacity: 0, scaleX: 0.4 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.7, ease: appleEase, delay: 0.15 + i * 0.08 }
            }
            aria-label={`${s.label} ${Math.round(s.pct)}%`}
          />
        ))}
      </div>

      {/* Legend row — typography rather than colour swatches. The
          colours of the labels echo the bar segments at low saturation
          to keep the reading-order quiet. */}
      <dl className="mt-3 flex items-baseline justify-between gap-4 text-[11px] tabular-nums">
        {segments.map((s) => (
          <div key={s.key} className="flex items-baseline gap-1.5">
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 rounded-full ${s.dotCls}`}
            />
            <dt className="font-medium uppercase tracking-wider text-muted-foreground">
              {s.label}
            </dt>
            <dd className="font-semibold text-foreground/80">
              {Math.round(s.pct)}%
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function MoneyStoryHero({
  earned,
  kept,
  keptMargin,
  freeToday,
  freeDays,
  taxWithheld,
  surplus,
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
      ? {
          label: 'Earned · last month',
          value: earnedDisplay,
          sub: 'Before tax — what your work paid out',
        }
      : framing.headlineLine === 'kept'
        ? { label: 'Kept · last month', value: keptDisplay, sub: keptMarginDisplay }
        : { label: 'Free today', value: freeDisplay, sub: freeDaysDisplay };

  const cell1 =
    framing.headlineLine === 'earned'
      ? { label: 'Kept', value: keptDisplay, sub: keptMarginDisplay }
      : { label: 'Earned', value: earnedDisplay, sub: 'Monthly · before tax' };

  const cell2 =
    framing.headlineLine === 'free'
      ? { label: 'Kept', value: keptDisplay, sub: keptMarginDisplay }
      : { label: 'Free today', value: freeDisplay, sub: freeDaysDisplay };

  return (
    <Link
      href={framing.drillTo}
      aria-label={`Your money story — ${framing.drillLabel}`}
      className="block rounded-[28px] outline-none transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
    >
      <GlassHero atmosphere={framing.atmosphere}>
        <GlassHeroEyebrow
          label="Your money story · last 30 days"
          badge={
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <span className="hidden sm:inline">{framing.drillLabel}</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          }
        />

        <GlassHeroHeadline
          label={headline.label}
          value={headline.value}
          gradientClassName={framing.headlineGradient}
          ariaLabel={`${headline.label} ${headline.value}`}
        />

        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          {secondary}
        </p>

        {/* Money Story Bar — the visualisation. Hides itself when
            earned is 0 (avoids a fully-grey misinformation bar). */}
        <MoneyStoryBar
          earned={earned}
          taxWithheld={taxWithheld}
          surplus={surplus}
        />

        {/* Two secondary KPI cells. Same numbers as the segments
            above (no duplicate-numbers violation, design principle 3.5)
            because the bar shows PROPORTIONS and the cells show the
            absolute dollar values that aren't already in the headline. */}
        <dl className="mt-7 grid grid-cols-1 gap-4 border-t border-foreground/5 pt-6 sm:grid-cols-2 sm:gap-6">
          <GlassHeroKpiCell
            label={cell1.label}
            value={cell1.value}
            sub={cell1.sub}
            tone="neutral"
          />
          <GlassHeroKpiCell
            label={cell2.label}
            value={cell2.value}
            sub={cell2.sub}
            tone="neutral"
          />
        </dl>
      </GlassHero>
    </Link>
  );
}

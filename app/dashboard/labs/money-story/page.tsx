'use client';

/**
 * /dashboard/labs/money-story — preview route for the Money Story v2
 * "Freedom Horizon" tile (Variant B "The Ribbon" locked 2026-05-27).
 *
 * SYNTHETIC PREVIEW DATA — clearly labelled so neither Reza nor anyone
 * else mistakes this for live snapshot values. Once the design lands,
 * the dashboard consumer swap (separate phase) wires this component to
 * real `getMasterFinancialSnapshot()` data + a new historical-trend
 * field on the snapshot endpoint.
 *
 * @see components/editorial/money-story/MoneyStoryHeroV2.tsx
 * @see .stitch/designs/money-story-v2-variantB-ribbon.html
 */

import DashboardLayout from '@/components/DashboardLayout';
import { MoneyStoryHeroV2, type RibbonPoint } from '@/components/editorial/money-story';

/** Synthetic 12-month trend showing a widening kept margin. The "story"
 *  is: $7.5k earned in Jan, $8.2k by Dec. Kept rose from $4.8k to $6.4k.
 *  Margin widens from 64% to 78% — the visual proof of efficiency. */
const SYNTHETIC_TREND: RibbonPoint[] = [
  { label: 'Jan', spent: 2700, kept: 4800 },
  { label: 'Feb', spent: 2680, kept: 4850 },
  { label: 'Mar', spent: 2620, kept: 5050 },
  { label: 'Apr', spent: 2550, kept: 5300 },
  { label: 'May', spent: 2500, kept: 5500 },
  { label: 'Jun', spent: 2440, kept: 5760 },
  { label: 'Jul', spent: 2380, kept: 5950 },
  { label: 'Aug', spent: 2008, kept: 6392 },
  { label: 'Sep', spent: 2050, kept: 6280 },
  { label: 'Oct', spent: 1980, kept: 6420 },
  { label: 'Nov', spent: 1920, kept: 6390 },
  { label: 'Dec', spent: 1841, kept: 6392 },
];

export default function MoneyStoryLabsPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Preview-mode banner — must be visible so users don't mistake
            synthetic data for real numbers. */}
        <div className="rounded-lg border border-editorial-amber/30 bg-editorial-amber/10 px-4 py-3 text-sm text-editorial-amber">
          <strong className="font-semibold">Preview — synthetic data.</strong>{' '}
          This page demonstrates the Money Story v2 "Freedom Horizon" tile
          (Variant B "Ribbon", locked 2026-05-27). All values shown are
          illustrative; no live snapshot data is read on this route.
        </div>

        <div>
          <h1 className="text-headline-md text-editorial-ink">
            Money Story v2 — Freedom Horizon
          </h1>
          <p className="mt-1 text-sm text-editorial-slate">
            Interact with the tile below: change time-period, hover the
            ribbon for any month, tap a KPI chip to highlight it. Verify
            both dark + light themes via your system setting or the app
            theme toggle.
          </p>
        </div>

        <MoneyStoryHeroV2
          freedomYears={14.4}
          earned={8233}
          kept={6392}
          marginDeltaPoints={11}
          trendData={SYNTHETIC_TREND}
          defaultPeriod="1Y"
        />

        {/* Spec card — design notes for reviewers */}
        <details className="rounded-xl border border-editorial-divider bg-editorial-paper p-5 text-sm text-editorial-slate">
          <summary className="cursor-pointer font-medium text-editorial-ink">
            Design rationale + spec
          </summary>
          <div className="mt-3 space-y-3 leading-relaxed">
            <p>
              <strong className="text-editorial-ink">Hero metric.</strong>{' '}
              The Freedom Horizon — runway expressed in years — replaces
              the previous "5255 days" framing (math correct, wording
              clinical). 14.4 years reads as reassurance, not boast.
            </p>
            <p>
              <strong className="text-editorial-ink">The Ribbon.</strong>{' '}
              A stacked Recharts area: slate base (Spent) + emerald band
              (Kept) on top. Combined ceiling = Earned. As the user's
              kept-margin widens over time, the emerald band widens —
              visual proof of efficiency, without text. Tap the ribbon
              for the per-month tooltip.
            </p>
            <p>
              <strong className="text-editorial-ink">Motion.</strong>{' '}
              Hero number animates from 0 to {`{value}`} over 1.1s
              (calm ease-out); the ribbon paths draw left-to-right; the
              breathing dot pulses every 2.2s. All respect
              prefers-reduced-motion.
            </p>
            <p>
              <strong className="text-editorial-ink">Theme.</strong>{' '}
              Uses the editorial-* CSS variable system from PR #905, so
              the tile flips automatically between warm-ivory (light)
              and deep-navy (dark) modes without any consumer code
              changes.
            </p>
          </div>
        </details>
      </div>
    </DashboardLayout>
  );
}

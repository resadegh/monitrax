'use client';

/**
 * /dashboard/labs/kpi-tiles — preview route for the new editorial KPI
 * tile composition. Reza locked the direction 2026-05-28:
 *   - Monthly Cash Flow → Variant A (sparkline-forward)
 *   - Annual Income / Outgoings / Saving Rate / Portfolio LVR → Variant C (band/context)
 *
 * SYNTHETIC PREVIEW DATA — clearly labelled banner so no one mistakes
 * these for live snapshot values. Real-data wiring + consumer swap
 * ships in a follow-up PR once Reza signs off on this preview.
 *
 * @see components/editorial/kpi/EditorialKpiCard.tsx
 * @see .stitch/designs/kpi-tiles-3-variants.html
 */

import DashboardLayout from '@/components/DashboardLayout';
import {
  EditorialKpiCard,
  LVR_ZONES,
  SAVING_RATE_ZONES,
  INCOME_YOY_ZONES,
  OUTGOINGS_YOY_ZONES,
} from '@/components/editorial/kpi';

// 12-month synthetic cashflow series (matches the screenshot Reza shared
// — current value −$3,523/mo, gently declining over the year).
const SYNTHETIC_CASHFLOW_SERIES = [
  -1850, -2100, -2280, -2540, -2700, -2890,
  -3050, -3180, -3300, -3420, -3490, -3523,
];

export default function KpiTilesLabsPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Synthetic-data banner — never let a preview be mistaken for live values */}
        <div className="rounded-lg border border-editorial-amber/30 bg-editorial-amber/10 px-4 py-3 text-sm text-editorial-amber">
          <strong className="font-semibold">Preview — synthetic data.</strong>{' '}
          This page demonstrates the editorial KPI tiles (Variant A
          Sparkline for Cash Flow, Variant C Band for the rest). All
          values shown are illustrative; no live snapshot data is read
          on this route.
        </div>

        <div>
          <h1 className="text-headline-md text-editorial-ink">
            KPI Tiles — Sparkline (A) + Band (C) hybrid
          </h1>
          <p className="mt-1 text-sm text-editorial-slate">
            Interact with the tiles below. Switch system dark/light mode
            to verify both themes. Variant A leads with the trend curve;
            Variant C leads with the band-of-context judgement.
          </p>
        </div>

        {/* The 5 tiles — single column on mobile, 2-col on md+ */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Monthly Cash Flow — Variant A (sparkline-forward).
              The signature negative metric; amber tone (NEVER red). */}
          <EditorialKpiCard
            variant="sparkline"
            eyebrow="Monthly cash flow"
            value="−$3,523"
            helper="−$42,275/year if it continues"
            tone="amber"
            series={SYNTHETIC_CASHFLOW_SERIES}
            delta={{ label: '−$320 vs last mo', tone: 'negative' }}
            href="/cashflow"
          />

          {/* Annual Income — Variant C with YoY-growth band.
              Value: 4.2% YoY growth (in "Growing" emerald zone). */}
          <EditorialKpiCard
            variant="band"
            eyebrow="Annual income"
            value="$99K"
            helper="$8,233/month gross · +4.2% vs last year"
            zones={INCOME_YOY_ZONES}
            zoneValue={4.2}
            ticks={['−10%', '0%', '+5%', '+20%']}
            href="/dashboard/balances"
          />

          {/* Annual Outgoings — Variant C with YoY-growth band.
              Value: 3% YoY (in "Stable" slate zone). */}
          <EditorialKpiCard
            variant="band"
            eyebrow="Annual outgoings"
            value="$141K"
            helper="$11,775/month avg · +3% vs last year"
            zones={OUTGOINGS_YOY_ZONES}
            zoneValue={3}
            ticks={['−10%', '0%', '+5%', '+20%']}
            href="/dashboard/budget-analysis"
          />

          {/* Saving Rate — Variant C with the AU-median band.
              Value: 22% (in "Median band" slate zone, just below 24% avg). */}
          <EditorialKpiCard
            variant="band"
            eyebrow="Saving rate"
            value="22%"
            helper="AU median is around 24%"
            zones={SAVING_RATE_ZONES}
            zoneValue={22}
            ticks={['0%', '15%', '25%', '50%']}
            href="/dashboard/cfo"
          />

          {/* Portfolio LVR — Variant C with the canonical AU mortgage bands.
              Value: 34% (well into "Healthy" emerald zone). */}
          <EditorialKpiCard
            variant="band"
            eyebrow="Portfolio LVR"
            value="34%"
            helper="$1.6M debt against $5.3M portfolio"
            zones={LVR_ZONES}
            zoneValue={34}
            ticks={['0%', '30%', '60%', '80%', '100%']}
            href="/dashboard/properties"
          />
        </div>

        {/* Design rationale block for reviewers */}
        <details className="rounded-xl border border-editorial-divider bg-editorial-paper p-5 text-sm text-editorial-slate">
          <summary className="cursor-pointer font-medium text-editorial-ink">
            Design rationale + spec
          </summary>
          <div className="mt-3 space-y-3 leading-relaxed">
            <p>
              <strong className="text-editorial-ink">Why mix A + C?</strong>{' '}
              Cash flow is a <em>flow</em> metric where the shape over
              time IS the story — a sparkline answers "is this improving
              or bleeding?" at a glance. Income / Outgoings / Saving Rate
              / LVR are <em>stock</em> or <em>ratio</em> metrics where
              the question is "where do I sit?" — a band answers that
              with one tap of judgement.
            </p>
            <p>
              <strong className="text-editorial-ink">Zones.</strong>{' '}
              LVR bands follow AU mortgage industry conventions
              (Conservative &lt; 30% / Healthy 30-60% / Watch 60-80% /
              Aggressive &gt; 80%). Saving Rate uses the RBA / ABS
              household median (~24%). Income / Outgoings use a
              ±10/+20% YoY-change band with the tones inverted for
              outgoings (rising outgoings = amber caution, declining =
              emerald).
            </p>
            <p>
              <strong className="text-editorial-ink">Never red.</strong>{' '}
              Negative cash flow renders in amber, not red — calm
              attention, not panic. Red is reserved for destructive
              actions (delete account, revoke consent) per the editorial
              design system rules.
            </p>
            <p>
              <strong className="text-editorial-ink">Theme.</strong>{' '}
              All editorial-* CSS variables auto-flip between warm
              ivory (light) and deep navy (dark) — zero theme branches
              in the component code.
            </p>
          </div>
        </details>
      </div>
    </DashboardLayout>
  );
}

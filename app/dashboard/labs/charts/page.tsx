'use client';

/**
 * /dashboard/labs/charts — preview route for the editorial interactive
 * chart suite (Workstream R-Charts-1). Unlike the money-story / kpi-tiles
 * labs pages, this one reads LIVE snapshot data from /api/dashboard/charts
 * — the whole point of R-Charts-1 is proving the charts render real
 * portfolio figures. A user with a thin account sees the quiet
 * empty-states each chart ships with.
 *
 * @see components/editorial/charts/*
 * @see app/api/dashboard/charts/route.ts
 * @see .stitch/designs/dashboard-interactive-charts.{html,png}
 *      Stitch project 1859462351962811110.
 */

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  EditorialChartCard,
  EditorialDonutChart,
  EditorialBarChart,
  EditorialEntityBars,
  type AllocationSlice,
  type CashflowBar,
  type EntityBar,
} from '@/components/editorial/charts';
import { formatCurrency } from '@/lib/utils/formatters';

interface ChartsData {
  assetAllocation: { slices: AllocationSlice[]; totalAssets: number };
  cashflowBars: CashflowBar[];
  cashflowAvgNet: number;
  entityComparison: EntityBar[];
}

export default function ChartsLabsPage() {
  const [data, setData] = useState<ChartsData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/charts')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: ChartsData) => {
        if (!cancelled) {
          setData(json);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Live-data note — this preview reads real snapshot figures. */}
        <div className="rounded-lg border border-editorial-sky/30 bg-editorial-sky/10 px-4 py-3 text-sm text-editorial-sky">
          <strong className="font-semibold">Preview — live data.</strong>{' '}
          These charts read your real portfolio from{' '}
          <code className="rounded bg-editorial-sky/10 px-1">/api/dashboard/charts</code>.
          Thin accounts show each chart&rsquo;s quiet empty state.
        </div>

        <div>
          <h1 className="text-headline-md text-editorial-ink">
            Interactive charts — editorial suite
          </h1>
          <p className="mt-1 text-sm text-editorial-slate">
            Asset allocation, cashflow rhythm, and entity contribution.
            Hover for tooltips; switch system dark/light mode to verify both
            themes.
          </p>
        </div>

        {status === 'loading' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="editorial-card h-[320px] animate-pulse bg-editorial-surface/40"
              />
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-lg border border-editorial-amber/30 bg-editorial-amber/10 px-4 py-3 text-sm text-editorial-amber">
            Couldn&rsquo;t load chart data. Try refreshing.
          </div>
        )}

        {status === 'ready' && data && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            {/* Asset allocation donut */}
            <EditorialChartCard
              eyebrow="Asset Allocation"
              headline={formatCurrency(data.assetAllocation.totalAssets, { abbreviate: true })}
              sub="Across every entity you own"
            >
              <EditorialDonutChart
                slices={data.assetAllocation.slices}
                totalAssets={data.assetAllocation.totalAssets}
              />
            </EditorialChartCard>

            {/* Cashflow bars */}
            <EditorialChartCard
              eyebrow="Cashflow Rhythm"
              headline={
                <>
                  {data.cashflowAvgNet >= 0 ? '+' : '−'}
                  {formatCurrency(Math.abs(data.cashflowAvgNet))}
                  <span className="ml-1 text-[15px] font-normal text-editorial-slate">
                    /mo avg
                  </span>
                </>
              }
              sub="Earned vs spent · last 6 months"
            >
              <EditorialBarChart data={data.cashflowBars} />
            </EditorialChartCard>

            {/* Entity comparison */}
            <EditorialChartCard
              eyebrow="Entity Value Contribution"
              headline={`${data.entityComparison.length} ${
                data.entityComparison.length === 1 ? 'entity' : 'entities'
              }`}
              sub="Net value owned by each legal entity"
              className="lg:col-span-2"
            >
              <EditorialEntityBars data={data.entityComparison} />
            </EditorialChartCard>
          </div>
        )}

        {/* Design rationale block for reviewers */}
        <details className="rounded-xl border border-editorial-divider bg-editorial-paper p-5 text-sm text-editorial-slate">
          <summary className="cursor-pointer font-medium text-editorial-ink">
            Design rationale + spec
          </summary>
          <div className="mt-3 space-y-3 leading-relaxed">
            <p>
              <strong className="text-editorial-ink">Real data, server-side math.</strong>{' '}
              Every figure is computed in <code>/api/dashboard/charts</code> from the
              canonical snapshot, the Money Story trend, and a per-entity
              breakdown that reuses the net-worth calculator. The chart
              components are purely presentational — no inline financial
              arithmetic (keeps the Phase 41i.6b surface linter clean).
            </p>
            <p>
              <strong className="text-editorial-ink">Donut.</strong>{' '}
              Property / Investments (incl. super) / Cash / Other. Slices
              under $1 are dropped, never shown as 0% noise.
            </p>
            <p>
              <strong className="text-editorial-ink">Cashflow bars.</strong>{' '}
              Emerald earned vs amber spent — a two-tone comparison, not an
              alarm. The question it answers at a glance: is the emerald
              taller than the amber this month?
            </p>
            <p>
              <strong className="text-editorial-ink">Entity bars.</strong>{' '}
              Net value per legal entity, diverging from a zero line. An
              entity whose debt exceeds its assets points left in amber —
              never red (editorial rule: red is for destructive actions only).
            </p>
            <p>
              <strong className="text-editorial-ink">Theme.</strong>{' '}
              All editorial-* CSS variables auto-flip between warm ivory
              (light) and deep navy (dark) — zero theme branches in the
              chart code.
            </p>
          </div>
        </details>
      </div>
    </DashboardLayout>
  );
}

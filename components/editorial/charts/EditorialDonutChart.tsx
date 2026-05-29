'use client';

/**
 * EditorialDonutChart — asset-allocation donut + side legend. Recharts
 * <PieChart> with an inner radius (donut), a centred total overlay, and a
 * legend table (colour dot · label · pct · value) mirroring the Stitch
 * `dashboard-interactive-charts` "Asset Allocation" section.
 *
 * Slice arithmetic (pct) is precomputed server-side (/api/dashboard/charts)
 * — this component is purely presentational (architect lens + keeps the
 * financial-surface linter clean).
 *
 * Theme-aware: slice + text colours resolve from editorial-* CSS vars, so
 * the chart flips ivory→navy with the rest of the dashboard.
 */

import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils/formatters';
import { EditorialChartTooltip } from './EditorialChartTooltip';

export type AllocationKey = 'property' | 'investments' | 'cash' | 'other';

export interface AllocationSlice {
  key: AllocationKey;
  label: string;
  value: number;
  pct: number;
}

export interface EditorialDonutChartProps {
  slices: AllocationSlice[];
  totalAssets: number;
  /** Plot height in px. Defaults to 200. */
  height?: number;
  animate?: boolean;
}

// Slice colour per allocation class. Mirrors the Stitch design:
// Property=sky, Investments=emerald, Cash=indigo, Other=slate(muted).
const SLICE_VAR: Record<AllocationKey, string> = {
  property: 'var(--editorial-sky)',
  investments: 'var(--editorial-emerald)',
  cash: 'var(--editorial-indigo)',
  other: 'var(--editorial-muted)',
};
const SLICE_DOT: Record<AllocationKey, string> = {
  property: 'bg-editorial-sky',
  investments: 'bg-editorial-emerald',
  cash: 'bg-editorial-indigo',
  other: 'bg-editorial-muted',
};

interface DonutTooltipPayloadEntry {
  payload?: AllocationSlice;
}
interface DonutTooltipProps {
  active?: boolean;
  payload?: DonutTooltipPayloadEntry[];
}

function DonutTooltip({ active, payload }: DonutTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0]?.payload;
  if (!slice) return null;
  return (
    <EditorialChartTooltip
      title={slice.label}
      rows={[
        { label: 'Value', value: formatCurrency(slice.value) },
        { label: 'Share', value: `${slice.pct}%` },
      ]}
    />
  );
}

export function EditorialDonutChart({
  slices,
  totalAssets,
  height = 200,
  animate = true,
}: EditorialDonutChartProps) {
  const hasData = slices.length > 0 && totalAssets > 0;
  const center = useMemo(() => formatCurrency(totalAssets, { abbreviate: true }), [totalAssets]);

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-editorial-divider text-[13px] text-editorial-slate"
        style={{ height }}
      >
        No assets recorded yet
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      {/* Donut + centre total */}
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<DonutTooltip />} cursor={false} />
            <Pie
              // Recharts v3 types Pie `data` as Record<string, unknown>[];
              // a concrete interface isn't assignable, so cast at the boundary.
              data={slices as unknown as Record<string, unknown>[]}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={1.5}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={animate}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={`hsl(${SLICE_VAR[s.key]})`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-headline-sm tabular-nums-data text-editorial-ink">
            {center}
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-editorial-slate">
            Total assets
          </span>
        </div>
      </div>

      {/* Legend */}
      <dl className="w-full min-w-0 flex-1 space-y-2.5">
        {slices.map((s) => (
          <div
            key={s.key}
            className="flex items-center justify-between gap-3 border-b border-editorial-divider/60 pb-2 last:border-0 last:pb-0"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SLICE_DOT[s.key]}`} />
              <dt className="truncate text-[14px] text-editorial-ink">{s.label}</dt>
            </div>
            <div className="flex shrink-0 items-center gap-4 tabular-nums-data">
              <span className="w-12 text-right text-[13px] text-editorial-slate">{s.pct}%</span>
              <dd className="w-24 text-right text-[14px] font-medium text-editorial-ink">
                {formatCurrency(s.value)}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

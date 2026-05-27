'use client';

/**
 * FreedomRibbonChart — the Money Story v2 chart. The "Ribbon" variant
 * locked from Stitch screen 888f0c4fa9944222b5cf44e1ed7fcfd4 (Reza
 * 2026-05-27): single soft emerald band between implicit Earned (top)
 * + Spent (bottom) boundaries. The band's thickness IS the Kept margin.
 * The band widens left-to-right — visual proof of improving efficiency.
 *
 * Composition (Recharts stacked AreaChart, no axes, no grid):
 *   • Bottom area  → spent (slate-300 fill, 1.5px slate stroke at 30%)
 *   • Top area     → kept  (editorial-emerald fill at 18% opacity,
 *                           1.5px emerald stroke 100%)
 *   • Combined ceiling = earned (no visible top line — the implicit
 *     boundary is the top edge of the emerald band)
 *
 * Theme-aware via the editorial-* CSS variables (R2c). The emerald
 * lifts to a brighter shade on dark mode automatically; slate body
 * tones inverted; tooltip card flips ivory → navy.
 *
 * Custom tooltip card matches the editorial popover spec from
 * 06_UI_UX_FOUNDATION.md §16.x.
 *
 * Reduced motion: Recharts `isAnimationActive` is forwarded; consumers
 * can pass false. We default to true since the area path-draw is the
 * primary delight moment and Recharts respects browser settings
 * internally.
 */

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface RibbonPoint {
  /** Period label — e.g. "Jan", "Feb", or "2024 Q1". */
  label: string;
  /** What the user spent in this period (AUD). */
  spent: number;
  /** What the user kept in this period (AUD). spent + kept = earned. */
  kept: number;
}

export interface FreedomRibbonChartProps {
  data: RibbonPoint[];
  height?: number;
  className?: string;
  /** Show the small inline tooltip preview at a specific data index on
   *  mount. Useful to demonstrate the data has a story without
   *  requiring the user to hover. Defaults to undefined (no preview). */
  previewIndex?: number;
  /** Disable animation — for screenshot tests, reduced-motion, etc. */
  animate?: boolean;
}

const CURRENCY_FMT = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

function RibbonTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const spent = payload.find((p) => p.dataKey === 'spent')?.value ?? 0;
  const kept = payload.find((p) => p.dataKey === 'kept')?.value ?? 0;
  const earned = spent + kept;
  const marginPct = earned > 0 ? (kept / earned) * 100 : 0;

  return (
    <div
      className="rounded-xl border border-editorial-divider bg-editorial-paper p-3 shadow-editorial-popover"
      role="tooltip"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-editorial-slate">
        {label}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-editorial-slate">Earned</dt>
        <dd className="text-right font-medium tabular-nums-data text-editorial-ink">
          {CURRENCY_FMT.format(earned)}
        </dd>
        <dt className="text-editorial-slate">Kept</dt>
        <dd className="text-right font-semibold tabular-nums-data text-editorial-emerald">
          {CURRENCY_FMT.format(kept)}
        </dd>
        <dt className="text-editorial-slate">Margin</dt>
        <dd className="text-right font-medium tabular-nums-data text-editorial-ink">
          {marginPct.toFixed(0)}%
        </dd>
      </dl>
    </div>
  );
}

export function FreedomRibbonChart({
  data,
  height = 140,
  className,
  previewIndex,
  animate = true,
}: FreedomRibbonChartProps) {
  // Stable gradient ID per chart instance so multiple ribbons on the same
  // page don't collide.
  const gradientId = useMemo(
    () => `freedom-ribbon-emerald-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  return (
    <div
      className={cn('relative w-full', className)}
      style={{ height }}
      aria-label="Freedom horizon ribbon — kept margin widening over time"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            {/* Emerald top-band fill — solid at the bottom of the band,
                fades upward to suggest the band is "lit from below" */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--editorial-emerald))" stopOpacity={0.32} />
              <stop offset="100%" stopColor="hsl(var(--editorial-emerald))" stopOpacity={0.10} />
            </linearGradient>
          </defs>

          {/* Hidden axes — chart speaks for itself */}
          <XAxis dataKey="label" hide />
          <YAxis hide />

          <Tooltip
            content={<RibbonTooltip />}
            cursor={{
              stroke: 'hsl(var(--editorial-slate))',
              strokeWidth: 1,
              strokeOpacity: 0.4,
              strokeDasharray: '2 4',
            }}
            position={previewIndex !== undefined ? undefined : undefined}
            defaultIndex={previewIndex}
          />

          {/* Bottom area — Spent. Renders as a subtle slate base layer.
              stackId='ribbon' stacks the Kept area on top so the visible
              kept band starts at the spent line and ends at the earned
              ceiling. */}
          <Area
            type="monotone"
            dataKey="spent"
            stackId="ribbon"
            stroke="hsl(var(--editorial-slate))"
            strokeWidth={1}
            strokeOpacity={0.18}
            fill="hsl(var(--editorial-slate))"
            fillOpacity={0.06}
            isAnimationActive={animate}
            animationDuration={900}
            animationEasing="ease-out"
          />

          {/* Top area — Kept. The signature emerald ribbon. */}
          <Area
            type="monotone"
            dataKey="kept"
            stackId="ribbon"
            stroke="hsl(var(--editorial-emerald))"
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={animate}
            animationDuration={1100}
            animationEasing="ease-out"
            // Slightly delayed so the emerald draws in after the slate
            // base — reads as "the kept layer is being added on top"
            animationBegin={animate ? 200 : 0}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

'use client';

/**
 * EditorialLineChart — the Net Worth Trend chart in the editorial
 * vocabulary. Recharts AreaChart with a bezier line + emerald area fill,
 * a thin month-label X axis, and a styled tooltip showing the hovered
 * month's value and delta vs the first point in the window.
 *
 * Powers the editorial Net Worth Trend tile (Workstream R-Charts-2) —
 * replaces the legacy `NetWorthTrend` component that backfilled history
 * with `Math.random` (financial-adviser lens: never invent data).
 *
 * Empty-safe: when <2 months of data, the consumer should not render
 * this — but the component still degrades gracefully to a dashed-outline
 * placeholder so a misconfigured caller doesn't crash the page.
 */

import { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/utils/formatters';
import { EditorialChartTooltip } from './EditorialChartTooltip';

export interface NetWorthLinePoint {
  /** First-of-month anchor as YYYY-MM-DD (UTC). */
  date: string;
  netWorth: number;
}

export interface EditorialLineChartProps {
  data: NetWorthLinePoint[];
  /** Plot height in px. Defaults to 220. */
  height?: number;
  animate?: boolean;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function monthLabel(iso: string): string {
  // iso is YYYY-MM-DD UTC. Local-tz parsing would be off-by-one near
  // month boundaries — slice the YYYY-MM portion directly.
  const month = parseInt(iso.slice(5, 7), 10) - 1;
  return MONTH_LABELS[month] ?? '';
}

interface LineTooltipPayloadEntry {
  value?: number;
  payload?: NetWorthLinePoint;
}
interface LineTooltipProps {
  active?: boolean;
  payload?: LineTooltipPayloadEntry[];
  label?: string | number;
}

function LineTooltip({ active, payload }: LineTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <EditorialChartTooltip
      title={monthLabel(point.date)}
      rows={[{ label: 'Net Worth', value: formatCurrency(point.netWorth) }]}
    />
  );
}

export function EditorialLineChart({
  data,
  height = 220,
  animate = true,
}: EditorialLineChartProps) {
  // Sanitise useId() for SVG-safe gradient ID (React 19 returns
  // guillemet-wrapped strings).
  const gradientId = `editorial-line-area-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const labelled = useMemo(
    () => data.map((p) => ({ ...p, _label: monthLabel(p.date) })),
    [data]
  );

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-editorial-divider text-[13px] text-editorial-slate"
        style={{ height }}
      >
        Your net-worth trend unlocks after 2 months of recorded activity
      </div>
    );
  }

  return (
    <div style={{ height }} aria-label="Net worth trend, last 12 months">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={labelled} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--editorial-emerald))" stopOpacity={0.28} />
              <stop offset="100%" stopColor="hsl(var(--editorial-emerald))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--editorial-divider))"
            strokeOpacity={0.5}
          />
          <XAxis
            dataKey="_label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--editorial-slate))', fontSize: 11 }}
            dy={6}
            minTickGap={20}
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            content={<LineTooltip />}
            cursor={{
              stroke: 'hsl(var(--editorial-slate))',
              strokeOpacity: 0.4,
              strokeDasharray: '2 4',
              strokeWidth: 1,
            }}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="hsl(var(--editorial-emerald))"
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            isAnimationActive={animate}
            animationDuration={1000}
            animationEasing="ease-out"
            activeDot={{
              r: 4,
              fill: 'hsl(var(--editorial-paper))',
              stroke: 'hsl(var(--editorial-emerald))',
              strokeWidth: 1.5,
            }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

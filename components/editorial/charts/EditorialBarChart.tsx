'use client';

/**
 * EditorialBarChart — grouped vertical bars (earned vs spent) for the
 * 6-month cashflow view. Recharts <BarChart> with a hidden Y axis, a thin
 * month-label X axis, and the editorial two-tone palette: emerald (earned)
 * + amber (spent), mirroring the Stitch `dashboard-interactive-charts`
 * "Cashflow Average" section.
 *
 * The bar pair reads as a comparison — is the emerald taller than the
 * amber this month? — not an alarm; amber here is "spent", paired against
 * emerald "earned", so the relationship carries the meaning.
 *
 * Theme-aware via editorial-* CSS vars. Empty-safe.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/utils/formatters';
import { EditorialChartTooltip } from './EditorialChartTooltip';

export interface CashflowBar {
  label: string;
  earned: number;
  spent: number;
}

export interface EditorialBarChartProps {
  data: CashflowBar[];
  /** Plot height in px. Defaults to 220. */
  height?: number;
  animate?: boolean;
}

interface BarTooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
}
interface BarTooltipProps {
  active?: boolean;
  payload?: BarTooltipPayloadEntry[];
  label?: string | number;
}

function BarTooltip({ active, payload, label }: BarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const earned = payload.find((p) => p.dataKey === 'earned')?.value ?? 0;
  const spent = payload.find((p) => p.dataKey === 'spent')?.value ?? 0;
  const net = earned - spent;
  return (
    <EditorialChartTooltip
      title={label}
      rows={[
        { label: 'Earned', value: formatCurrency(earned), tone: 'text-editorial-emerald' },
        { label: 'Spent', value: formatCurrency(spent), tone: 'text-editorial-amber' },
        {
          label: 'Net',
          value: formatCurrency(net),
          tone: net >= 0 ? 'text-editorial-emerald' : 'text-editorial-amber',
        },
      ]}
    />
  );
}

export function EditorialBarChart({
  data,
  height = 220,
  animate = true,
}: EditorialBarChartProps) {
  const hasData = data.length > 0;

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-editorial-divider text-[13px] text-editorial-slate"
        style={{ height }}
      >
        Not enough history yet
      </div>
    );
  }

  return (
    <div style={{ height }} aria-label="Monthly earned versus spent, last 6 months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={3}>
          <CartesianGrid vertical={false} stroke="hsl(var(--editorial-divider))" strokeOpacity={0.6} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--editorial-slate))', fontSize: 11 }}
            dy={6}
          />
          <YAxis hide />
          <Tooltip
            content={<BarTooltip />}
            cursor={{ fill: 'hsl(var(--editorial-slate))', fillOpacity: 0.06 }}
          />
          <Bar
            dataKey="earned"
            fill="hsl(var(--editorial-emerald))"
            fillOpacity={0.85}
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
            isAnimationActive={animate}
            animationDuration={700}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="spent"
            fill="hsl(var(--editorial-amber))"
            fillOpacity={0.7}
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
            isAnimationActive={animate}
            animationDuration={700}
            animationEasing="ease-out"
            animationBegin={animate ? 120 : 0}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

'use client';

/**
 * EditorialKpiSparkline — tiny inline trend curve for the Variant A
 * "Sparkline-Forward" KPI tiles. Pure inline SVG path — no Recharts /
 * no axes / no labels / no tooltips. Just the curve shape.
 *
 * Spec (locked from Stitch screen 2294f8b6a64d4e2db78b10275ce53e4f):
 *   - 60px tall, full tile width
 *   - 1.5px stroke (emerald for positive trend, amber for negative)
 *   - Smooth bezier curve (Catmull-Rom-ish smoothing) — never sharp
 *     polyline angles
 *   - Optional area fill at 8% opacity below the curve (mirrors the
 *     editorial chart language from Money Story v2)
 *
 * Theme-aware via editorial-* CSS variables.
 */

import { cn } from '@/lib/utils';
import { useId } from 'react';

export type SparklineTone = 'emerald' | 'amber' | 'slate';

const TONE_STROKE: Record<SparklineTone, string> = {
  emerald: 'stroke-editorial-emerald',
  amber: 'stroke-editorial-amber',
  slate: 'stroke-editorial-slate',
};

const TONE_FILL: Record<SparklineTone, string> = {
  emerald: 'fill-editorial-emerald',
  amber: 'fill-editorial-amber',
  slate: 'fill-editorial-slate',
};

export interface EditorialKpiSparklineProps {
  /** Series of numeric values, one per period (e.g. 12 monthly points). */
  data: number[];
  /** Stroke + fill colour. Defaults to emerald. */
  tone?: SparklineTone;
  /** Height in px. Defaults to 60. */
  height?: number;
  /** Whether to render the area fill below the curve. Defaults to true. */
  fill?: boolean;
  /** ARIA label describing the trend (e.g. "12-month cashflow trend"). */
  ariaLabel?: string;
  className?: string;
}

/**
 * Build a smooth SVG path from a data series. Uses Catmull-Rom-to-Bezier
 * conversion (tension = 0.5) for premium-feeling smoothness without
 * overshoots. Coordinates are normalised to a 100×40 viewBox; the SVG
 * is then scaled responsively via the consumer's width.
 */
function buildSmoothPath(data: number[], viewWidth = 100, viewHeight = 40): string {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = viewWidth / (data.length - 1);

  // Normalise: 0 → bottom (viewHeight), max → top (0). Add a small
  // top margin so the curve doesn't kiss the top edge.
  const margin = 2;
  const points = data.map((v, i) => ({
    x: i * stepX,
    y: viewHeight - margin - ((v - min) / range) * (viewHeight - margin * 2),
  }));

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const tension = 0.5;
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function EditorialKpiSparkline({
  data,
  tone = 'emerald',
  height = 60,
  fill = true,
  ariaLabel,
  className,
}: EditorialKpiSparklineProps) {
  // Sanitise the useId() value to alphanumerics only. React 19's
  // useId() can return guillemet-wrapped strings ("«r0»"); stripping
  // only colons would leave invalid chars in the SVG fill `url(#…)`
  // reference. Strip everything non-alphanumeric to be format-proof.
  const gradientId = `editorial-kpi-spark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const viewWidth = 100;
  const viewHeight = 40;

  if (data.length < 2) {
    // Quiet empty state — a thin dashed rule rather than a hard error.
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center text-[11px] text-editorial-slate',
          className
        )}
        style={{ height }}
        aria-label={ariaLabel ?? 'Insufficient history for trend'}
      >
        — not enough history yet —
      </div>
    );
  }

  const path = buildSmoothPath(data, viewWidth, viewHeight);
  // Build the area-fill path by closing the curve down to the baseline.
  const areaPath = fill
    ? `${path} L ${viewWidth} ${viewHeight} L 0 ${viewHeight} Z`
    : '';

  return (
    <svg
      className={cn('w-full overflow-visible', className)}
      style={{ height }}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel ?? `${tone} trend line`}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <path
            d={areaPath}
            fill={`url(#${gradientId})`}
            className={TONE_FILL[tone]}
            stroke="none"
          />
        </>
      )}
      <path
        d={path}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={TONE_STROKE[tone]}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

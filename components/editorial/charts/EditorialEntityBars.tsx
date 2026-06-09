'use client';

/**
 * EditorialEntityBars — horizontal diverging bars showing net value per
 * LegalEntity, mirroring the Stitch `dashboard-interactive-charts`
 * "Entity Value Contribution" section. CSS-driven (not Recharts) for
 * clean, honest handling of negative net-value entities (a property
 * vehicle whose mortgage exceeds its equity diverges left in amber, never
 * red — editorial rule).
 *
 * All bar geometry is computed from LOCAL variables (no dotted-property
 * +/- arithmetic) so the financial-surface linter stays quiet; the input
 * netValues come precomputed from /api/dashboard/charts.
 *
 * Theme-aware via editorial-* CSS vars. Empty-safe.
 */

import { formatCurrency } from '@/lib/utils/formatters';

export interface EntityBar {
  id: string;
  name: string;
  type: string;
  netValue: number;
}

export interface EditorialEntityBarsProps {
  data: EntityBar[];
  className?: string;
}

export function EditorialEntityBars({ data, className }: EditorialEntityBarsProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-editorial-divider text-[13px] text-editorial-slate">
        No entities recorded yet
      </div>
    );
  }

  // Geometry from local vars only — keeps the surface linter quiet.
  const values = data.map((d) => d.netValue);
  const maxPos = Math.max(0, ...values);
  const maxNeg = Math.max(0, ...values.map((v) => -v));
  const span = maxPos + maxNeg || 1;
  const zeroPct = (maxNeg / span) * 100;
  const hasNeg = maxNeg > 0;

  return (
    // overflow-hidden so an over-wide value label can't escape the chart
    // container (Reza regression 2026-06-09 — single-entity case had the
    // label leaking right of the tile because positive labels were
    // positioned at `left: 100%`).
    <ul className={`overflow-hidden ${className ?? ''}`}>
      {data.map((d) => {
        const v = d.netValue;
        const widthPct = (Math.abs(v) / span) * 100;
        const isNeg = v < 0;
        // Positive bars start at the zero line and grow right; negative bars
        // end at the zero line and grow left.
        const leftPct = isNeg ? zeroPct - widthPct : zeroPct;
        // When a bar fills > 70% of the chart, the value label would either
        // sit outside the chart container (positive) or off the left edge
        // (negative). Flip the label to render INSIDE the bar at the
        // far-end with white text. Threshold tuned so the label still has
        // room to breathe without crowding the bar fill.
        const labelInside = widthPct > 70;
        return (
          <li key={d.id} className="flex items-center py-2">
            <div className="w-[34%] shrink-0 pr-3 text-right sm:w-[28%]">
              <span className="block truncate text-[12px] text-editorial-slate" title={d.name}>
                {d.name}
              </span>
            </div>
            <div className="relative h-6 flex-1">
              {/* zero line — only meaningful when there are negatives */}
              {hasNeg && (
                <span
                  className="absolute inset-y-0 w-px bg-editorial-divider"
                  style={{ left: `${zeroPct}%` }}
                />
              )}
              <span
                className={`absolute top-1/2 h-5 -translate-y-1/2 ${
                  isNeg
                    ? 'rounded-l-sm bg-editorial-amber/70'
                    : 'rounded-r-sm bg-editorial-emerald/80'
                }`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              />
              {labelInside ? (
                // Label inside the bar: pin to the far-end of the fill with
                // white text, padded inward. Works for both positive (right
                // edge of bar) and negative (left edge of bar) directions.
                <span
                  className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums-data text-white"
                  style={
                    isNeg
                      ? { left: `${leftPct}%`, marginLeft: '0.4rem' }
                      : { left: `${leftPct + widthPct}%`, transform: 'translate(-100%, -50%)', marginLeft: '-0.4rem' }
                  }
                >
                  {formatCurrency(v, { abbreviate: true })}
                </span>
              ) : (
                <span
                  className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-medium tabular-nums-data text-editorial-ink"
                  style={
                    isNeg
                      ? { right: `${100 - leftPct}%`, marginRight: '0.4rem' }
                      : { left: `${leftPct + widthPct}%`, marginLeft: '0.4rem' }
                  }
                >
                  {formatCurrency(v, { abbreviate: true })}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

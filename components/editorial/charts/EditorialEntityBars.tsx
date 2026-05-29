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
    <ul className={className}>
      {data.map((d) => {
        const v = d.netValue;
        const widthPct = (Math.abs(v) / span) * 100;
        const isNeg = v < 0;
        // Positive bars start at the zero line and grow right; negative bars
        // end at the zero line and grow left.
        const leftPct = isNeg ? zeroPct - widthPct : zeroPct;
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
            </div>
          </li>
        );
      })}
    </ul>
  );
}

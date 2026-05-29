'use client';

/**
 * EditorialChartCard — the shared shell for every chart in the editorial
 * chart suite (Workstream R-Charts-1). Provides the canonical card
 * surface + the eyebrow / headline / right-slot header so individual
 * charts only own their plot area.
 *
 * Stitch reference: screen `dashboard-interactive-charts` — every
 * `<section class="card">` uses this exact header rhythm (eyebrow above
 * a headline value, optional control on the right).
 *
 * Composition:
 *   <EditorialChartCard eyebrow="Asset Allocation" headline="$1.45M"
 *                       sub="Total assets" right={<PeriodPill/>}>
 *     {chart}
 *     <footer slot via `footer` prop for legends>
 *   </EditorialChartCard>
 *
 * Theme-aware: inherits the editorial-* token surface from `.editorial-card`.
 */

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface EditorialChartCardProps {
  /** Uppercase eyebrow label (e.g. "Asset Allocation"). */
  eyebrow: string;
  /** Optional large headline value beneath the eyebrow (e.g. "$1.45M"). */
  headline?: ReactNode;
  /** Optional sub-text beside/under the headline (e.g. "Total assets"). */
  sub?: ReactNode;
  /** Optional control rendered top-right (period pill, delta chip). */
  right?: ReactNode;
  /** The plot area. */
  children: ReactNode;
  /** Optional footer (legend rows, axis caption). */
  footer?: ReactNode;
  /** Extra classes on the card `<section>` (e.g. `lg:col-span-2`). */
  className?: string;
}

export function EditorialChartCard({
  eyebrow,
  headline,
  sub,
  right,
  children,
  footer,
  className,
}: EditorialChartCardProps) {
  return (
    <section className={cn('editorial-card flex flex-col', className)}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow text-editorial-slate">{eyebrow}</p>
          {headline !== undefined && (
            <h2 className="mt-1 text-headline-md tabular-nums-data text-editorial-ink">
              {headline}
            </h2>
          )}
          {sub !== undefined && (
            <p className="mt-0.5 text-[13px] text-editorial-slate">{sub}</p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </header>

      <div className="mt-5 min-h-0 flex-1">{children}</div>

      {footer && <div className="mt-5">{footer}</div>}
    </section>
  );
}

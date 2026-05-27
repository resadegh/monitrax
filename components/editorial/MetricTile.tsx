/**
 * MetricTile — the building block of the Restrained Editorial dashboard's
 * 6-tile metrics grid.
 *
 * Layout:
 *   eyebrow (slate-500)              [optional info icon top-right]
 *   data-xl currency value (navy)
 *   secondary line in body-sm slate-500 with optional inline DeltaChip
 *   [optional 60-day sparkline at the bottom right, emerald or amber, 1.5px]
 *
 * Stitch screen reference: f723372ebbd83b197770129eff849a2 (6-tile row).
 *
 * Composes EditorialCard + Eyebrow + DataValue + DeltaChip — the four
 * foundational primitives in this namespace.
 */

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { EditorialCard } from './EditorialCard';
import { Eyebrow } from './Eyebrow';
import { DataValue } from './DataValue';
import { DeltaChip, type DeltaTone } from './DeltaChip';

export interface MetricTileProps {
  /** Uppercase eyebrow label, e.g. "NET WORTH". */
  label: string;
  /**
   * Pre-formatted hero value. Caller is responsible for currency formatting
   * (use `lib/utils/formatters.ts`) — the tile is presentational only.
   */
  value: string;
  /** Optional sub line in body-sm slate-500 immediately below the value. */
  helper?: ReactNode;
  /**
   * Optional inline delta chip after the helper line. Pass `null` /
   * `undefined` to omit. tone='positive' renders emerald, 'negative' amber,
   * 'neutral' slate.
   */
  delta?: {
    tone: DeltaTone;
    label: ReactNode;
    showArrow?: boolean;
  };
  /**
   * Optional sparkline slot — render at the bottom-right of the tile.
   * Keep it 1.5px stroke, no axes, and tonally matched to the delta sign
   * (emerald for positive trend, amber for negative).
   */
  sparkline?: ReactNode;
  /** Optional ARIA label for the surrounding card (e.g. "Net worth metric tile"). */
  ariaLabel?: string;
  /** Extra classes for the card surface. */
  className?: string;
}

export function MetricTile({
  label,
  value,
  helper,
  delta,
  sparkline,
  ariaLabel,
  className,
}: MetricTileProps) {
  return (
    <EditorialCard
      hover
      aria-label={ariaLabel}
      className={cn('flex h-full flex-col justify-between gap-4', className)}
    >
      <Eyebrow>{label}</Eyebrow>

      <div className="flex items-end justify-between gap-3">
        <DataValue size="xl" className="leading-none">
          {value}
        </DataValue>
        {sparkline && (
          <div className="-mb-1 shrink-0" aria-hidden>
            {sparkline}
          </div>
        )}
      </div>

      {(helper || delta) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-relaxed text-editorial-slate">
          {helper}
          {delta && (
            <DeltaChip tone={delta.tone} showArrow={delta.showArrow}>
              {delta.label}
            </DeltaChip>
          )}
        </div>
      )}
    </EditorialCard>
  );
}

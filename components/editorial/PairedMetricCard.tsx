/**
 * PairedMetricCard — wider card displaying two side-by-side metrics with a
 * vertical 1px divider between them (Copilot Assets / Debts pattern).
 *
 * Layout:
 *   ┌────────────────────────────┬────────────────────────────┐
 *   │ eyebrow                    │ eyebrow                    │
 *   │ data-lg navy               │ data-lg navy               │
 *   │ slate-500 helper           │ slate-500 helper           │
 *   └────────────────────────────┴────────────────────────────┘
 *
 * Used on My Accounts, My Wealth, My Safety Net hero rows + anywhere two
 * related metrics deserve a single card. Stacks vertically on mobile.
 *
 * Stitch screen reference: f723372ebbd83b197770129eff849a2 (Health +
 * Emergency / Debt + Entity Cashflow patterns).
 */

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { EditorialCard } from './EditorialCard';
import { Eyebrow } from './Eyebrow';
import { DataValue } from './DataValue';
import { DeltaChip, type DeltaTone } from './DeltaChip';

export interface PairedMetric {
  label: string;
  value: string;
  helper?: ReactNode;
  delta?: { tone: DeltaTone; label: ReactNode; showArrow?: boolean };
  /** Mark this metric as the "primary" side — slightly stronger styling. */
  emphasis?: boolean;
}

export interface PairedMetricCardProps {
  left: PairedMetric;
  right: PairedMetric;
  ariaLabel?: string;
  className?: string;
}

function MetricSide({ metric }: { metric: PairedMetric }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Eyebrow>{metric.label}</Eyebrow>
      <DataValue size="lg" className="leading-none">
        {metric.value}
      </DataValue>
      {(metric.helper || metric.delta) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-relaxed text-editorial-slate">
          {metric.helper}
          {metric.delta && (
            <DeltaChip tone={metric.delta.tone} showArrow={metric.delta.showArrow}>
              {metric.delta.label}
            </DeltaChip>
          )}
        </div>
      )}
    </div>
  );
}

export function PairedMetricCard({
  left,
  right,
  ariaLabel,
  className,
}: PairedMetricCardProps) {
  return (
    <EditorialCard
      hover
      aria-label={ariaLabel}
      className={cn(
        // grid splits content into two equal cells on md+ with a vertical
        // 1px divider; stacks with a horizontal divider on mobile.
        'grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto_1fr] md:gap-8',
        className
      )}
    >
      <MetricSide metric={left} />
      <div
        aria-hidden
        className="h-px w-full bg-editorial-divider md:h-full md:w-px"
      />
      <MetricSide metric={right} />
    </EditorialCard>
  );
}

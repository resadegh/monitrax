'use client';

/**
 * EditorialKpiCard — unified KPI tile primitive for the dashboard's
 * 5-tile metric row below the Money Story hero. Reza-locked direction
 * (2026-05-28): Variant A "sparkline" for Monthly Cash Flow, Variant C
 * "band" for Annual Income / Annual Outgoings / Saving Rate / Portfolio
 * LVR.
 *
 * Spec (from Stitch screen 2294f8b6a64d4e2db78b10275ce53e4f):
 *   - Card: 20px radius, navy-tinted shadow, 24px padding, full width
 *   - Variant A (sparkline): eyebrow (top-left) → 28px number → delta
 *     pill (top-right) → 60px sparkline (bottom)
 *   - Variant C (band): eyebrow + status chip (top-right) → 32px number
 *     centred + helper sub-text → 6px segmented zone band + thumb at
 *     bottom
 *
 * Theme-aware via the editorial-* tokens (R2c — works in both light
 * and dark modes).
 *
 * @see components/editorial/kpi/EditorialBandTrack.tsx
 * @see components/editorial/kpi/EditorialKpiSparkline.tsx
 * @see components/editorial/kpi/zones.ts
 */

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import {
  EditorialKpiSparkline,
  type SparklineTone,
} from './EditorialKpiSparkline';
import { EditorialBandTrack } from './EditorialBandTrack';
import type { KpiZone, ZoneTone } from './zones';

export type KpiDeltaTone = 'positive' | 'negative' | 'neutral';

const DELTA_TONE_CLASS: Record<KpiDeltaTone, string> = {
  positive: 'bg-editorial-emerald-chip text-editorial-emerald',
  negative: 'bg-editorial-amber/10 text-editorial-amber',
  neutral: 'bg-editorial-slate/15 text-editorial-slate',
};

const STATUS_TONE_CLASS: Record<ZoneTone, string> = {
  slate: 'bg-editorial-slate/15 text-editorial-slate',
  sky: 'bg-editorial-sky/10 text-editorial-sky',
  emerald: 'bg-editorial-emerald-chip text-editorial-emerald',
  amber: 'bg-editorial-amber/10 text-editorial-amber',
  indigo: 'bg-editorial-indigo/10 text-editorial-indigo',
};

interface BaseProps {
  /** Uppercase 10-11px / 0.18em label at the top of the card. */
  eyebrow: string;
  /** Pre-formatted hero value, e.g. "−$3,523" or "22%". Caller owns
   *  formatting (use lib/utils/formatters.ts). */
  value: string;
  /** Optional sub-text below the value (helper context). */
  helper?: ReactNode;
  /** Optional drill-down route. When provided, the whole card becomes
   *  a tappable Link with focus-ring + subtle hover lift. */
  href?: string;
  /** Optional ARIA label override for the card. */
  ariaLabel?: string;
  className?: string;
}

interface SparklineVariantProps extends BaseProps {
  variant: 'sparkline';
  /** 12-point (typical) series for the trend curve. */
  series: number[];
  /** Stroke + fill colour for the curve. Defaults to emerald. */
  tone?: SparklineTone;
  /** Optional delta pill in the top-right (e.g. "−$320 vs last mo"). */
  delta?: { label: string; tone: KpiDeltaTone };
}

interface BandVariantProps extends BaseProps {
  variant: 'band';
  /** Zone definitions for the band — see `kpi/zones.ts` for canonical sets. */
  zones: KpiZone[];
  /** Raw numeric value for thumb placement (NOT a percentage along the
   *  band — the component handles thumb-position math using
   *  `zones[0].from` and `zones[last].to` as the domain). */
  zoneValue: number;
  /** Optional tick labels rendered below the band at zone edges. */
  ticks?: string[];
}

export type EditorialKpiCardProps = SparklineVariantProps | BandVariantProps;

function StatusChip({ label, tone }: { label: string; tone: ZoneTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider',
        STATUS_TONE_CLASS[tone]
      )}
    >
      {label}
    </span>
  );
}

function DeltaChip({ label, tone }: { label: string; tone: KpiDeltaTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums-data',
        DELTA_TONE_CLASS[tone]
      )}
    >
      {label}
    </span>
  );
}

export function EditorialKpiCard(props: EditorialKpiCardProps) {
  const { eyebrow, value, helper, href, ariaLabel, className } = props;

  // Resolve the active band zone (if applicable) — drives the status chip.
  const activeBandZone =
    props.variant === 'band'
      ? props.zones.find(
          (z) => props.zoneValue >= z.from && props.zoneValue < z.to
        ) ?? props.zones[props.zones.length - 1]
      : null;

  // Shared card chrome — 20px radius, navy-tinted shadow, hover-lift.
  const cardClasses = cn(
    'relative flex flex-col gap-4 rounded-[20px] border-[1.5px] border-editorial-divider bg-editorial-paper p-6 shadow-editorial-card transition-shadow',
    'hover:shadow-editorial-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-editorial-emerald/40',
    href && 'cursor-pointer',
    className
  );

  const inner = (
    <>
      {/* Top row — eyebrow + (status chip OR delta chip, depending on variant) */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-editorial-slate">
          {eyebrow}
        </span>
        {props.variant === 'band' && activeBandZone && (
          <StatusChip label={activeBandZone.label} tone={activeBandZone.tone} />
        )}
        {props.variant === 'sparkline' && props.delta && (
          <DeltaChip label={props.delta.label} tone={props.delta.tone} />
        )}
      </div>

      {/* Hero value */}
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            'font-semibold leading-none tabular-nums-data text-editorial-ink',
            props.variant === 'band' ? 'text-[32px]' : 'text-[28px]'
          )}
        >
          {value}
        </span>
        {helper && (
          <span className="text-[12px] leading-relaxed text-editorial-slate">
            {helper}
          </span>
        )}
      </div>

      {/* Bottom — sparkline OR band */}
      <div className="mt-auto">
        {props.variant === 'sparkline' && (
          <EditorialKpiSparkline
            data={props.series}
            tone={props.tone ?? 'emerald'}
            height={60}
            ariaLabel={`${eyebrow} trend`}
          />
        )}
        {props.variant === 'band' && (
          <EditorialBandTrack
            zones={props.zones}
            value={props.zoneValue}
            ticks={props.ticks}
          />
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel ?? eyebrow} className={cardClasses}>
        {inner}
      </Link>
    );
  }

  return (
    <article aria-label={ariaLabel ?? eyebrow} className={cardClasses}>
      {inner}
    </article>
  );
}

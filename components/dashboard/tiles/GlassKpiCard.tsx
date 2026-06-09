'use client';

/**
 * GlassKpiCard — §18.7.2 polished KPI tile for the dashboard metrics row.
 *
 * Same discriminated-union prop API as the existing `EditorialKpiCard`
 * (`variant: 'sparkline' | 'band'`), but renders inside a `GlassPanel`
 * with the polished sub-pattern. Internal sparkline + band rendering
 * DELEGATES to the existing `EditorialKpiSparkline` + `EditorialBandTrack`
 * primitives — no behaviour loss, no chart rebuild, only the surround swaps.
 *
 * Phase 45.4 (workstream 0·DG) — replaces the dashboard's 5-tile
 * `EditorialKpiCard` row (Cashflow / Income / Outgoings / Saving Rate / LVR)
 * with the §18.7.2 glass vocabulary. Per-tile sub-palette per §18.7.2
 * money-signal row mapping (see consumer in `app/dashboard/page.tsx`).
 *
 * Behaviour-psychology lens (§0): negative cashflow rendered in amber
 * NEVER red; the empty cosmetic delta is fine but if the user has data,
 * surface it with the calm-not-alarm tone.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  EditorialKpiSparkline,
  type SparklineTone,
} from '@/components/editorial/kpi/EditorialKpiSparkline';
import { EditorialBandTrack } from '@/components/editorial/kpi/EditorialBandTrack';
import type { KpiZone, ZoneTone } from '@/components/editorial/kpi/zones';
import { GlassEyebrow, GlassIconBadge, GlassPanel, type GlassSubPalette } from './GlassPanel';

export type GlassKpiDeltaTone = 'positive' | 'negative' | 'neutral';

interface BaseProps {
  /** Uppercase 10-11px / 0.16em label rendered as a sub-palette gradient eyebrow. */
  eyebrow: string;
  /** Pre-formatted hero value, e.g. "+$4,213". Caller owns formatting. */
  value: string;
  /** Optional sub-text below the value (helper context). */
  helper?: ReactNode;
  /** Lucide icon component for the gradient badge gem. */
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Sub-palette per §18.7.2 money-signal row mapping. */
  subPalette: GlassSubPalette;
  /** Optional drill-down route — when provided the whole tile becomes a Link. */
  href?: string;
  ariaLabel?: string;
  /** Optional override colour for the hero value text (e.g. emerald-700 for positive cashflow). */
  valueClassName?: string;
  className?: string;
}

interface SparklineVariantProps extends BaseProps {
  variant: 'sparkline';
  series: number[];
  tone?: SparklineTone;
  delta?: { label: string; tone: GlassKpiDeltaTone };
}

interface BandVariantProps extends BaseProps {
  variant: 'band';
  zones: KpiZone[];
  zoneValue: number;
  ticks?: string[];
}

export type GlassKpiCardProps = SparklineVariantProps | BandVariantProps;

const DELTA_CLASS: Record<GlassKpiDeltaTone, string> = {
  positive: 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300',
  negative: 'bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300',
  neutral: 'bg-foreground/[0.06] text-muted-foreground ring-1 ring-foreground/10',
};

const STATUS_CLASS: Record<ZoneTone, string> = {
  slate: 'bg-foreground/[0.06] text-muted-foreground ring-1 ring-foreground/10',
  sky: 'bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300',
  emerald: 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300',
  amber: 'bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300',
  indigo: 'bg-indigo-500/12 text-indigo-700 ring-1 ring-indigo-500/20 dark:text-indigo-300',
};

export function GlassKpiCard(props: GlassKpiCardProps) {
  const { eyebrow, value, helper, icon, subPalette, href, ariaLabel, valueClassName, className } = props;

  const activeBandZone =
    props.variant === 'band'
      ? props.zones.find((z) => props.zoneValue >= z.from && props.zoneValue < z.to)
        ?? props.zones[props.zones.length - 1]
      : null;

  const inner = (
    <GlassPanel
      subPalette={subPalette}
      radius="tile"
      padding="p-5"
      hoverLift={Boolean(href)}
      className={`h-full ${className ?? ''}`}
    >
      <div className="flex h-full flex-col gap-4">
        {/* Top row: badge + eyebrow on left, delta/status pill on right */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <GlassIconBadge icon={icon} subPalette={subPalette} size="sm" />
            <GlassEyebrow subPalette={subPalette}>{eyebrow}</GlassEyebrow>
          </div>
          {props.variant === 'band' && activeBandZone && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_CLASS[activeBandZone.tone]}`}
            >
              {activeBandZone.label}
            </span>
          )}
          {props.variant === 'sparkline' && props.delta && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${DELTA_CLASS[props.delta.tone]}`}
            >
              {props.delta.label}
            </span>
          )}
        </div>

        {/* Hero value */}
        <div className="flex flex-col gap-1">
          <span
            className={`text-2xl font-semibold tabular-nums leading-none tracking-tight sm:text-[28px] ${valueClassName ?? 'text-foreground'}`}
          >
            {value}
          </span>
          {helper && <span className="text-xs leading-relaxed text-muted-foreground">{helper}</span>}
        </div>

        {/* Bottom: sparkline OR band — delegates to existing editorial primitives */}
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
      </div>
    </GlassPanel>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? eyebrow}
        className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}

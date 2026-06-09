'use client';

/**
 * GlassPairedMetricCard — §18.7.2 polished paired-metric hero.
 *
 * Same prop API as the existing `PairedMetricCard` (Copilot Assets/Debts
 * pattern), but rendered inside a `GlassPanel` with the polished sub-pattern.
 * Used as the Net Worth hero on the dashboard — gross Assets on left, gross
 * Debts on right, with a 1px vertical hairline divider between (stacks on
 * mobile below the min-[360px] breakpoint).
 *
 * Phase 45.4 (workstream 0·DG) — replaces the `PairedMetricCard` Net
 * Worth hero at `app/dashboard/page.tsx:631`. Sub-palette: sky→indigo
 * top-accent (the dashboard's overall identity); per-side icon badges
 * tinted independently — Assets emerald (positive), Debts indigo
 * (system-level diagnostic).
 *
 * Behaviour-psychology lens (§0): both gross numbers are surfaced equally
 * (you can't manage leverage you can't see) — the financial-adviser lens
 * win that drove the original PairedMetricCard pattern carries through.
 *
 * Stitch source: project 1859462351962811110, screens
 * `65f0ddfb12e34e79bed33b4af1d42140` (desktop) +
 * `55cff20dae64476fa18879fa0400592f` (mobile compact).
 */

import type { ReactNode } from 'react';
import { GlassEyebrow, GlassIconBadge, GlassPanel, type GlassSubPalette } from './GlassPanel';

export interface GlassPairedMetric {
  /** Uppercase eyebrow label, rendered in the cell's sub-palette gradient. */
  label: string;
  /** Pre-formatted hero value, e.g. "$3.9M". Caller owns formatting. */
  value: string;
  helper?: ReactNode;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Sub-palette for THIS cell's icon badge + eyebrow gradient. */
  subPalette: GlassSubPalette;
}

interface GlassPairedMetricCardProps {
  left: GlassPairedMetric;
  right: GlassPairedMetric;
  /** Sub-palette for the OUTER card top-accent strip + tinted bg. Default 'sky-indigo'. */
  cardSubPalette?: GlassSubPalette;
  /** Whole-card click target — drill-down to a detail / modal. */
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}

export function GlassPairedMetricCard({
  left,
  right,
  cardSubPalette = 'sky-indigo',
  onClick,
  ariaLabel,
  className = '',
}: GlassPairedMetricCardProps) {
  const inner = (
    <GlassPanel
      subPalette={cardSubPalette}
      radius="hero"
      padding="p-6 sm:p-8"
      hoverLift={Boolean(onClick)}
      className={`h-full ${className}`}
    >
      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-[1fr_auto_1fr] min-[360px]:gap-6 sm:gap-8">
        <MetricSide metric={left} />
        <div
          aria-hidden
          className="h-px w-full bg-foreground/10 min-[360px]:h-full min-[360px]:w-px"
        />
        <MetricSide metric={right} />
      </div>
    </GlassPanel>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {inner}
      </button>
    );
  }

  return inner;
}

function MetricSide({ metric }: { metric: GlassPairedMetric }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <GlassIconBadge icon={metric.icon} subPalette={metric.subPalette} size="sm" />
        <GlassEyebrow subPalette={metric.subPalette}>{metric.label}</GlassEyebrow>
      </div>
      <span className="text-3xl font-semibold tabular-nums leading-none tracking-tight text-foreground sm:text-[40px]">
        {metric.value}
      </span>
      {metric.helper && (
        <span className="text-xs leading-relaxed text-muted-foreground">{metric.helper}</span>
      )}
    </div>
  );
}

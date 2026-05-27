'use client';

/**
 * TimePeriodPill — segmented control for time-period selection on the
 * Money Story v2 hero. 1M / 3M / 6M / 1Y / ALL.
 *
 * Spec (from the locked Stitch reference 75f9abb1c1d54fe9baaa0e01755348cd):
 *   - 32px tall outer pill, full-pill (9999px) radius
 *   - Background: editorial-surface (ivory-tinted #F1EFE8 in light,
 *     navy-tinted in dark) — subtle, doesn't compete with the hero
 *   - Active cell: white in light / emerald-chip in dark, navy text,
 *     soft 1px navy shadow. Animated via framer-motion layout — the
 *     pill SLIDES under the active label rather than fading
 *   - Inactive cells: slate text, no background, tap target = cell
 *   - 11px / 500 font on labels
 *
 * Reduced-motion: layout animation falls back to instant snap.
 */

import { cn } from '@/lib/utils';
import { motion, LayoutGroup } from 'framer-motion';
import { useId } from 'react';

export const TIME_PERIODS = ['1M', '3M', '6M', '1Y', 'ALL'] as const;
export type TimePeriod = (typeof TIME_PERIODS)[number];

export interface TimePeriodPillProps {
  value: TimePeriod;
  onChange: (next: TimePeriod) => void;
  className?: string;
  /** Limit which periods are selectable. Defaults to all 5. */
  periods?: readonly TimePeriod[];
}

export function TimePeriodPill({
  value,
  onChange,
  className,
  periods = TIME_PERIODS,
}: TimePeriodPillProps) {
  // Unique ID per instance so multiple pills on the same screen don't
  // share their framer-motion layout group (which would visually swap
  // between them).
  const layoutId = `time-period-pill-${useId()}`;

  return (
    <LayoutGroup id={layoutId}>
      <div
        role="tablist"
        aria-label="Select time period"
        className={cn(
          'inline-flex h-8 items-center gap-0 rounded-full bg-editorial-surface p-1 ring-1 ring-editorial-divider/60',
          className
        )}
      >
        {periods.map((p) => {
          const active = p === value;
          return (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(p)}
              className={cn(
                'relative inline-flex h-6 min-w-[36px] items-center justify-center rounded-full px-2.5 text-[11px] font-medium tabular-nums-data outline-none transition-colors',
                active ? 'text-editorial-ink' : 'text-editorial-slate hover:text-editorial-ink',
                'focus-visible:ring-2 focus-visible:ring-editorial-emerald/40'
              )}
            >
              {active && (
                <motion.span
                  layoutId={`${layoutId}-pill`}
                  className="absolute inset-0 rounded-full bg-editorial-paper shadow-editorial-card ring-1 ring-editorial-divider/60"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  aria-hidden
                />
              )}
              <span className="relative z-10">{p}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

'use client';

/**
 * EditorialBandTrack — the 6px horizontal segmented zone bar with a
 * white circular thumb indicator for the Variant C "Band / Context"
 * KPI tiles. iOS Health / Apple Wallet aesthetic.
 *
 * Spec (locked from Stitch screen 2294f8b6a64d4e2db78b10275ce53e4f):
 *   - 6px tall, full-pill (9999px) outer radius
 *   - 3-4 coloured zone segments at 10% opacity background tone
 *   - White (light mode) / paper (dark mode) 10px circular thumb
 *     positioned at the user's current value, with a 2px ring matching
 *     the active zone's tone
 *   - Optional 11px zone-edge tick labels below
 *
 * Theme-aware via the editorial-* tokens (R2c).
 *
 * @see components/editorial/kpi/zones.ts for the zone constants
 */

import { cn } from '@/lib/utils';
import type { KpiZone, ZoneTone } from './zones';
import { thumbPosition } from './zones';

const TONE_BG: Record<ZoneTone, string> = {
  slate: 'bg-editorial-slate/15',
  sky: 'bg-editorial-sky/15',
  emerald: 'bg-editorial-emerald/20',
  amber: 'bg-editorial-amber/20',
  indigo: 'bg-editorial-indigo/15',
};

const TONE_RING: Record<ZoneTone, string> = {
  slate: 'ring-editorial-slate',
  sky: 'ring-editorial-sky',
  emerald: 'ring-editorial-emerald',
  amber: 'ring-editorial-amber',
  indigo: 'ring-editorial-indigo',
};

export interface EditorialBandTrackProps {
  /** Sorted, non-overlapping zone definitions covering the full domain. */
  zones: KpiZone[];
  /** Raw value to plot. Clamps to band edges if outside the domain. */
  value: number;
  /** Optional tick labels at zone boundaries (e.g. ["<30", "60", "80"]). */
  ticks?: string[];
  className?: string;
}

export function EditorialBandTrack({
  zones,
  value,
  ticks,
  className,
}: EditorialBandTrackProps) {
  if (zones.length === 0) return null;

  const min = zones[0].from;
  const max = zones[zones.length - 1].to;
  const range = max - min;
  const thumbPct = thumbPosition(value, zones);

  // Find which zone the thumb is sitting in (drives the ring colour).
  const activeZone =
    zones.find((z) => value >= z.from && value < z.to) ?? zones[zones.length - 1];

  return (
    <div className={cn('w-full', className)}>
      {/* The band itself — segmented zones flush against each other. */}
      <div
        className="relative h-1.5 w-full overflow-visible rounded-full"
        role="img"
        aria-label={`Currently in the ${activeZone.label} zone`}
      >
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {zones.map((zone, i) => {
            const widthPct = ((zone.to - zone.from) / range) * 100;
            return (
              <div
                key={i}
                className={cn('h-full', TONE_BG[zone.tone])}
                style={{ width: `${widthPct}%` }}
                aria-hidden
              />
            );
          })}
        </div>

        {/* Thumb — sits above the band, slightly larger than its height
            so it visually breaks the line and reads as a "you are here"
            marker. */}
        <div
          className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${thumbPct}%` }}
          aria-hidden
        >
          <div
            className={cn(
              'h-3 w-3 rounded-full bg-editorial-paper ring-2 ring-offset-2 ring-offset-editorial-paper shadow-editorial-card',
              TONE_RING[activeZone.tone]
            )}
          />
        </div>
      </div>

      {/* Optional tick labels — 11px slate at the boundary positions. */}
      {ticks && ticks.length > 0 && (
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums-data text-editorial-slate">
          {ticks.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

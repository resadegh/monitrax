/**
 * DeltaChip — inline pill displaying a positive (emerald) or negative
 * (amber) change. Never red — red is reserved for destructive states
 * (CLAUDE.md §0.1 financial-adviser lens + §16.4 colour rules).
 *
 * Specs:
 *   - bg:        TRAIL-spectrum colour at 10% opacity (editorial-emerald-chip / amber 10%)
 *   - text:      same colour at 100%
 *   - padding:   4px 10px, 11px font, weight 500
 *   - radius:    full-pill (9999px)
 *
 * Stitch screen reference: f723372ebbd83b197770129eff849a2 (Money Story
 * KPIs, metric tiles, paired diagnostic cards).
 */

import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

export type DeltaTone = 'positive' | 'negative' | 'neutral';

export interface DeltaChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone: DeltaTone;
  /** Show the directional arrow icon. Defaults to true. */
  showArrow?: boolean;
  children: ReactNode;
}

const TONE_CLASS: Record<DeltaTone, string> = {
  // editorial-emerald-chip flips correctly in dark mode (see globals.css
  // editorial-* tokens — light = #DCFCE7, dark = navy-tinted emerald 10%).
  positive: 'bg-editorial-emerald-chip text-editorial-emerald',
  // Amber 10% opacity background — `bg-editorial-amber/10` works in both
  // light and dark (the slash-opacity utility resolves to the same
  // editorial-amber hue at 10% alpha, contrast-safe on both ivory and
  // navy grounds). Avoids the previous hardcoded `bg-amber-100` which
  // was invisible against the dark editorial ground.
  negative: 'bg-editorial-amber/10 text-editorial-amber',
  // Slate-tone for "no change" — calm, never anxious. Same opacity
  // technique using editorial-slate so it adapts to dark mode.
  neutral: 'bg-editorial-slate/15 text-editorial-slate',
};

const TONE_ICON: Record<DeltaTone, typeof ArrowUpRight> = {
  positive: ArrowUpRight,
  negative: ArrowDownRight,
  neutral: Minus,
};

export function DeltaChip({
  tone,
  showArrow = true,
  className,
  children,
  ...rest
}: DeltaChipProps) {
  const Icon = TONE_ICON[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums-data',
        TONE_CLASS[tone],
        className
      )}
      {...rest}
    >
      {showArrow && <Icon className="h-3 w-3" strokeWidth={1.75} aria-hidden />}
      {children}
    </span>
  );
}

'use client';

/**
 * EditorialChartTooltip — the styled popover card used by every editorial
 * chart's Recharts `<Tooltip content={…}>`. Matches the editorial popover
 * spec (06_UI_UX_FOUNDATION.md §16.x): ivory→navy flipping surface,
 * 1px divider border, soft popover shadow, uppercase label row.
 *
 * Recharts v3 dropped `payload` from the exported `TooltipProps` type, so
 * each chart defines a minimal local payload type and renders this card.
 * This file owns only the visual wrapper + a labelled-row helper.
 */

import type { ReactNode } from 'react';

export interface TooltipRow {
  label: string;
  value: string;
  /** Tailwind text-colour class for the value (e.g. text-editorial-emerald). */
  tone?: string;
}

export interface EditorialChartTooltipProps {
  /** Top label (period / category). */
  title: ReactNode;
  rows: TooltipRow[];
}

export function EditorialChartTooltip({ title, rows }: EditorialChartTooltipProps) {
  return (
    <div
      className="rounded-xl border border-editorial-divider bg-editorial-paper p-3 shadow-editorial-popover"
      role="tooltip"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-editorial-slate">
        {title}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-editorial-slate">{r.label}</dt>
            <dd
              className={`text-right font-medium tabular-nums-data ${
                r.tone ?? 'text-editorial-ink'
              }`}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

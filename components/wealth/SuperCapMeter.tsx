'use client';

/**
 * SuperCapMeter — canonical contribution-cap meter pair for superannuation.
 *
 * SINGLE SOURCE OF TRUTH (CLAUDE.md §12.2) for rendering the concessional +
 * non-concessional cap meters. Consumed by:
 *   - app/dashboard/investments/super/page.tsx  (My Wealth → Superannuation)
 *   - app/dashboard/tax/page.tsx                (My Guide → Tax, Super tab)
 *
 * Before this component the cap UI was inlined only in the Tax page; the new
 * Super page would have duplicated the cap math + bar markup. Extracting it
 * here keeps the "how full is my cap?" logic in one place.
 *
 * Design rules (CLAUDE.md §18.7.2 — My Wealth glass vocabulary):
 *  - Rounded-full meter tracks + fills (no sharp corners).
 *  - Concessional fill = sky→indigo; non-concessional fill = indigo→violet.
 *  - Amber→rose ONLY when a cap is exceeded (genuine caution — money-signal
 *    rule: amber for caution, never red except true loss).
 *  - tabular-nums for every dollar figure.
 *  - Honours prefers-reduced-motion (bar grows instantly when reduced).
 *
 * This component renders ONLY the meter pair — no card chrome — so each
 * surface supplies its own container (glass card on Wealth, shadcn Card on
 * Tax). See docs/architecture/06_UI_UX_FOUNDATION.md §"SuperCapMeter".
 */

import { motion, useReducedMotion } from 'framer-motion';
import { appleEase } from '@/components/shell/motion';
import { formatCurrency } from '@/lib/utils/formatters';
import { HelpTooltip } from '@/components/help/HelpTooltip';

export interface SuperCapDatum {
  /** Amount used year-to-date, in AUD. */
  used: number;
  /** Annual cap, in AUD. */
  cap: number;
}

export interface SuperCapMeterProps {
  concessional: SuperCapDatum;
  nonConcessional: SuperCapDatum;
  /** Render the canonical HelpTooltip glossary terms next to each label. */
  showHelp?: boolean;
  className?: string;
}

export function SuperCapMeter({
  concessional,
  nonConcessional,
  showHelp = false,
  className = '',
}: SuperCapMeterProps) {
  return (
    <div className={`space-y-5 ${className}`}>
      <Meter
        label="Concessional (before-tax)"
        helpTerm={showHelp ? 'concessional-cap' : undefined}
        used={concessional.used}
        cap={concessional.cap}
        fill="from-sky-500 to-indigo-500"
        index={0}
      />
      <Meter
        label="Non-concessional (after-tax)"
        helpTerm={showHelp ? 'non-concessional-cap' : undefined}
        used={nonConcessional.used}
        cap={nonConcessional.cap}
        fill="from-indigo-500 to-violet-500"
        index={1}
      />
    </div>
  );
}

function Meter({
  label,
  helpTerm,
  used,
  cap,
  fill,
  index,
}: {
  label: string;
  helpTerm?: string;
  used: number;
  cap: number;
  fill: string;
  index: number;
}) {
  const reduced = useReducedMotion() ?? false;
  const safeCap = cap > 0 ? cap : 1;
  const exceeded = used > cap;
  const pct = Math.min(100, Math.max(0, (used / safeCap) * 100));
  const remaining = cap - used;
  const barFill = exceeded ? 'from-amber-500 to-rose-500' : fill;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
          {label}
          {helpTerm && <HelpTooltip term={helpTerm} />}
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(used)}
        </span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
        <motion.div
          aria-hidden
          className={`h-full rounded-full bg-gradient-to-r ${barFill}`}
          initial={reduced ? { width: `${pct}%` } : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.8, ease: appleEase, delay: 0.15 + 0.1 * index }}
        />
      </div>

      <p className={`mt-1.5 text-xs ${exceeded ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
        {exceeded ? (
          <>Over cap by <span className="tabular-nums">{formatCurrency(Math.abs(remaining))}</span></>
        ) : (
          <>
            <span className="tabular-nums">{formatCurrency(remaining)}</span> remaining of{' '}
            <span className="tabular-nums">{formatCurrency(cap)}</span> cap
          </>
        )}
      </p>
    </div>
  );
}

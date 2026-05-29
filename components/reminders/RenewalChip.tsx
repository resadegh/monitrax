'use client';

/**
 * RenewalChip — compact urgency pill for a single renewal reminder.
 *
 * Presentational only. ALL urgency/timing logic comes from the canonical
 * reminder engine (`lib/reminders/reminderEngine.ts`) — this component never
 * recomputes days or urgency (CLAUDE.md §12.2/§12.3 SSOT).
 *
 * Colour follows the severity vocabulary (CLAUDE.md §6.7) but tuned warm +
 * calm (behaviour-psychology §0): overdue is stated plainly, not alarmist.
 *
 * Used by: AssetTile (per-asset most-urgent), asset detail dialog, RenewalsCard.
 */

import { AlertCircle, Clock, CalendarClock } from 'lucide-react';
import type { ReminderUrgency } from '@/lib/reminders/reminderEngine';
import { renewalTimingLabel } from '@/lib/reminders/reminderEngine';

const URGENCY_STYLE: Record<
  Exclude<ReminderUrgency, 'OK'>,
  { className: string; Icon: typeof Clock }
> = {
  OVERDUE: {
    className: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/25',
    Icon: AlertCircle,
  },
  DUE_SOON: {
    className: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/25',
    Icon: Clock,
  },
  UPCOMING: {
    className: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/20',
    Icon: CalendarClock,
  },
};

export interface RenewalChipProps {
  urgency: ReminderUrgency;
  daysUntilDue: number;
  /** Optional leading label, e.g. "Rego" — keeps the chip self-explanatory. */
  label?: string;
  className?: string;
}

export function RenewalChip({ urgency, daysUntilDue, label, className = '' }: RenewalChipProps) {
  if (urgency === 'OK') return null;
  const { className: tone, Icon } = URGENCY_STYLE[urgency];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${tone} ${className}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label ? <span className="font-medium">{label}:</span> : null}
      {renewalTimingLabel(daysUntilDue)}
    </span>
  );
}

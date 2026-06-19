'use client';

/**
 * RenewalReminderCard — Phase 50 D.5a (renewal → reminder), 2026-06-19.
 *
 * The suggest→confirm card shown in the scan flow when a recognised document
 * carries a renewal/expiry date (e.g. an insurance policy's policy-end date).
 * It asks — calmly — whether the user wants a heads-up before it expires.
 *
 * AUTONOMY CONTRACT (Reza decision 2026-06-18): the AI only SUGGESTS. The
 * extracted date is PRE-FILLED but EDITABLE, the user explicitly taps "Set
 * reminder", and "Not now" always dismisses. Nothing is written until they
 * confirm. The parent (GlobalScanReceipt) performs the create.
 *
 * REUSES THE EXISTING ENGINE (§12.7): on confirm the parent creates a custom
 * `Reminder` (POST /api/reminders/custom) — a CREATE, never an update, so no
 * existing user row is clobbered (§12.11-safe). The existing reminder engine
 * (`lib/reminders/reminderEngine.ts` → computeCustomReminders) projects the new
 * dueDate into the notification bell + RenewalsCard with its 30-day "due soon"
 * window. No new engine, no schema change.
 *
 * Design (CLAUDE.md §18.7.2; Stitch project 1859462351962811110, §18.2.1):
 * in-app "My Wealth glass" vocabulary with a calm sky→teal "safety net" accent
 * — deliberately NOT emerald (reserved for money) and NOT amber/red (the expiry
 * may be a year out → no false urgency). Screens: desktop light
 * `0f82f766ccc04476bb787c84bea5c496` · desktop dark `6884dbef6feb47df85abadc5c057c9e9`
 * · mobile light `53b80bcd424a4cf68a972b832e649049` · mobile dark
 * `9a368f8ddd234f8b97deda337e4bf530`. Artefacts: `.stitch/designs/phase50-d5a-renewal/`.
 */

import { useState } from 'react';
import { CalendarCheck, Bell, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RenewalReminderCardProps {
  /** Extracted renewal/expiry date, ISO `YYYY-MM-DD`. Pre-fills the editable field. */
  renewalDate: string;
  /** What the document is, e.g. the vendor/insurer ("NRMA") or "this policy". */
  subjectLabel: string;
  /** The asset/property the user already chose in "What is this for?", if any. */
  entityName?: string | null;
  /** Create the reminder for the (possibly edited) ISO date. */
  onConfirm: (dateISO: string) => void | Promise<void>;
  /** Dismiss without creating a reminder. */
  onSkip: () => void;
  submitting?: boolean;
}

/** Format an ISO `YYYY-MM-DD` as a warm AU long date ("12 March 2027"). */
function formatAuLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function RenewalReminderCard({
  renewalDate,
  subjectLabel,
  entityName,
  onConfirm,
  onSkip,
  submitting = false,
}: RenewalReminderCardProps) {
  const [date, setDate] = useState(renewalDate);
  const [editing, setEditing] = useState(false);

  return (
    <div
      className="relative isolate overflow-hidden rounded-[22px] border border-foreground/10 bg-card/80 p-6 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.04)]"
      role="dialog"
      aria-label="Set a renewal reminder"
    >
      {/* Calm sky→teal atmospheric glow behind the badge */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-6 -z-10 h-28 w-28 rounded-full bg-gradient-to-br from-sky-400/20 to-teal-400/20 blur-[40px] dark:from-sky-400/10 dark:to-teal-400/10"
      />

      {/* Icon badge */}
      <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-500 to-teal-500 text-white shadow-md ring-1 ring-white/20">
        <CalendarCheck className="h-6 w-6" strokeWidth={1.5} />
      </span>

      {/* Eyebrow + headline + subtitle */}
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] bg-gradient-to-r from-sky-500 to-teal-500 bg-clip-text text-transparent">
        Renewal found
      </p>
      <h3 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
        Want a heads-up before this expires?
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        We spotted a renewal date on this document. Set a reminder and we&apos;ll nudge you in time.
      </p>

      {/* Detail sub-box */}
      <div className="mt-4 rounded-[12px] border border-sky-400/20 bg-sky-500/[0.04] p-3.5">
        <p className="text-sm font-medium text-foreground">{subjectLabel}</p>
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Renews on
          </p>
          {editing ? (
            <input
              type="date"
              value={date}
              autoFocus
              onChange={(e) => setDate(e.target.value)}
              onBlur={() => setEditing(false)}
              className="mt-1 w-full rounded-[10px] border border-sky-400/30 bg-background/60 px-3 py-2 text-base text-foreground outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-0.5 inline-flex items-center gap-2 text-left"
            >
              <span className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {formatAuLong(date)}
              </span>
              <span className="text-[11px] font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400">
                Edit
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Entity context */}
      <p className="mt-3 text-xs text-muted-foreground">
        {entityName ? (
          <>Remind me about <span className="font-medium text-foreground">{entityName}</span> — we&apos;ll add it to your reminders.</>
        ) : (
          <>We&apos;ll add this to your reminders.</>
        )}
      </p>

      {/* Reassurance */}
      <p className="mt-1 text-[11px] text-muted-foreground/80">
        We&apos;ll remind you about 30 days before — one less thing to carry.
      </p>

      {/* Actions */}
      <button
        type="button"
        onClick={() => onConfirm(date)}
        disabled={submitting || !date}
        className={cn(
          'mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px]',
          'bg-gradient-to-r from-sky-500 to-teal-500 px-5 text-[14px] font-semibold text-white',
          'shadow-md shadow-sky-500/25 transition-transform active:scale-[0.99] disabled:opacity-60',
        )}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" strokeWidth={1.5} />}
        {submitting ? 'Setting reminder…' : 'Set reminder'}
        {!submitting && <ChevronRight className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={onSkip}
        disabled={submitting}
        className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-[14px] text-[13px] font-medium text-muted-foreground hover:bg-foreground/5 disabled:opacity-60"
      >
        Not now
      </button>
    </div>
  );
}

export default RenewalReminderCard;

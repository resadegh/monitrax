'use client';

/**
 * NotificationBell — the dashboard top-bar notification centre (Phase 21.5 R1
 * PR2). Replaces the previously-dead bell button in `<EditorialTopBar>`.
 *
 * Self-contained: consumes the shared `useReminders` hook (CLAUDE.md §12.2/
 * §12.3 SSOT — same data + actions as `<RenewalsCard>`), shows a count badge,
 * and opens a compact panel of surfaced reminders with inline snooze (7d) +
 * dismiss. Built on the already-approved `DropdownMenu` primitive (no new
 * popover dependency — §12.7 / §13.8).
 *
 * Behaviour-psychology (§0): the badge tone is calm — amber for upcoming work,
 * rose only when something is actually overdue. The panel celebrates "all
 * caught up" rather than nagging. Acting on a row removes it optimistically.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Car, ShieldCheck, Building2, Landmark, Link2, Clock, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RenewalChip } from '@/components/reminders/RenewalChip';
import { useReminders } from '@/hooks/useReminders';
import type { ReminderCategory } from '@/lib/reminders/reminderEngine';

const CATEGORY_ICON: Record<ReminderCategory, typeof Car> = {
  VEHICLE: Car,
  WARRANTY: ShieldCheck,
  PROPERTY: Building2,
  LOAN: Landmark,
  CONSENT: Link2,
};

export function NotificationBell() {
  const { reminders, act } = useReminders();
  const [open, setOpen] = useState(false);

  const count = reminders?.length ?? 0;
  const hasOverdue = !!reminders?.some((r) => r.urgency === 'OVERDUE');
  const badgeTone = hasOverdue ? 'bg-rose-500' : 'bg-amber-500';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={count > 0 ? `Notifications (${count})` : 'Notifications'}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-editorial-slate transition-colors hover:bg-editorial-warm hover:text-editorial-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-editorial-divider"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {count > 0 && (
          <span
            className={`absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${badgeTone}`}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {count > 0 && (
            <span className="text-xs text-muted-foreground">
              {count === 1 ? '1 thing coming up' : `${count} things coming up`}
            </span>
          )}
        </div>

        {count === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">
              We&apos;ll let you know when a renewal is coming due.
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1">
            {reminders!.map((r) => {
              const Icon = CATEGORY_ICON[r.category];
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-2 py-2 transition-colors hover:bg-muted/50"
                >
                  <Link
                    href={r.href}
                    onClick={() => setOpen(false)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.entityName}
                        <span className="font-normal text-muted-foreground"> · {r.label}</span>
                      </p>
                      <RenewalChip urgency={r.urgency} daysUntilDue={r.daysUntilDue} />
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label="Snooze 7 days"
                      title="Snooze 7 days"
                      onClick={() => act(r, 'snooze', 7)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Clock className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss"
                      title="Dismiss"
                      onClick={() => act(r, 'dismiss')}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

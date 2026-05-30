'use client';

/**
 * RenewalsCard — self-contained "Renewals & reminders" island (Phase 21.5).
 *
 * Renders the surfaced renewal feed (vehicle rego/CTP/insurance, warranty,
 * property rates/insurance/strata/lease, loan fixed-rate expiry, bank-consent
 * expiry). Self-hides while loading and when there is nothing to surface, so
 * it can be dropped onto any page with zero data plumbing.
 *
 * Data plumbing lives in the shared `useReminders` hook (CLAUDE.md §12.2/§12.3
 * SSOT) — also consumed by `<NotificationBell>`. ALL reminder logic is owned by
 * the canonical engine (`lib/reminders/reminderEngine.ts`) + the thin
 * `/api/reminders` routes; this component is presentational.
 *
 * Behaviour-psychology (§0): calm + actionable, never a wall of alarm. Overdue
 * surfaces first, every row leads somewhere (go fix it) and carries a quiet
 * action menu — snooze 7/30 days, mark done, or dismiss (Tier 2). Acting on a
 * row removes it optimistically; the card vanishes entirely when you're all
 * caught up — a quiet win, not an endless nag.
 *
 * Mounted on: app/dashboard/assets/page.tsx, app/dashboard/page.tsx (Home).
 */

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BellRing, Car, ShieldCheck, Building2, Landmark, Link2, Pin, Download, ChevronRight, MoreHorizontal, Clock, Check, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RenewalChip } from '@/components/reminders/RenewalChip';
import { useReminders } from '@/hooks/useReminders';
import type { ReminderCategory, RenewalReminder } from '@/lib/reminders/reminderEngine';

const CATEGORY_ICON: Record<ReminderCategory, typeof Car> = {
  VEHICLE: Car,
  WARRANTY: ShieldCheck,
  PROPERTY: Building2,
  LOAN: Landmark,
  CONSENT: Link2,
  CUSTOM: Pin,
  IMPORT: Download,
};

/** Icon + name/label + optional subtitle + urgency chip. Shared by the
 *  navigable (Link) and non-navigable (custom) row variants. */
function ReminderRowBody({ reminder: r, Icon }: { reminder: RenewalReminder; Icon: typeof Car }) {
  return (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {r.entityName}
          {r.label && <span className="font-normal text-muted-foreground"> · {r.label}</span>}
        </p>
        {r.provider && <p className="truncate text-xs text-muted-foreground">{r.provider}</p>}
      </div>
      <RenewalChip urgency={r.urgency} daysUntilDue={r.daysUntilDue} />
    </>
  );
}

export interface RenewalsCardProps {
  /** Heading; defaults to "Renewals & reminders". */
  title?: string;
  /** Max rows to show; remaining count is summarised. Default 6. */
  limit?: number;
  className?: string;
}

export function RenewalsCard({
  title = 'Renewals & reminders',
  limit = 6,
  className = '',
}: RenewalsCardProps) {
  const { reminders, act } = useReminders();

  // Self-hide while loading and when nothing to surface.
  if (!reminders || reminders.length === 0) return null;

  const shown = reminders.slice(0, limit);
  const overflow = reminders.length - shown.length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-amber-500" />
          {title}
        </CardTitle>
        <CardDescription>
          {reminders.length === 1
            ? '1 thing coming up'
            : `${reminders.length} things coming up`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {shown.map((r) => {
          const Icon = CATEGORY_ICON[r.category];
          return (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              {/* Main region — navigates to the entity when there's a
                  destination. Custom reminders have no entity page (empty href)
                  → non-navigable. The action menu is a sibling (not nested) so
                  it never triggers the link. */}
              {r.href ? (
                <Link href={r.href} className="flex min-w-0 flex-1 items-center gap-3">
                  <ReminderRowBody reminder={r} Icon={Icon} />
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ReminderRowBody reminder={r} Icon={Icon} />
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Reminder actions"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => act(r, 'snooze', 7)}>
                    <Clock className="mr-2 h-4 w-4" /> Snooze 7 days
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => act(r, 'snooze', 30)}>
                    <Clock className="mr-2 h-4 w-4" /> Snooze 30 days
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => act(r, 'done')}>
                    <Check className="mr-2 h-4 w-4" /> Mark done
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => act(r, 'dismiss')}>
                    <X className="mr-2 h-4 w-4" /> Dismiss
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {r.href && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </div>
          );
        })}
        {overflow > 0 && (
          <p className="pt-1 text-center text-xs text-muted-foreground">
            +{overflow} more
          </p>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

/**
 * RenewalsCard — self-contained "Renewals & reminders" island (Phase 21.5).
 *
 * Fetches `GET /api/reminders` itself and renders the surfaced renewal feed
 * (vehicle rego/CTP/insurance, warranty, loan fixed-rate expiry, bank-consent
 * expiry). Self-hides while loading and when there is nothing to surface, so
 * it can be dropped onto any page with zero data plumbing.
 *
 * ALL reminder logic is owned by the canonical engine
 * (`lib/reminders/reminderEngine.ts`) and served by the thin `/api/reminders`
 * route — this component is presentational (CLAUDE.md §12.2/§12.3 SSOT).
 *
 * Behaviour-psychology (§0): calm + actionable, never a wall of alarm. Overdue
 * surfaces first, every row has one clear action (go fix it), and the card
 * vanishes entirely when you're all caught up — a quiet win, not an empty
 * nag.
 *
 * Mounted on: app/dashboard/assets/page.tsx, app/dashboard/page.tsx (Home).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BellRing, Car, ShieldCheck, Landmark, Link2, ChevronRight } from 'lucide-react';
import { RenewalChip } from '@/components/reminders/RenewalChip';
import type { RenewalReminder, ReminderCategory } from '@/lib/reminders/reminderEngine';

const CATEGORY_ICON: Record<ReminderCategory, typeof Car> = {
  VEHICLE: Car,
  WARRANTY: ShieldCheck,
  LOAN: Landmark,
  CONSENT: Link2,
};

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
  const { token } = useAuth();
  const [reminders, setReminders] = useState<RenewalReminder[] | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/reminders', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!active) return;
        if (res.ok) {
          const body = await res.json();
          setReminders(Array.isArray(body?.data) ? body.data : []);
        } else {
          setReminders([]);
        }
      } catch {
        if (active) setReminders([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

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
            <Link
              key={r.id}
              href={r.href}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {r.entityName}
                  <span className="font-normal text-muted-foreground"> · {r.label}</span>
                </p>
                {r.provider && (
                  <p className="truncate text-xs text-muted-foreground">{r.provider}</p>
                )}
              </div>
              <RenewalChip urgency={r.urgency} daysUntilDue={r.daysUntilDue} />
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
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

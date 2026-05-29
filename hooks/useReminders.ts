'use client';

/**
 * useReminders — shared client hook for the in-app reminder feed (Phase 21.5).
 *
 * Single source of truth for "fetch the surfaced reminders + act on one"
 * (CLAUDE.md §12.2/§12.3). Both `<RenewalsCard>` (Home / Assets island) and
 * `<NotificationBell>` (top-bar centre) consume this — neither re-implements
 * the fetch or the snooze/dismiss POST.
 *
 * All reminder/urgency logic stays in the canonical engine + the thin
 * `/api/reminders` routes; this hook is just the client-side data plumbing.
 * Acting on a reminder removes it optimistically and persists via
 * `POST /api/reminders/state`; the next load re-fetches truth (a failed POST
 * self-heals then).
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import type { RenewalReminder } from '@/lib/reminders/reminderEngine';

/** Action accepted by POST /api/reminders/state (excludes 'restore'). */
export type ReminderAction = 'snooze' | 'dismiss' | 'done';

/** Input for a user-created custom reminder (R1 PR2b). */
export interface CustomReminderInput {
  title: string;
  dueDate: string;
  note?: string;
}

export interface UseRemindersResult {
  /** Surfaced + still-ACTIVE reminders, or null while loading. */
  reminders: RenewalReminder[] | null;
  /** Snooze / dismiss / done one reminder (optimistic + persisted). */
  act: (reminder: RenewalReminder, action: ReminderAction, snoozeDays?: number) => void;
  /** Create a custom reminder; resolves true on success, then reloads the feed. */
  createCustom: (input: CustomReminderInput) => Promise<boolean>;
  /** Re-fetch the feed (e.g. after creating a custom reminder). */
  reload: () => void;
}

export function useReminders(): UseRemindersResult {
  const { token } = useAuth();
  const [reminders, setReminders] = useState<RenewalReminder[] | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

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
  }, [token, nonce]);

  const act = useCallback(
    (reminder: RenewalReminder, action: ReminderAction, snoozeDays?: number) => {
      setReminders((prev) => (prev ? prev.filter((r) => r.id !== reminder.id) : prev));
      if (!token) return;
      void fetch('/api/reminders/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          reminderKey: reminder.id,
          dueDate: reminder.dueDate,
          action,
          ...(snoozeDays ? { snoozeDays } : {}),
        }),
      }).catch(() => {});
    },
    [token]
  );

  const createCustom = useCallback(
    async (input: CustomReminderInput): Promise<boolean> => {
      if (!token) return false;
      try {
        const res = await fetch('/api/reminders/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(input),
        });
        if (res.ok) {
          reload();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [token, reload]
  );

  return { reminders, act, createCustom, reload };
}

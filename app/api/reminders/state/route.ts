import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';

/**
 * POST /api/reminders/state — set the user's action on a reminder (Phase 21.5
 * Tier 2): snooze / dismiss / done / restore.
 *
 * State is keyed by the canonical engine's synthetic reminder id
 * (`${entityId}:${sourceType}`) + the due-date cycle it applies to. The GET
 * `/api/reminders` feed merges this state via the pure engine
 * (`applyReminderStates`) — this route only persists the user's choice; it
 * holds NO reminder/urgency logic (CLAUDE.md §12.2/§12.3 SSOT).
 *
 * No financial / CDR data flows through here (§13.3) — only a synthetic key,
 * a status, and dates. This is UI-preference state (same class as the
 * banner-dismiss flags on `UserPreference`), so it is not audit-logged.
 */

/** Default snooze length when the caller doesn't specify one. */
const DEFAULT_SNOOZE_DAYS = 7;
const MAX_SNOOZE_DAYS = 365;

type ReminderAction = 'snooze' | 'dismiss' | 'done' | 'restore';

export const POST = withPermission('entity.write', async (request, auth) => {
  try {
    const body = await request.json();
    const reminderKey: unknown = body?.reminderKey;
    const dueDate: unknown = body?.dueDate;
    const action: unknown = body?.action;
    const snoozeDays: unknown = body?.snoozeDays;

    if (typeof reminderKey !== 'string' || !reminderKey) {
      return NextResponse.json({ error: 'reminderKey is required' }, { status: 400 });
    }
    if (action !== 'snooze' && action !== 'dismiss' && action !== 'done' && action !== 'restore') {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 });
    }

    const userId = auth.userId;

    // Restore = clear any state (revert to ACTIVE). Safe destructive write
    // (§12.11): scoped to the caller's own synthetic-key row, which only this
    // code path ever creates — no user-entered data, no broad match.
    if (action === 'restore') {
      await prisma.reminderState.deleteMany({ where: { userId, reminderKey } });
      return NextResponse.json({ success: true, state: 'ACTIVE' });
    }

    // snooze / dismiss / done all need the due-date cycle they apply to.
    const dueDateObj = typeof dueDate === 'string' || dueDate instanceof Date ? new Date(dueDate as string) : null;
    if (!dueDateObj || Number.isNaN(dueDateObj.getTime())) {
      return NextResponse.json({ error: 'valid dueDate is required' }, { status: 400 });
    }

    let status: 'SNOOZED' | 'DISMISSED' | 'DONE';
    let snoozedUntil: Date | null = null;
    if (action === 'snooze') {
      status = 'SNOOZED';
      const days = typeof snoozeDays === 'number' && snoozeDays > 0
        ? Math.min(Math.round(snoozeDays), MAX_SNOOZE_DAYS)
        : DEFAULT_SNOOZE_DAYS;
      snoozedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else {
      status = action === 'dismiss' ? 'DISMISSED' : 'DONE';
    }

    // Upsert keyed on (userId, reminderKey). The update branch only ever
    // rewrites a row THIS code path created (synthetic key + status/date
    // columns owned exclusively here) — §12.11 safe, no clobber of user data.
    const state = await prisma.reminderState.upsert({
      where: { userId_reminderKey: { userId, reminderKey } },
      create: { userId, reminderKey, dueDate: dueDateObj, status, snoozedUntil },
      update: { dueDate: dueDateObj, status, snoozedUntil },
      select: { status: true, snoozedUntil: true },
    });

    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    console.error('Set reminder state error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

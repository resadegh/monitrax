import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';

/**
 * POST /api/reminders/custom — create a user-defined reminder (Phase 21.5 R1
 * PR2b). The created reminder is projected into the unified `GET /api/reminders`
 * feed by the canonical engine (`computeCustomReminders`) — this route only
 * persists; it holds no reminder/urgency logic (CLAUDE.md §12.2/§12.3).
 *
 * No financial / CDR data (§13.3): a title, a due date, and an optional note.
 * UI-content create — not audit-logged (same class as the reminder-state route).
 */

const MAX_TITLE = 120;
const MAX_NOTE = 500;

export const POST = withPermission('entity.write', async (request, auth) => {
  try {
    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    const dueDateRaw = body?.dueDate;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    const dueDate =
      typeof dueDateRaw === 'string' || dueDateRaw instanceof Date ? new Date(dueDateRaw as string) : null;
    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      return NextResponse.json({ error: 'valid dueDate is required' }, { status: 400 });
    }

    const reminder = await prisma.reminder.create({
      data: {
        userId: auth.userId,
        title: title.slice(0, MAX_TITLE),
        dueDate,
        note: note ? note.slice(0, MAX_NOTE) : null,
      },
      select: { id: true, title: true, dueDate: true, note: true },
    });

    return NextResponse.json(reminder, { status: 201 });
  } catch (error) {
    console.error('Create custom reminder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

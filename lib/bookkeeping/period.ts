/**
 * Phase 42 PR1 — Bookkeeping Period state machine.
 *
 * "Monthly review milestone, NOT statutory close." Per spec §3 D-42-3 +
 * §6 (engagement spec), the period exists to:
 *   1. Give the user a satisfying *I'm caught up for October* milestone
 *      (Bandura small wins, Duolingo lesson-loop)
 *   2. Provide an audit anchor — when did the user last confirm the
 *      monthly view was correct?
 *   3. Optionally LOCK a month before handing the Tax Pack to the
 *      accountant (rare, opt-in, edits blocked at API)
 *
 * Three statuses:
 *   OPEN       — default; nothing reviewed; edits unrestricted
 *   REVIEWED   — user confirmed all transactions categorised; edits
 *                still allowed (the audit log records the post-review
 *                change)
 *   LOCKED     — explicit lock (rare); edits BLOCKED at the API layer
 *                until unlocked
 *
 * This is NOT a statutory period close. Xero/MYOB owns the formal close;
 * Phase 42 stays consumer-side per CLAUDE.md §0 + the §1 boundary in
 * `PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md`.
 */

import prisma from '@/lib/db';
import type { BookkeepingPeriod, BookkeepingPeriodStatus } from '@prisma/client';

/**
 * Normalise a date (or 'YYYY-MM' / 'YYYY-MM-DD' string) to the first
 * day of its UTC month. The canonical key for `BookkeepingPeriod.periodMonth`.
 */
export function toPeriodMonthKey(input: Date | string): Date {
  if (typeof input === 'string') {
    // Accept "2026-10" or "2026-10-XX" — only the year + month matter.
    const match = input.match(/^(\d{4})-(\d{2})/);
    if (!match) {
      throw new Error(`Invalid period month string: ${input}`);
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10) - 1;
    return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  }
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Format a period-month Date back into the "YYYY-MM" wire format used
 * by the API.
 */
export function formatPeriodMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get-or-create a BookkeepingPeriod row. Idempotent.
 *
 * Recomputes `totalTransactionCount` + `reviewedTransactionCount` from
 * the canonical UnifiedTransaction table on every call so the row reflects
 * current ledger state. Never mutates other fields on existing rows.
 */
export async function getOrCreatePeriod(
  userId: string,
  periodMonth: Date
): Promise<BookkeepingPeriod> {
  const periodMonthKey = toPeriodMonthKey(periodMonth);
  const periodEnd = new Date(
    Date.UTC(periodMonthKey.getUTCFullYear(), periodMonthKey.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  );

  const [totalCount, reviewedCount] = await Promise.all([
    prisma.unifiedTransaction.count({
      where: {
        userId,
        date: { gte: periodMonthKey, lt: periodEnd },
      },
    }),
    prisma.unifiedTransaction.count({
      where: {
        userId,
        date: { gte: periodMonthKey, lt: periodEnd },
        userCorrectedCategory: true,
      },
    }),
  ]);

  // Upsert with read-modify semantics. We don't overwrite `status`,
  // `reviewedAt`, or `lockedAt` on existing rows — those are only
  // mutated by the explicit transitions below.
  const existing = await prisma.bookkeepingPeriod.findUnique({
    where: { userId_periodMonth: { userId, periodMonth: periodMonthKey } },
  });

  if (existing) {
    return prisma.bookkeepingPeriod.update({
      where: { id: existing.id },
      data: { totalTransactionCount: totalCount, reviewedTransactionCount: reviewedCount },
    });
  }

  return prisma.bookkeepingPeriod.create({
    data: {
      userId,
      periodMonth: periodMonthKey,
      status: 'OPEN',
      totalTransactionCount: totalCount,
      reviewedTransactionCount: reviewedCount,
    },
  });
}

/**
 * Mark a period as REVIEWED. Idempotent — calling twice in a row is a
 * no-op except for refreshing the count fields. Cannot transition out
 * of LOCKED via this path.
 */
export async function markPeriodReviewed(
  userId: string,
  periodMonth: Date
): Promise<{ period: BookkeepingPeriod; transitioned: boolean }> {
  const period = await getOrCreatePeriod(userId, periodMonth);

  if (period.status === 'LOCKED') {
    return { period, transitioned: false };
  }

  if (period.status === 'REVIEWED') {
    return { period, transitioned: false };
  }

  const updated = await prisma.bookkeepingPeriod.update({
    where: { id: period.id },
    data: { status: 'REVIEWED', reviewedAt: new Date() },
  });
  return { period: updated, transitioned: true };
}

/**
 * Lock a period. Cannot be called on a non-existent period; caller must
 * have reviewed first. Returns transitioned=false if the period is
 * already LOCKED.
 */
export async function lockPeriod(
  userId: string,
  periodMonth: Date
): Promise<{ period: BookkeepingPeriod; transitioned: boolean }> {
  const period = await getOrCreatePeriod(userId, periodMonth);

  if (period.status === 'LOCKED') {
    return { period, transitioned: false };
  }

  const updated = await prisma.bookkeepingPeriod.update({
    where: { id: period.id },
    data: { status: 'LOCKED', lockedAt: new Date() },
  });
  return { period: updated, transitioned: true };
}

/**
 * Unlock a previously locked period. Status returns to REVIEWED (the
 * lock implies the user had already confirmed the review — a fresh
 * review is not required).
 */
export async function unlockPeriod(
  userId: string,
  periodMonth: Date
): Promise<{ period: BookkeepingPeriod; transitioned: boolean }> {
  const period = await getOrCreatePeriod(userId, periodMonth);

  if (period.status !== 'LOCKED') {
    return { period, transitioned: false };
  }

  const updated = await prisma.bookkeepingPeriod.update({
    where: { id: period.id },
    data: { status: 'REVIEWED', lockedAt: null },
  });
  return { period: updated, transitioned: true };
}

/**
 * Check whether a period is currently editable. Used by the
 * UnifiedTransaction PATCH route to refuse mutations on LOCKED months.
 */
export async function isPeriodEditable(userId: string, txDate: Date): Promise<boolean> {
  const periodMonthKey = toPeriodMonthKey(txDate);
  const period = await prisma.bookkeepingPeriod.findUnique({
    where: { userId_periodMonth: { userId, periodMonth: periodMonthKey } },
    select: { status: true },
  });
  return !period || period.status !== 'LOCKED';
}

/**
 * Convenience — list all periods for a user, ordered most-recent-first.
 * Used by the UI to render the per-month review history strip.
 */
export async function listPeriods(userId: string): Promise<BookkeepingPeriod[]> {
  return prisma.bookkeepingPeriod.findMany({
    where: { userId },
    orderBy: { periodMonth: 'desc' },
  });
}

export type { BookkeepingPeriod, BookkeepingPeriodStatus };

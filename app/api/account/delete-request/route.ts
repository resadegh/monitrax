/**
 * Account Deletion (Right to Erasure)
 *
 * Privacy Act 1988 (Cth) APP 11.2 + CDR §3.2 right-to-deletion
 * compliance. Implemented as a 30-day soft-delete grace period: when
 * the user requests deletion, deletionRequestedAt is set and
 * deletionScheduledFor = now() + 30 days. The user can cancel any
 * time before the scheduled date.
 *
 * Hard-deletion happens out-of-band on the scheduled date via Cloud
 * Scheduler (queued separately as part of CDR §3.2 lifecycle work)
 * — this route only flips the flags + writes the audit trail.
 *
 * POST   — request deletion (sets the 30-day timer)
 * DELETE — cancel pending deletion (clears the timer)
 * GET    — read the current deletion state
 *
 * CLAUDE.md §12.11 destructive-write checklist:
 *   1. WHERE clause matches: { id: auth.userId } — only the requesting
 *      user's own row.
 *   2. Columns overwritten: deletionRequestedAt, deletionScheduledFor.
 *      Both nullable; previous value is restored on cancel.
 *   3. Guard: auth.userId comes from the verified bearer token, never
 *      from request body. The user can only ever flag their OWN row.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';

const GRACE_PERIOD_DAYS = 30;

export const GET = withPermission('account.read', async (_request, auth) => {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { deletionRequestedAt: true, deletionScheduledFor: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    pendingDeletion: !!user.deletionRequestedAt,
    deletionRequestedAt: user.deletionRequestedAt,
    deletionScheduledFor: user.deletionScheduledFor,
    gracePeriodDays: GRACE_PERIOD_DAYS,
  });
});

export const POST = withPermission(
  'account.delete',
  async (request, auth) => {
    const now = new Date();
    const scheduledFor = new Date(
      now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    );

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        deletionRequestedAt: now,
        deletionScheduledFor: scheduledFor,
      },
      select: { deletionRequestedAt: true, deletionScheduledFor: true },
    });

    await createAuditLog({
      userId: auth.userId,
      action: 'USER_DELETION_REQUESTED',
      status: 'SUCCESS',
      entityType: 'User',
      entityId: auth.userId,
      ipAddress:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        gracePeriodDays: GRACE_PERIOD_DAYS,
        scheduledFor: scheduledFor.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      pendingDeletion: true,
      deletionRequestedAt: updated.deletionRequestedAt,
      deletionScheduledFor: updated.deletionScheduledFor,
      gracePeriodDays: GRACE_PERIOD_DAYS,
    });
  }
);

export const DELETE = withPermission(
  'account.delete',
  async (request, auth) => {
    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        deletionRequestedAt: null,
        deletionScheduledFor: null,
      },
      select: { deletionRequestedAt: true, deletionScheduledFor: true },
    });

    await createAuditLog({
      userId: auth.userId,
      action: 'USER_DELETION_CANCELLED',
      status: 'SUCCESS',
      entityType: 'User',
      entityId: auth.userId,
      ipAddress:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      pendingDeletion: false,
      deletionRequestedAt: updated.deletionRequestedAt,
      deletionScheduledFor: updated.deletionScheduledFor,
    });
  }
);

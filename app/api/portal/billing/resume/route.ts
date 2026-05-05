/**
 * Phase 32C PR6 — Reverse a scheduled cancellation.
 *
 * POST /api/portal/billing/resume
 *      Body: { organizationId }
 *
 * Sets `cancel_at_period_end = false` on the Stripe subscription. The
 * org's billing continues normally on the next renewal.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  resumeSubscription,
  StripeBillingServiceError,
} from '@/lib/services/stripeBillingService';
import { createAuditLog } from '@/lib/security/auditLog';

export const POST = withPermission('org.update', async (request, auth) => {
  let body: { organizationId?: string };
  try {
    body = (await request.json()) as { organizationId?: string };
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }
  if (!body.organizationId) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'organizationId required' } },
      { status: 400 },
    );
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: auth.userId, organizationId: body.organizationId, isActive: true },
    select: { role: true },
  });
  if (!membership || membership.role !== 'OWNER') {
    return NextResponse.json(
      { success: false, error: { code: 'INSUFFICIENT_ROLE', message: 'Only the Org owner can manage billing' } },
      { status: 403 },
    );
  }

  try {
    const updated = await resumeSubscription(body.organizationId);
    createAuditLog({
      userId: auth.userId,
      organizationId: body.organizationId,
      action: 'BILLING_SUBSCRIPTION_UPDATED',
      entityType: 'STRIPE_SUBSCRIPTION',
      entityId: updated.id,
      metadata: { cancelAtPeriodEnd: false, resumed: true },
    }).catch(() => {});
    return NextResponse.json({ success: true, data: { subscription: updated } });
  } catch (err) {
    if (err instanceof StripeBillingServiceError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 500;
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: err instanceof Error ? err.message : 'Resume failed' } },
      { status: 500 },
    );
  }
});

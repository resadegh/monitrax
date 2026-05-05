/**
 * Phase 32C PR6 — Start a Stripe Checkout session.
 *
 * POST /api/portal/billing/subscribe
 *      Body: { organizationId, planTier: 'STUDIO' | 'PRACTICE', successUrl?, cancelUrl? }
 *
 * Returns `{ url }` — a Stripe-hosted Checkout URL the caller redirects to.
 * Only PORTAL_OWNER can initiate (commercial decision; mirrors the
 * marketplace listing submit-only-OWNER guardrail in PR4a).
 *
 * ENTERPRISE is not self-serve — the UI hides the button and routes the
 * user to a contact-sales flow.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  createCheckoutSession,
  StripeBillingServiceError,
} from '@/lib/services/stripeBillingService';
import { createAuditLog } from '@/lib/security/auditLog';

interface SubscribeBody {
  organizationId: string;
  planTier: 'STUDIO' | 'PRACTICE';
  successUrl?: string;
  cancelUrl?: string;
}

export const POST = withPermission('org.update', async (request, auth) => {
  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }

  if (!body.organizationId || !body.planTier) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'organizationId and planTier required' } },
      { status: 400 },
    );
  }

  // Caller must be PORTAL_OWNER on this org
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

  // Resolve the owner's email for Stripe customer creation
  const owner = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true },
  });
  if (!owner?.email) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Owner email is missing' } },
      { status: 400 },
    );
  }

  try {
    const result = await createCheckoutSession({
      organizationId: body.organizationId,
      ownerEmail: owner.email,
      planTier: body.planTier,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });

    createAuditLog({
      userId: auth.userId,
      organizationId: body.organizationId,
      action: 'BILLING_CHECKOUT_STARTED',
      entityType: 'STRIPE_CUSTOMER',
      entityId: result.customerId,
      metadata: { planTier: body.planTier },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof StripeBillingServiceError) {
      const status =
        err.code === 'NOT_CONFIGURED' ? 503
          : err.code === 'INVALID_INPUT' ? 400
          : 500;
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});

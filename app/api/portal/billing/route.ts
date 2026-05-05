/**
 * Phase 32C PR6 — Org billing status.
 *
 * GET /api/portal/billing?organizationId=...
 *
 * Returns the org's current Stripe subscription state (or null if not yet
 * subscribed), plus the resolved canonical PlanTier from the live
 * resolution path. Used by the /portal/billing UI.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  getCustomerForOrg,
  getSubscriptionStatus,
  isStripeConfigured,
} from '@/lib/services/stripeBillingService';
import { resolvePlanTierForOrg } from '@/lib/portal/planTier';

export const GET = withPermission('org.read', async (request, auth) => {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'organizationId required' } },
      { status: 400 },
    );
  }

  // Verify caller is an active member of this org
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: auth.userId, organizationId, isActive: true },
    select: { role: true },
  });
  if (!membership) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_A_MEMBER', message: 'Not a member of this organisation' } },
      { status: 403 },
    );
  }

  const [subscription, customer, planTier] = await Promise.all([
    getSubscriptionStatus(organizationId),
    getCustomerForOrg(organizationId),
    resolvePlanTierForOrg(organizationId),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      configured: isStripeConfigured(),
      planTier,
      subscription,
      customer: customer ? { stripeCustomerId: customer.stripeCustomerId, email: customer.email, isTestMode: customer.isTestMode } : null,
    },
  });
});

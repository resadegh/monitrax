/**
 * Phase 32C PR6b — Lead-fee invoice history.
 *
 * GET /api/portal/billing/invoices?organizationId=...
 *
 * Returns the org's lead-fee invoice history (per-accepted-request charges).
 * Most-recent first. Subscription invoices are NOT returned here — they're
 * fetched directly from Stripe by the billing UI when needed.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { listLeadFeeInvoicesForOrg } from '@/lib/services/stripeBillingService';

export const GET = withPermission('org.read', async (request, auth) => {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'organizationId required' } },
      { status: 400 },
    );
  }
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: auth.userId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_A_MEMBER', message: 'Not a member of this organisation' } },
      { status: 403 },
    );
  }
  const items = await listLeadFeeInvoicesForOrg(organizationId);
  return NextResponse.json({ success: true, data: { items } });
});

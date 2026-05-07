/**
 * Phase 42 PR5 — Vendor card API.
 *
 * GET /api/bookkeeping/vendors/[id] — full vendor card data:
 *   - vendor row
 *   - annual totals (12-month trailing)
 *   - related properties (any property with ≥1 transaction tagged
 *     to this vendor in the window)
 *   - linked documents (contractDocumentId only at v1)
 *   - cancel URL (from registry; surfaces in PR6 engagement layer)
 *
 * Per CLAUDE.md §0 architect lens — the route handler is THIN; all
 * aggregation is in `lib/bookkeeping/vendor.ts`.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { getVendorAnnualTotals, lookupCancelUrl, normaliseVendorName } from '@/lib/bookkeeping/vendor';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>('transaction.read', async (_request, auth, context) => {
  const { id } = await context!.params;

  const vendor = await prisma.vendor.findFirst({
    where: { id, userId: auth.userId },
  });
  if (!vendor) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } },
      { status: 404 }
    );
  }

  const totals = await getVendorAnnualTotals(auth.userId, id);

  // Related properties — any property linked to a transaction whose
  // merchantStandardised matches this vendor in the period.
  const propertyIds = (
    await prisma.unifiedTransaction.findMany({
      where: {
        userId: auth.userId,
        propertyId: { not: null },
        OR: [
          { merchantStandardised: { equals: vendor.name, mode: 'insensitive' } },
          { merchantRaw: { contains: vendor.name, mode: 'insensitive' } },
        ],
      },
      select: { propertyId: true },
      distinct: ['propertyId'],
      take: 20,
    })
  )
    .map((row) => row.propertyId)
    .filter((p): p is string => p != null);
  const properties = propertyIds.length
    ? await prisma.property.findMany({
        where: { id: { in: propertyIds }, userId: auth.userId },
        select: { id: true, name: true },
      })
    : [];

  // Linked contract document if any.
  const contract = vendor.contractDocumentId
    ? await prisma.document.findUnique({
        where: { id: vendor.contractDocumentId },
        select: { id: true, filename: true, category: true },
      })
    : null;

  // Cancel URL — vendor's own override OR catalog default keyed by
  // normalised name.
  const cancelUrl = vendor.cancelUrl ?? lookupCancelUrl(vendor.normalisedName.replace(/\s+/g, ''));

  return NextResponse.json({
    success: true,
    data: {
      vendor,
      totals,
      relatedProperties: properties,
      contract,
      cancelUrl,
    },
  });
});

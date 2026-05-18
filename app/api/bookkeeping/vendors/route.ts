/**
 * Phase 42 PR5 — Vendor list API.
 *
 * GET /api/bookkeeping/vendors                       — list the calling user's vendors
 * GET /api/bookkeeping/vendors?merchantStandardised=X  — Phase 42 PR 5.6: lookup by merchant
 *
 * Lightweight: returns just the Vendor rows. The expensive
 * annual-totals aggregator lives on the per-id endpoint to avoid
 * scanning the whole transaction ledger on every list render.
 *
 * Phase 42 PR 5.6 (2026-05-18): added `?merchantStandardised=` query
 * support so the `<VendorCardDrawer>` (opened from a transaction
 * row) can resolve a normalised merchant name → vendor id in one
 * round-trip. Match is case-insensitive + uses the same
 * `normaliseVendorName()` the resolve flow uses.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { normaliseVendorName } from '@/lib/bookkeeping/vendor';

export const GET = withPermission('transaction.read', async (request: NextRequest, auth) => {
  const merchantQuery = request.nextUrl.searchParams.get('merchantStandardised');

  if (merchantQuery && merchantQuery.trim().length > 0) {
    const normalised = normaliseVendorName(merchantQuery);
    const vendor = await prisma.vendor.findFirst({
      where: { userId: auth.userId, normalisedName: normalised },
    });
    return NextResponse.json({
      success: true,
      data: { vendors: vendor ? [vendor] : [] },
    });
  }

  const vendors = await prisma.vendor.findMany({
    where: { userId: auth.userId },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ success: true, data: { vendors } });
});

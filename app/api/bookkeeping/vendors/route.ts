/**
 * Phase 42 PR5 — Vendor list API.
 *
 * GET /api/bookkeeping/vendors  — list the calling user's vendors
 *
 * Lightweight: returns just the Vendor rows. The expensive
 * annual-totals aggregator lives on the per-id endpoint to avoid
 * scanning the whole transaction ledger on every list render.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';

export const GET = withPermission('transaction.read', async (_request, auth) => {
  const vendors = await prisma.vendor.findMany({
    where: { userId: auth.userId },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ success: true, data: { vendors } });
});

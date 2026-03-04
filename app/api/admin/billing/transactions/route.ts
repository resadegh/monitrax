/**
 * Phase 33: Admin Billing Transactions API
 *
 * GET /api/admin/billing/transactions
 * Returns paginated list of billing transactions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES, PAGINATION_DEFAULTS } from '@/lib/admin/constants';

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!hasPermission(authResult.context.role, 'billing:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || String(PAGINATION_DEFAULTS.PAGE));
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(PAGINATION_DEFAULTS.LIMIT)),
      PAGINATION_DEFAULTS.MAX_LIMIT
    );
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, Date>).lte = new Date(endDate);
      }
    }

    // Get transactions with pagination
    const [transactions, total] = await Promise.all([
      prisma.billingTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.billingTransaction.count({ where }),
    ]);

    // Enrich with customer info
    const enrichedTransactions = await Promise.all(
      transactions.map(async (tx) => {
        let customerName = 'Unknown';
        let customerEmail = '';

        if (tx.entityType === 'USER') {
          const user = await prisma.user.findUnique({
            where: { id: tx.entityId },
            select: { name: true, email: true },
          });
          if (user) {
            customerName = user.name || 'Unnamed User';
            customerEmail = user.email;
          }
        } else if (tx.entityType === 'ORGANIZATION') {
          const org = await prisma.organization.findUnique({
            where: { id: tx.entityId },
            select: { name: true },
          });
          if (org) {
            customerName = org.name;
          }
        }

        return {
          id: tx.id,
          date: tx.createdAt.toISOString(),
          customer: customerEmail || customerName,
          customerName,
          customerEmail,
          entityType: tx.entityType,
          entityId: tx.entityId,
          type: tx.type,
          amount: Number(tx.amount),
          currency: tx.currency,
          status: tx.status,
          description: tx.description,
          stripePaymentId: tx.stripePaymentId,
          failureReason: tx.failureReason,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('[Admin Billing Transactions] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch transactions' } },
      { status: 500 }
    );
  }
}

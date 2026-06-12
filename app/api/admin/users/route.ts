/**
 * Phase 33: Admin Users API
 *
 * GET /api/admin/users
 * List all users with pagination and filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
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
    const authResult = await verifyAdminGCPAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!hasPermission(authResult.context.role, 'users:read')) {
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
    const search = searchParams.get('search') || '';
    const tier = searchParams.get('tier') || '';
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get users
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              accounts: true,
              properties: true,
              loans: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Enrich with subscription + last-login data. Batched (2 queries for the
    // whole page) — the previous per-user findUnique loop was an N+1
    // (§12.10), fixed 2026-06-12 while adding lastLoginAt.
    const userIds = users.map((u: typeof users[number]) => u.id);
    const [subscriptions, lastLogins] = await Promise.all([
      prisma.userSubscription.findMany({
        where: { userId: { in: userIds } },
      }),
      prisma.loginAttempt.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, success: true },
        _max: { attemptedAt: true },
      }),
    ]);
    const subscriptionByUserId = new Map(
      subscriptions.map((s: typeof subscriptions[number]) => [s.userId, s])
    );
    const lastLoginByUserId = new Map(
      lastLogins.map((l: typeof lastLogins[number]) => [l.userId, l._max.attemptedAt])
    );

    const enrichedUsers = users.map((user: typeof users[number]) => {
      const subscription = subscriptionByUserId.get(user.id);

      // Filter by tier and status if provided
      if (tier && subscription?.tier !== tier) return null;
      if (status && subscription?.status !== status) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: lastLoginByUserId.get(user.id) ?? null,
        accountsCount: user._count.accounts,
        propertiesCount: user._count.properties,
        loansCount: user._count.loans,
        subscription: subscription
          ? {
              tier: subscription.tier,
              status: subscription.status,
              currentPeriodEnd: subscription.currentPeriodEnd,
            }
          : {
              tier: 'FREE',
              status: 'active',
            },
      };
    });

    // Filter out nulls
    const filteredUsers = enrichedUsers.filter(Boolean);

    return NextResponse.json({
      data: filteredUsers,
      pagination: {
        page,
        limit,
        total: filteredUsers.length,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('[Admin Users] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch users' } },
      { status: 500 }
    );
  }
}

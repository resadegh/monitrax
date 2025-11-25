import { NextRequest, NextResponse } from 'next/server';
import { lockAccount } from '@/lib/security/accountLockout';
import { secureAdminAPI } from '@/lib/middleware/apiSecurity';
import type { AuthContext } from '@/lib/auth/context';

/**
 * POST /api/admin/lockout/lock
 * Manually lock a user's account (admin only)
 */
async function handler(request: NextRequest, context: AuthContext) {
  try {
    const body = await request.json();
    const { userId, durationMinutes, reason } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';

    const result = await lockAccount(
      userId,
      context.userId,
      durationMinutes,
      ipAddress,
      reason
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to lock account' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Account locked successfully',
    });
  } catch (error) {
    console.error('Lock account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = secureAdminAPI(handler, 'ACCOUNT_LOCK');

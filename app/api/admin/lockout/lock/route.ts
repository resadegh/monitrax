import { NextRequest, NextResponse } from 'next/server';
import { lockAccount } from '@/lib/security/accountLockout';
import { getAuthContext } from '@/lib/auth/context';
import { hasPermission } from '@/lib/auth/permissions';

/**
 * POST /api/admin/lockout/lock
 * Manually lock a user's account (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(auth.role, 'lockout.manage')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

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
      auth.userId,
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

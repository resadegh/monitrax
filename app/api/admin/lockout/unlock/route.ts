import { NextRequest, NextResponse } from 'next/server';
import { unlockAccount } from '@/lib/security/accountLockout';
import { secureAdminAPI } from '@/lib/middleware/apiSecurity';
import type { AuthContext } from '@/lib/auth/context';

/**
 * POST /api/admin/lockout/unlock
 * Unlock a user's account (admin only)
 */
async function handler(request: NextRequest, context: AuthContext) {
  try {
    const body = await request.json();
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';

    const result = await unlockAccount(userId, context.userId, ipAddress, reason);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to unlock account' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Account unlocked successfully',
    });
  } catch (error) {
    console.error('Unlock account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = secureAdminAPI(handler, 'ACCOUNT_UNLOCK');

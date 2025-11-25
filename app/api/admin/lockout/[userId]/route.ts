import { NextRequest, NextResponse } from 'next/server';
import { getLockoutInfo } from '@/lib/security/accountLockout';
import { getAuthContext } from '@/lib/auth/context';
import { hasPermission } from '@/lib/auth/permissions';

/**
 * GET /api/admin/lockout/[userId]
 * Get lockout information for a specific user (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Verify admin authentication
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(auth.role, 'LOCKOUT_VIEW')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const lockoutInfo = await getLockoutInfo(params.userId);

    if (!lockoutInfo) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(lockoutInfo);
  } catch (error) {
    console.error('Get lockout info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

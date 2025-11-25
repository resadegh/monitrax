import { NextRequest, NextResponse } from 'next/server';
import { getLockoutInfo } from '@/lib/security/accountLockout';
import { secureAdminAPI } from '@/lib/middleware/apiSecurity';

/**
 * GET /api/admin/lockout/:userId
 * Get lockout information for a specific user (admin only)
 */
async function handler(
  request: NextRequest,
  context: any,
  params?: { userId: string }
) {
  try {
    if (!params?.userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
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

export const GET = secureAdminAPI(handler, 'LOCKOUT_VIEW');

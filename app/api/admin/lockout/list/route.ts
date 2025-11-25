import { NextRequest, NextResponse } from 'next/server';
import { getLockedAccounts } from '@/lib/security/accountLockout';
import { getAuthContext } from '@/lib/auth/context';
import { hasPermission } from '@/lib/auth/permissions';

/**
 * GET /api/admin/lockout/list
 * Get all currently locked accounts (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(auth.role, 'lockout.view')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const lockedAccounts = await getLockedAccounts();

    return NextResponse.json({
      accounts: lockedAccounts,
      total: lockedAccounts.length,
    });
  } catch (error) {
    console.error('Get locked accounts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

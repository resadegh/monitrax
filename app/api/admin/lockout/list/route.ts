import { NextRequest, NextResponse } from 'next/server';
import { getLockedAccounts } from '@/lib/security/accountLockout';
import { secureAdminAPI } from '@/lib/middleware/apiSecurity';

/**
 * GET /api/admin/lockout/list
 * Get all currently locked accounts (admin only)
 */
async function handler(request: NextRequest) {
  try {
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

export const GET = secureAdminAPI(handler, 'LOCKOUT_LIST');

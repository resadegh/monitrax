import { NextRequest, NextResponse } from 'next/server';
import { getUserMFAMethods } from '@/lib/security/mfa';
import { getAuthContext } from '@/lib/auth/context';

/**
 * GET /api/auth/mfa/methods
 * Get all MFA methods for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const methods = await getUserMFAMethods(auth.userId);

    return NextResponse.json({
      methods,
    });
  } catch (error) {
    console.error('Get MFA methods error:', error);
    return NextResponse.json(
      { error: 'Failed to get MFA methods' },
      { status: 500 }
    );
  }
}

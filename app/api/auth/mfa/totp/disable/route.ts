import { NextRequest, NextResponse } from 'next/server';
import { disableMFA } from '@/lib/security/mfa';
import { getAuthContext } from '@/lib/auth/context';

/**
 * POST /api/auth/mfa/totp/disable
 * Disable TOTP MFA
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { mfaMethodId } = body;

    if (!mfaMethodId) {
      return NextResponse.json(
        { error: 'MFA method ID is required' },
        { status: 400 }
      );
    }

    await disableMFA(auth.userId, mfaMethodId);

    return NextResponse.json({
      message: 'TOTP MFA disabled successfully',
    });
  } catch (error) {
    console.error('TOTP disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable TOTP MFA' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { enableTOTPMFA } from '@/lib/security/mfa';
import { getAuthContext } from '@/lib/auth/context';

/**
 * POST /api/auth/mfa/totp/enable
 * Enable TOTP MFA after verification
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
    const { mfaMethodId, code } = body;

    if (!mfaMethodId || !code) {
      return NextResponse.json(
        { error: 'MFA method ID and code are required' },
        { status: 400 }
      );
    }

    const result = await enableTOTPMFA(auth.userId, mfaMethodId, code);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to enable TOTP MFA' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'TOTP MFA enabled successfully',
    });
  } catch (error) {
    console.error('TOTP enable error:', error);
    return NextResponse.json(
      { error: 'Failed to enable TOTP MFA' },
      { status: 500 }
    );
  }
}

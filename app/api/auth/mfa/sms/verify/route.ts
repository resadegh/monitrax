import { NextRequest, NextResponse } from 'next/server';
import { verifySMSSetup } from '@/lib/security/mfa';
import { getAuthContext } from '@/lib/auth/context';

/**
 * POST /api/auth/mfa/sms/verify
 * Verify SMS MFA code and enable SMS authentication
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
        { error: 'MFA method ID and verification code are required' },
        { status: 400 }
      );
    }

    // Get IP address from request headers
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : undefined;

    const result = await verifySMSSetup(auth.userId, mfaMethodId, code, ipAddress);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Verification failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SMS MFA verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify SMS MFA' },
      { status: 500 }
    );
  }
}

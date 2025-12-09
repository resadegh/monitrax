import { NextRequest, NextResponse } from 'next/server';
import { resendSMSCode } from '@/lib/security/mfa';
import { getAuthContext } from '@/lib/auth/context';

/**
 * POST /api/auth/mfa/sms/resend
 * Resend SMS verification code
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

    const result = await resendSMSCode(auth.userId, mfaMethodId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to resend code' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SMS resend error:', error);
    return NextResponse.json(
      { error: 'Failed to resend SMS code' },
      { status: 500 }
    );
  }
}

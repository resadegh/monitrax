import { NextRequest, NextResponse } from 'next/server';
import { disableSMSMFA } from '@/lib/security/mfa';
import { getAuthContext } from '@/lib/auth/context';

/**
 * DELETE /api/auth/mfa/sms/disable
 * Disable SMS MFA for authenticated user
 */
export async function DELETE(request: NextRequest) {
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

    await disableSMSMFA(auth.userId, mfaMethodId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SMS MFA disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable SMS MFA' },
      { status: 500 }
    );
  }
}

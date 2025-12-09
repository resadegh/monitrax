import { NextRequest, NextResponse } from 'next/server';
import { setupSMSMFA } from '@/lib/security/mfa';
import { getAuthContext } from '@/lib/auth/context';

/**
 * POST /api/auth/mfa/sms/setup
 * Setup SMS MFA for authenticated user
 * Sends verification code to the provided phone number
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
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const result = await setupSMSMFA(auth.userId, phoneNumber);

    return NextResponse.json({
      id: result.id,
      type: result.type,
      phoneNumber: result.phoneNumber,
      backupCodes: result.backupCodes,
      // Include code in development mode for testing
      ...(process.env.NODE_ENV === 'development' && result.code
        ? { devCode: result.code }
        : {}),
    });
  } catch (error) {
    console.error('SMS MFA setup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to setup SMS MFA' },
      { status: 500 }
    );
  }
}

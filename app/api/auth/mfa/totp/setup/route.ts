import { NextRequest, NextResponse } from 'next/server';
import { setupTOTPMFA } from '@/lib/security/mfa';
import { getAuthContext } from '@/lib/auth/context';

/**
 * POST /api/auth/mfa/totp/setup
 * Setup TOTP MFA for authenticated user
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

    const result = await setupTOTPMFA(auth.userId, auth.email);

    return NextResponse.json({
      id: result.id,
      type: result.type,
      secret: result.secret,
      qrCodeUrl: result.qrCodeUrl,
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup TOTP MFA' },
      { status: 500 }
    );
  }
}

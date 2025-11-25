import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailMFACode } from '@/lib/security/mfa';

/**
 * POST /api/auth/mfa/email/verify
 * Verify email MFA code (public endpoint for login)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json(
        { error: 'User ID and code are required' },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';

    const result = await verifyEmailMFACode(userId, code, ipAddress);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Invalid verification code' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      message: 'Verification successful',
    });
  } catch (error) {
    console.error('Email MFA verify error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}

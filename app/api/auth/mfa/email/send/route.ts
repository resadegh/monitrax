import { NextRequest, NextResponse } from 'next/server';
import { sendEmailMFACode } from '@/lib/security/mfa';
import { getAuthContext } from '@/lib/auth/context';

/**
 * POST /api/auth/mfa/email/send
 * Send email MFA code (can be used during login or setup)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email } = body;

    // Check if request is authenticated (for logged-in users)
    // or has userId+email (for login flow)
    const auth = await getAuthContext(request);

    let targetUserId: string;
    let targetEmail: string;

    if (auth) {
      // Authenticated request
      targetUserId = auth.userId;
      targetEmail = auth.email;
    } else if (userId && email) {
      // Login flow - verify user exists
      const { prisma } = await import('@/lib/db');
      const user = await prisma.user.findUnique({
        where: { id: userId, email },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'Invalid user' },
          { status: 400 }
        );
      }

      targetUserId = userId;
      targetEmail = email;
    } else {
      return NextResponse.json(
        { error: 'Authentication required or userId and email must be provided' },
        { status: 401 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';

    const result = await sendEmailMFACode(targetUserId, targetEmail, ipAddress);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send verification code' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Verification code sent to your email',
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('Email MFA send error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendVerificationEmail } from '@/lib/security/emailVerification';

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, emailVerified: true },
    });

    // Don't reveal if user exists or not for security
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a verification link will be sent.',
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a verification link will be sent.',
      });
    }

    // Send verification email
    const result = await sendVerificationEmail(user.email, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 429 } // Rate limited
      );
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a verification link will be sent.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

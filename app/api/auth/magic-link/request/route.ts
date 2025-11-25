import { NextRequest, NextResponse } from 'next/server';
import { createMagicLink } from '@/lib/auth/magicLink';
import { rateLimitCheck } from '@/lib/security/rateLimit';

/**
 * POST /api/auth/magic-link/request
 * Request a magic link for passwordless login
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimitCheck(request, 'login');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { email, redirectTo } = body;

    // Validation
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create magic link
    const result = await createMagicLink({
      email,
      redirectTo,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create magic link' },
        { status: 400 }
      );
    }

    // In production, send email here
    // For now, return the token (in production, this would be sent via email)
    const magicLinkUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/magic-link/verify?token=${result.token}`;

    return NextResponse.json({
      message: 'Magic link sent! Check your email.',
      // TODO: Remove this in production - token should only be sent via email
      magicLinkUrl: process.env.NODE_ENV === 'development' ? magicLinkUrl : undefined,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('Magic link request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

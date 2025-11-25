import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLink } from '@/lib/auth/magicLink';
import { createTrackedSession } from '@/lib/session';

/**
 * POST /api/auth/magic-link/verify
 * Verify a magic link and log the user in
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    // Validation
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Verify magic link
    const result = await verifyMagicLink({
      token,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Invalid magic link' },
        { status: 401 }
      );
    }

    // Create tracked session
    if (result.userId) {
      await createTrackedSession({
        userId: result.userId,
        ipAddress,
        userAgent,
        deviceName: userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop',
      });
    }

    return NextResponse.json({
      message: 'Login successful',
      token: result.token,
      userId: result.userId,
    });
  } catch (error) {
    console.error('Magic link verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

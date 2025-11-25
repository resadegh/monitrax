import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthentication } from '@/lib/auth/passkey';
import { createTrackedSession } from '@/lib/session';

/**
 * POST /api/auth/passkey/authenticate/verify
 * Verify passkey authentication and create session (public endpoint for login)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credential } = body;

    if (!credential) {
      return NextResponse.json(
        { error: 'Credential is required' },
        { status: 400 }
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Verify authentication
    const result = await verifyAuthentication({
      credential,
      ipAddress,
      userAgent,
    });

    if (!result.success || !result.userId) {
      return NextResponse.json(
        { error: result.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    // Create tracked session
    const session = await createTrackedSession({
      userId: result.userId,
      ipAddress,
      userAgent,
      deviceName: userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop',
    });

    return NextResponse.json({
      message: 'Login successful',
      token: session.token,
      userId: result.userId,
    });
  } catch (error) {
    console.error('Passkey authentication verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

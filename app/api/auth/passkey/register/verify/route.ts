import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistration } from '@/lib/auth/passkey';
import { getAuthContext } from '@/lib/auth/context';

/**
 * POST /api/auth/passkey/register/verify
 * Verify passkey registration for authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credential, deviceName } = body;

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

    // Verify registration
    const result = await verifyRegistration({
      userId: auth.userId,
      credential,
      deviceName,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Registration verification failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Passkey registered successfully',
      passkeyId: result.passkeyId,
    });
  } catch (error) {
    console.error('Passkey registration verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

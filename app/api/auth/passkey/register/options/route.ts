import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@/lib/auth/passkey';
import { getAuthContext } from '@/lib/auth/context';

/**
 * POST /api/auth/passkey/register/options
 * Generate passkey registration options for authenticated user
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
    const {
      requireResidentKey = false,
      authenticatorAttachment,
    } = body;

    // Generate registration options
    const options = await generateRegistrationOptions({
      userId: auth.userId,
      userName: auth.user?.name || auth.email,
      userEmail: auth.email,
      requireResidentKey,
      authenticatorAttachment,
    });

    return NextResponse.json({
      options,
    });
  } catch (error) {
    console.error('Passkey registration options error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

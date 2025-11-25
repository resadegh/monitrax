import { NextRequest, NextResponse } from 'next/server';
import { getUserPasskeys } from '@/lib/auth/passkey';
import { getAuthContext } from '@/lib/auth/context';

/**
 * GET /api/auth/passkey/list
 * Get all passkeys for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's passkeys
    const passkeys = await getUserPasskeys(auth.userId);

    // Remove sensitive data before sending to client
    const safePasskeys = passkeys.map((passkey) => ({
      id: passkey.id,
      deviceName: passkey.deviceName,
      lastUsedAt: passkey.lastUsedAt,
      createdAt: passkey.createdAt,
      // Don't send credentialId or publicKey to client
    }));

    return NextResponse.json({
      passkeys: safePasskeys,
    });
  } catch (error) {
    console.error('Passkey list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

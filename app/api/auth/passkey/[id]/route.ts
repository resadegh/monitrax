import { NextRequest, NextResponse } from 'next/server';
import { deletePasskey, updatePasskeyName } from '@/lib/auth/passkey';
import { getAuthContext } from '@/lib/auth/context';

/**
 * DELETE /api/auth/passkey/:id
 * Delete a passkey for authenticated user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const passkeyId = params.id;

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Delete passkey
    const result = await deletePasskey(passkeyId, auth.userId, ipAddress, userAgent);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete passkey' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Passkey deleted successfully',
    });
  } catch (error) {
    console.error('Passkey delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/auth/passkey/:id
 * Update passkey name for authenticated user
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const passkeyId = params.id;
    const body = await request.json();
    const { deviceName } = body;

    if (!deviceName) {
      return NextResponse.json(
        { error: 'Device name is required' },
        { status: 400 }
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Update passkey name
    const result = await updatePasskeyName(
      passkeyId,
      auth.userId,
      deviceName,
      ipAddress,
      userAgent
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update passkey' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Passkey updated successfully',
    });
  } catch (error) {
    console.error('Passkey update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

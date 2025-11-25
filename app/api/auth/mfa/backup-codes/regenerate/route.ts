import { NextRequest, NextResponse } from 'next/server';
import { regenerateBackupCodes } from '@/lib/security/mfa';
import { getAuthContext } from '@/lib/auth/context';

/**
 * POST /api/auth/mfa/backup-codes/regenerate
 * Regenerate backup codes for authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { mfaMethodId } = body;

    if (!mfaMethodId) {
      return NextResponse.json(
        { error: 'MFA method ID is required' },
        { status: 400 }
      );
    }

    const backupCodes = await regenerateBackupCodes(auth.userId, mfaMethodId);

    return NextResponse.json({
      message: 'Backup codes regenerated successfully',
      backupCodes,
    });
  } catch (error) {
    console.error('Backup codes regeneration error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate backup codes' },
      { status: 500 }
    );
  }
}

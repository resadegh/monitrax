/**
 * Phase 33: Admin Logout API
 *
 * POST /api/admin/auth/logout
 * Handles admin logout and session revocation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, revokeAdminSession } from '@/lib/admin/auth';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAdminAuth(request);

    if (authResult.success && authResult.context) {
      // Revoke the session
      await revokeAdminSession(authResult.context.sessionId, 'User logout');
    }

    // Clear the session cookie
    const response = NextResponse.json({ success: true });

    response.cookies.set('admin_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/admin',
    });

    return response;
  } catch (error) {
    console.error('[Admin Logout] Error:', error);
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.INTERNAL_ERROR,
          message: 'An error occurred during logout',
        },
      },
      { status: 500 }
    );
  }
}

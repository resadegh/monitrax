/**
 * Phase 33: Admin Session API
 *
 * GET /api/admin/auth/session
 * Validates current admin session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);

    if (!authResult.success || !authResult.context) {
      return NextResponse.json(
        {
          valid: false,
          error: authResult.error,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      admin: {
        id: authResult.context.adminId,
        email: authResult.context.email,
        name: authResult.context.name,
        role: authResult.context.role,
      },
    });
  } catch (error) {
    console.error('[Admin Session] Error:', error);
    return NextResponse.json(
      {
        valid: false,
        error: {
          code: ADMIN_ERROR_CODES.INTERNAL_ERROR,
          message: 'Session verification failed',
        },
      },
      { status: 500 }
    );
  }
}
